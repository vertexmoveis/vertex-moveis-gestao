import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseProjectContractSnapshot } from '@/lib/project-contracts'
import { renderSignedProjectContractPdf } from '@/lib/project-contract-pdf'
import { canAccessProject, requireAuth, serverError } from '@/lib/security'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; contractId: string }> },
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id, contractId } = await params

  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId: id },
    include: { project: { select: { managerId: true } } },
  })
  if (!contract || !canAccessProject(auth.user, contract.project.managerId)) {
    return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  }
  if (!contract.signedAt || contract.status !== 'SIGNED' || !contract.signatoryName) {
    return NextResponse.json({ error: 'O PDF final fica disponível após o aceite do cliente.' }, { status: 409 })
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
        'Content-Disposition': `inline; filename="contrato-${contract.version}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Erro ao gerar PDF do contrato assinado.', error)
    return serverError()
  }
}
