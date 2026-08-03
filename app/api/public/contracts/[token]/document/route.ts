import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashProjectContractToken, parseProjectContractSnapshot } from '@/lib/project-contracts'
import { renderSignedProjectContractPdf } from '@/lib/project-contract-pdf'
import { isValidPublicToken, publicRateLimitKey } from '@/lib/public-access'
import { getClientIp, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isValidPublicToken(token)) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })

  const limited = await rateLimit(publicRateLimitKey('contract:pdf', getClientIp(req)), 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Tente novamente em alguns instantes.' }, { status: 429 })

  const contract = await prisma.projectContract.findUnique({ where: { tokenHash: hashProjectContractToken(token) } })
  if (!contract) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  if (!contract.signedAt || contract.status !== 'SIGNED' || !contract.signatoryName || contract.voidedAt) {
    return NextResponse.json({ error: 'O PDF final fica disponível após o aceite.' }, { status: 409 })
  }
  const snapshot = parseProjectContractSnapshot(contract.snapshot)
  if (!snapshot) return NextResponse.json({ error: 'Contrato armazenado inválido.' }, { status: 500 })

  try {
    const logo = await readFile(path.join(process.cwd(), 'public', 'vertex-symbol.png'))
    const buffer = await renderSignedProjectContractPdf({
      id: contract.id,
      version: contract.version,
      snapshot,
      signedAt: contract.signedAt,
      signatoryName: contract.signatoryName,
      signatoryDocument: contract.signatoryDocument,
      acceptedIpHash: contract.acceptedIpHash,
      acceptedUserAgent: contract.acceptedUserAgent,
      logoDataUrl: `data:image/png;base64,${logo.toString('base64')}`,
    })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="contrato-vertex-${contract.version}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Erro ao gerar PDF público do contrato.', error)
    return serverError()
  }
}
