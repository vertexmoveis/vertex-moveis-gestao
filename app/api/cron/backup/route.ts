import { NextRequest, NextResponse } from 'next/server'
import { createCloudBackup } from '@/lib/cloud-backup'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 60

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
}

function safeErrorMessage(error: unknown) {
  return (error instanceof Error ? error.message : 'Não foi possível criar o backup externo.')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[conexão removida]')
    .replace(/(password|token|secret)=([^&\s]+)/gi, '$1=[removido]')
    .slice(0, 800)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const backup = await createCloudBackup()
    await prisma.systemEvent.create({
      data: {
        type: 'BACKUP_SUCCESS',
        severity: 'INFO',
        source: 'cloud-backup',
        message: 'Backup externo criptografado e verificado com sucesso.',
        details: {
          ...backup,
          secondaryCopied: true,
          storage: 'vercel-blob-private',
          restoreTested: false,
        },
      },
    })
    return NextResponse.json({ success: true, ...backup })
  } catch (error) {
    await prisma.systemEvent.create({
      data: {
        type: 'BACKUP_FAILURE',
        severity: 'ERROR',
        source: 'cloud-backup',
        message: safeErrorMessage(error),
      },
    }).catch(() => undefined)
    return NextResponse.json({ error: 'Não foi possível criar o backup externo.' }, { status: 500 })
  }
}
