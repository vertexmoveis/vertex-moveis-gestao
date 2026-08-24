import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseProjectContractSnapshot } from '@/lib/project-contracts'
import { renderProjectContractPdf } from '@/lib/project-contract-pdf'
import { requireAuth, serverError } from '@/lib/security'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { contractId } = await params

  const contract = await prisma.projectContract.findFirst({
    where: {
      id: contractId,
      projectId: null,
      ...(auth.user.role === 'ADMIN' ? {} : { createdById: auth.user.id }),
    },
    include: { signatureRecordedBy: { select: { name: true } } },
  })
  if (!contract) {
    return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  }
  const snapshot = parseProjectContractSnapshot(contract.snapshot)
  if (!snapshot) {
    return NextResponse.json({ error: 'Contrato armazenado inválido.' }, { status: 500 })
  }

  try {
    const logo = await readFile(path.join(process.cwd(), 'public', 'vertex-symbol.png'))
    const buffer = await renderProjectContractPdf({
      id: contract.id,
      version: contract.version,
      snapshot,
      signedAt: contract.signedAt,
      signatoryName: contract.signatoryName,
      signatoryDocument: contract.signatoryDocument,
      acceptedIpHash: contract.acceptedIpHash,
      acceptedUserAgent: contract.acceptedUserAgent,
      signatureMethod: contract.signatureMethod,
      signatureRecordedAt: contract.signatureRecordedAt,
      signatureRecordedByName: contract.signatureRecordedBy?.name || null,
      signatureNote: contract.signatureNote,
      logoDataUrl: `data:image/png;base64,${logo.toString('base64')}`,
    })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="contrato-avulso-vertex.pdf"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Erro ao gerar PDF do contrato avulso.', error)
    return serverError()
  }
}
