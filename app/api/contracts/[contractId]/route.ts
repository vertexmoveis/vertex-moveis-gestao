import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireRole, getClientIp, serviceUnavailable, serverError } from '@/lib/security'
import { rateLimit } from '@/lib/rate-limit'
import { standaloneContractEditForm, editStandaloneSchema } from '@/lib/standalone-contract-edit'
import { buildStandaloneContractSnapshot } from '@/lib/standalone-contracts'
import { createProjectContractToken, projectContractUrl } from '@/lib/project-contracts'

function locked(contract: { projectId: string | null; signedAt: Date | null; voidedAt: Date | null; status: string }) {
  return Boolean(contract.projectId || contract.signedAt || contract.voidedAt || ['SIGNED', 'VOID', 'CANCELLED'].includes(contract.status))
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response
  const { contractId } = await params
  const limited = await rateLimit(`contract:edit:get:${auth.user.id}:${getClientIp(req)}`, 80, 60000).catch(() => null)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas solicitações. Aguarde um minuto.' }, { status: 429 })
  try {
    const contract = await prisma.projectContract.findFirst({ where: {
      id: contractId, ...(auth.user.role === 'ADMIN' ? {} : { createdById: auth.user.id }),
    }, include: { client: { select: { name: true } } } })
    if (!contract) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
    if (locked(contract)) return NextResponse.json({ error: 'Somente contratos avulsos ainda não assinados podem ser editados.' }, { status: 409 })
    const form = standaloneContractEditForm(contract)
    if (!form) return NextResponse.json({ error: 'Não foi possível recuperar os dados deste contrato para edição.' }, { status: 409 })
    return NextResponse.json({ id: contract.id, version: contract.version, updatedAt: contract.updatedAt.toISOString(), clientName: contract.client?.name || '', form })
  } catch { return serverError() }
}

class EditConflict extends Error {}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response
  const { contractId } = await params
  const limited = await rateLimit(`contract:edit:save:${auth.user.id}:${getClientIp(req)}`, 20, 60000).catch(() => null)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas solicitações. Aguarde um minuto.' }, { status: 429 })
  const parsed = editStandaloneSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Confira os dados do contrato.' }, { status: 400 })
  try {
    const replacement = await prisma.$transaction(async tx => {
      // The same row is guarded by signing, cancellation and conversion updates.
      await tx.$queryRaw`SELECT "id" FROM "ProjectContract" WHERE "id" = ${contractId} FOR UPDATE`
      const contract = await tx.projectContract.findFirst({ where: {
        id: contractId, ...(auth.user.role === 'ADMIN' ? {} : { createdById: auth.user.id }),
      } })
      if (!contract) return null
      if (locked(contract)) throw new EditConflict('Este contrato foi assinado, substituído ou formalizado. Atualize a lista antes de continuar.')
      if (contract.updatedAt.toISOString() !== parsed.data.updatedAt) throw new EditConflict('Este contrato recebeu uma atualização. Abra a edição novamente para conferir os dados atuais.')
      if (!standaloneContractEditForm(contract)) throw new EditConflict('Não foi possível recuperar os dados originais deste contrato.')
      const client = await tx.client.findFirst({ where: {
        id: parsed.data.clientId, archivedAt: null, ...(auth.user.role === 'ADMIN' ? {} : { managerId: auth.user.id }),
      } })
      if (!client) throw new EditConflict('Escolha um cliente ativo ao qual você tenha acesso.')
      const company = await tx.companyProfile.findUnique({ where: { id: 'vertex' } })
      const snapshot = buildStandaloneContractSnapshot(parsed.data, client, company || {
        tradeName: 'Vertex Móveis', legalName: 'Vertex Móveis', street: 'Rua Saturno', number: '6', city: 'Cotia', state: 'SP', zipCode: '06702-170',
      })
      const token = createProjectContractToken()
      const now = new Date()
      const created = await tx.projectContract.create({ data: {
        clientId: client.id, standaloneTitle: parsed.data.title, createdById: contract.createdById || auth.user.id,
        version: contract.version + 1, status: 'SENT', snapshot: snapshot as unknown as Prisma.InputJsonValue,
        tokenHash: token.tokenHash, tokenEncrypted: token.tokenEncrypted, sentAt: now,
        createdAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      } })
      await tx.projectContract.update({ where: { id: contract.id }, data: { status: 'VOID', voidedAt: now } })
      await tx.activityLog.create({ data: {
        userId: auth.user.id, action: 'Contrato avulso corrigido',
        details: JSON.stringify({ previousContractId: contract.id, contractId: created.id, previousVersion: contract.version, version: created.version, title: created.standaloneTitle }),
      } })
      return { id: created.id, publicUrl: projectContractUrl(req.nextUrl.origin, token.token) }
    }, { timeout: 15000 })
    if (!replacement) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
    return NextResponse.json(replacement)
  } catch (error) {
    if (error instanceof EditConflict) return NextResponse.json({ error: error.message }, { status: 409 })
    return serverError()
  }
}
