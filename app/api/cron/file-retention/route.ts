import { del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { projectFileRetentionDays } from '@/lib/project-file-security'

export const runtime = 'nodejs'
export const maxDuration = 60

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const retentionDays = projectFileRetentionDays()
  if (!retentionDays) {
    return NextResponse.json({ success: true, skipped: true, reason: 'retention_disabled' })
  }
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
  const files = await prisma.projectFile.findMany({
    where: {
      OR: [
        { expiresAt: { lte: now } },
        { expiresAt: null, createdAt: { lte: cutoff } },
      ],
    },
    orderBy: { expiresAt: 'asc' },
    take: 50,
    select: { id: true, projectId: true, name: true, url: true },
  })
  let removed = 0
  const failures: string[] = []

  for (const file of files) {
    try {
      await del(file.url)
      await prisma.$transaction([
        prisma.projectFile.delete({ where: { id: file.id } }),
        prisma.timelineEvent.create({
          data: {
            projectId: file.projectId,
            event: 'Arquivo removido pela retenção',
            description: file.name,
          },
        }),
      ])
      removed += 1
    } catch {
      failures.push(file.id)
    }
  }

  await prisma.systemEvent.create({
    data: {
      type: failures.length > 0 ? 'FILE_RETENTION_WARNING' : 'FILE_RETENTION_SUCCESS',
      severity: failures.length > 0 ? 'WARNING' : 'INFO',
      source: `file-retention:${now.toISOString().slice(0, 10)}`,
      message: `${removed} arquivo(s) expirado(s) removido(s); ${failures.length} falha(s).`,
      details: { candidates: files.length, removed, failures: failures.length },
    },
  })

  return NextResponse.json({ success: failures.length === 0, candidates: files.length, removed, failures: failures.length })
}
