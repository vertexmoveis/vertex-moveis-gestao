import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  buildProjectContractSnapshot,
  createProjectContractToken,
  decryptProjectContractToken,
  projectContractUrl,
} from '@/lib/project-contracts'
import {
  canAccessProject,
  getClientIp,
  requireAuth,
  serverError,
  serviceUnavailable,
} from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

const createSchema = z.object({}).strict()

async function limit(req: NextRequest, userId: string, projectId: string) {
  return rateLimit(
    `api:projects:contracts:${userId}:${projectId}:${getClientIp(req)}`,
    15,
    60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
}

async function projectWithAccess(projectId: string, user: Parameters<typeof canAccessProject>[0]) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, archivedAt: null },
    include: {
      client: true,
      environments: {
        orderBy: { position: 'asc' },
        select: { name: true },
      },
      payments: {
        orderBy: [{ type: 'asc' }, { installmentNumber: 'asc' }],
        select: {
          installmentNumber: true,
          type: true,
          amount: true,
          dueDate: true,
        },
      },
    },
  })
  return project && canAccessProject(user, project.managerId) ? project : null
}

function serializeContract(
  req: NextRequest,
  contract: {
    id: string
    version: number
    status: string
    tokenEncrypted: string
    sentAt: Date | null
    viewedAt: Date | null
    expiresAt: Date | null
    signedAt: Date | null
    voidedAt: Date | null
    signatoryName: string | null
    createdAt: Date
  },
) {
  let url: string | null = null
  try {
    url = projectContractUrl(req.nextUrl.origin, decryptProjectContractToken(contract.tokenEncrypted))
  } catch {
    url = null
  }

  const expired = Boolean(
    contract.expiresAt
    && contract.expiresAt.getTime() < Date.now()
    && !contract.signedAt
    && !contract.voidedAt,
  )

  return {
    id: contract.id,
    version: contract.version,
    status: expired ? 'EXPIRED' : contract.status,
    url,
    sentAt: contract.sentAt?.toISOString() || null,
    viewedAt: contract.viewedAt?.toISOString() || null,
    expiresAt: contract.expiresAt?.toISOString() || null,
    signedAt: contract.signedAt?.toISOString() || null,
    voidedAt: contract.voidedAt?.toISOString() || null,
    signatoryName: contract.signatoryName,
    createdAt: contract.createdAt.toISOString(),
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  if (!await projectWithAccess(id, auth.user)) {
    return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
  }

  const contracts = await prisma.projectContract.findMany({
    where: { projectId: id },
    orderBy: { version: 'desc' },
    take: 20,
  })
  return NextResponse.json(contracts.map((contract) => serializeContract(req, contract)))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  const project = await projectWithAccess(id, auth.user)
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  const limited = await limit(req, auth.user.id, id)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }
  if (!project.value || Number(project.value) <= 0) {
    return NextResponse.json(
      { error: 'Informe o valor do projeto antes de gerar o contrato.' },
      { status: 400 },
    )
  }

  try {
    const company = await prisma.companyProfile.findUnique({ where: { id: 'vertex' } })
    const snapshot = buildProjectContractSnapshot(project, company || {
      tradeName: 'Vertex Móveis',
      street: 'Rua Saturno',
      number: '6',
      city: 'Cotia',
      state: 'SP',
      zipCode: '06702-170',
    })
    const secureToken = createProjectContractToken()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const contract = await prisma.$transaction(async (tx) => {
      const latest = await tx.projectContract.aggregate({
        where: { projectId: id },
        _max: { version: true },
      })
      const version = (latest._max.version || 0) + 1

      await tx.projectContract.updateMany({
        where: {
          projectId: id,
          status: { in: ['DRAFT', 'SENT'] },
          signedAt: null,
          voidedAt: null,
        },
        data: { status: 'VOID', voidedAt: now },
      })

      const created = await tx.projectContract.create({
        data: {
          projectId: id,
          createdById: auth.user.id,
          version,
          status: 'SENT',
          tokenHash: secureToken.tokenHash,
          tokenEncrypted: secureToken.tokenEncrypted,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          sentAt: now,
          expiresAt,
        },
      })

      await tx.timelineEvent.create({
        data: {
          projectId: id,
          event: 'Contrato enviado',
          description: `Contrato versão ${version} criado para aceite do cliente.`,
        },
      })
      await tx.activityLog.create({
        data: {
          userId: auth.user.id,
          projectId: id,
          action: 'Contrato digital criado',
          details: `Versão ${version}`,
        },
      })
      return created
    })

    return NextResponse.json(
      serializeContract(req, contract),
      { status: 201 },
    )
  } catch (error) {
    console.error('Erro ao criar contrato digital.', error)
    return serverError()
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  if (!await projectWithAccess(id, auth.user)) {
    return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
  }

  const contractId = req.nextUrl.searchParams.get('contractId')?.trim()
  if (!contractId) {
    return NextResponse.json({ error: 'Informe o contrato.' }, { status: 400 })
  }
  const limited = await limit(req, auth.user.id, id)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 })
  }

  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.projectContract.updateMany({
      where: {
        id: contractId,
        projectId: id,
        signedAt: null,
        voidedAt: null,
      },
      data: { status: 'VOID', voidedAt: now },
    })
    if (result.count === 1) {
      await tx.activityLog.create({
        data: {
          userId: auth.user.id,
          projectId: id,
          action: 'Contrato digital cancelado',
          details: contractId,
        },
      })
    }
    return result.count
  })

  if (updated !== 1) {
    return NextResponse.json(
      { error: 'Este contrato não pode mais ser cancelado.' },
      { status: 409 },
    )
  }
  return NextResponse.json({ success: true })
}
