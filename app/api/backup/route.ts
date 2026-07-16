import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { getClientIp, requireRole, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const execFileAsync = promisify(execFile)

type BackupResult = {
  success: true
  fileName: string
  path: string
  secondaryPath: string | null
  retentionDays: number
  verified: boolean
  restoreTested: boolean
  removed: number
}

async function createSafeBackup() {
  const script = path.join(process.cwd(), 'scripts', 'backup-database.mjs')
  const { stdout } = await execFileAsync(process.execPath, [script], {
    cwd: process.cwd(),
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  })

  return JSON.parse(stdout.trim()) as BackupResult
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  if (process.env.VERCEL === '1') {
    return NextResponse.json(
      { error: 'A copia local do banco deve ser executada no computador da Vertex.' },
      { status: 503 },
    )
  }

  const limited = await rateLimit(`api:backup:${auth.user.id}:${getClientIp(req)}`, 10, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    const backup = await createSafeBackup()
    return NextResponse.json(backup)
  } catch {
    return NextResponse.json({ error: 'Não foi possível criar o backup seguro.' }, { status: 500 })
  }
}
