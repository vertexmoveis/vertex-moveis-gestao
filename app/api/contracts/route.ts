import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  CONTRACT_CENTER_STATUSES,
  type ContractCenterStatus,
} from '@/lib/contract-center'
import {
  createProjectContractToken,
  decryptProjectContractToken,
  projectContractUrl,
} from '@/lib/project-contracts'
import { buildStandaloneContractSnapshot } from '@/lib/standalone-contracts'
import { getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

const createStandaloneSchema = z.object({
  clientId: z.string().trim().min(1, 'Escolha o cliente.'),
  title: z.string().trim().min(3, 'Informe o serviço contratado.').max(160),
  description: z.string().trim().min(5, 'Descreva o que será contratado.').max(3000),
  value: z.coerce.number().positive('Informe um valor maior que zero.').max(10_000_000),
  paymentMethod: z.enum(['PIX', 'CARD']),
  downPayment: z.coerce.number().min(0).max(10_000_000).default(0),
  downPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  installmentCount: z.coerce.number().int().min(1).max(24).default(1),
  firstInstallmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliveryBusinessDays: z.coerce.number().int().min(1).max(365).default(30),
}).strict()
const reminderSchema = z.object({ contractId: z.string().trim().min(1) }).strict()
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000

function standaloneStatus(contract: {
  status: string
  viewedAt: Date | null
  signedAt: Date | null
  expiresAt: Date | null
}): ContractCenterStatus {
  if (contract.signedAt || contract.status === 'SIGNED') return 'SIGNED'
  if (contract.expiresAt && contract.expiresAt.getTime() < Date.now()) return 'EXPIRED'
  if (contract.viewedAt) return 'VIEWED'
  return 'SENT'
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(
    `api:contracts:get:${auth.user.id}:${getClientIp(req)}`,
    90,
    60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em instantes.' }, { status: 429 })
  }

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 120)
  const requestedStatus = req.nextUrl.searchParams.get('status')
  const status = CONTRACT_CENTER_STATUSES.includes(requestedStatus as ContractCenterStatus)
    ? requestedStatus as ContractCenterStatus
    : null
  const page = Math.max(Number(req.nextUrl.searchParams.get('page') || 1), 1)
  const pageSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get('pageSize') || 20), 1), 50)
  const accessFilter = auth.user.role === 'ADMIN'
    ? Prisma.empty
    : Prisma.sql`AND project."managerId" = ${auth.user.id}`
  const searchFilter = q
    ? Prisma.sql`AND (project."name" ILIKE ${`%${q}%`} OR client."name" ILIKE ${`%${q}%`})`
    : Prisma.empty
  const statusFilter = status ? Prisma.sql`AND "centerStatus" = ${status}` : Prisma.empty
  const classifiedProjects = Prisma.sql`
    WITH latest_contract AS (
      SELECT DISTINCT ON (contract."projectId")
        contract."projectId",
        contract."status",
        contract."viewedAt",
        contract."signedAt",
        contract."voidedAt",
        contract."expiresAt"
      FROM "ProjectContract" contract
      ORDER BY contract."projectId", contract."version" DESC
    ), classified AS (
      SELECT
        project."id",
        project."stage",
        project."updatedAt",
        CASE
          WHEN project."contractRevisionRequiredAt" IS NOT NULL THEN 'NEEDS_REVISION'
          WHEN latest."projectId" IS NULL
            OR latest."voidedAt" IS NOT NULL
            OR latest."status" IN ('VOID', 'DRAFT')
            THEN CASE WHEN project."contractRequirement" = 'OPTIONAL_LEGACY' THEN 'LEGACY' ELSE 'NOT_SENT' END
          WHEN latest."signedAt" IS NOT NULL OR latest."status" = 'SIGNED' THEN 'SIGNED'
          WHEN latest."expiresAt" IS NOT NULL AND latest."expiresAt" < NOW() THEN 'EXPIRED'
          WHEN latest."viewedAt" IS NOT NULL THEN 'VIEWED'
          ELSE 'SENT'
        END AS "centerStatus"
      FROM "Project" project
      INNER JOIN "Client" client ON client."id" = project."clientId"
      LEFT JOIN latest_contract latest ON latest."projectId" = project."id"
      WHERE project."archivedAt" IS NULL
        AND project."contractRequirement" <> 'WAIVED'
        ${accessFilter}
        ${searchFilter}
    ), visible AS (
      SELECT * FROM classified
      WHERE NOT ("stage" = 'COMPLETED' AND "centerStatus" <> 'SIGNED')
    )
  `

  type ContractCountRow = {
    all: bigint
    filtered: bigint
    attention: bigint
    waiting: bigint
    signed: bigint
    legacy: bigint
  }
  type ContractPageRow = { id: string; centerStatus: ContractCenterStatus }
  const [countRows, pageRows] = await Promise.all([
    prisma.$queryRaw<ContractCountRow[]>(Prisma.sql`
      ${classifiedProjects}
      SELECT
        COUNT(*) AS "all",
        COUNT(*) FILTER (WHERE TRUE ${statusFilter}) AS "filtered",
        COUNT(*) FILTER (WHERE "centerStatus" IN ('NOT_SENT', 'NEEDS_REVISION', 'EXPIRED')) AS "attention",
        COUNT(*) FILTER (WHERE "centerStatus" IN ('SENT', 'VIEWED')) AS "waiting",
        COUNT(*) FILTER (WHERE "centerStatus" = 'SIGNED') AS "signed",
        COUNT(*) FILTER (WHERE "centerStatus" = 'LEGACY') AS "legacy"
      FROM visible
    `),
    prisma.$queryRaw<ContractPageRow[]>(Prisma.sql`
      ${classifiedProjects}
      SELECT "id", "centerStatus"
      FROM visible
      WHERE TRUE ${statusFilter}
      ORDER BY
        CASE "centerStatus"
          WHEN 'NEEDS_REVISION' THEN 0
          WHEN 'EXPIRED' THEN 1
          WHEN 'NOT_SENT' THEN 2
          WHEN 'VIEWED' THEN 3
          WHEN 'SENT' THEN 4
          WHEN 'LEGACY' THEN 5
          ELSE 6
        END,
        "updatedAt" DESC
      OFFSET ${(page - 1) * pageSize}
      LIMIT ${pageSize}
    `),
  ])
  const pageIds = pageRows.map((row) => row.id)
  const projects = pageIds.length === 0 ? [] : await prisma.project.findMany({
    where: { id: { in: pageIds } },
    select: {
      id: true,
      name: true,
      stage: true,
      contractRequirement: true,
      contractRevisionRequiredAt: true,
      updatedAt: true,
      client: { select: { name: true, whatsapp: true, phone: true } },
      manager: { select: { name: true } },
      contracts: {
        orderBy: { version: 'desc' },
        take: 1,
        select: {
          id: true,
          version: true,
          status: true,
          tokenEncrypted: true,
          sentAt: true,
          viewedAt: true,
          lastReminderAt: true,
          reminderCount: true,
          expiresAt: true,
          signedAt: true,
          voidedAt: true,
        },
      },
    },
  })

  const projectsById = new Map(projects.map((project) => [project.id, project]))
  const rows = pageRows.flatMap((pageRow) => {
    const project = projectsById.get(pageRow.id)
    if (!project) return []
    const contract = project.contracts[0] || null

    let publicUrl: string | null = null
    if (contract && !contract.voidedAt) {
      try {
        publicUrl = projectContractUrl(req.nextUrl.origin, decryptProjectContractToken(contract.tokenEncrypted))
      } catch {
        publicUrl = null
      }
    }

    return [{
      id: project.id,
      name: project.name,
      stage: project.stage,
      clientName: project.client.name,
      clientPhone: project.client.whatsapp || project.client.phone,
      managerName: project.manager?.name || 'Sem responsável',
      status: pageRow.centerStatus,
      requirement: project.contractRequirement,
      updatedAt: project.updatedAt.toISOString(),
      contract: contract ? {
        id: contract.id,
        version: contract.version,
        publicUrl,
        sentAt: contract.sentAt?.toISOString() || null,
        viewedAt: contract.viewedAt?.toISOString() || null,
        lastReminderAt: contract.lastReminderAt?.toISOString() || null,
        reminderCount: contract.reminderCount,
        expiresAt: contract.expiresAt?.toISOString() || null,
        signedAt: contract.signedAt?.toISOString() || null,
      } : null,
    }]
  })

  const standaloneContracts = await prisma.projectContract.findMany({
    where: {
      projectId: null,
      voidedAt: null,
      ...(auth.user.role === 'ADMIN' ? {} : { createdById: auth.user.id }),
      ...(q ? {
        OR: [
          { standaloneTitle: { contains: q, mode: 'insensitive' as const } },
          { client: { name: { contains: q, mode: 'insensitive' as const } } },
        ],
      } : {}),
    },
    include: {
      client: { select: { name: true, whatsapp: true, phone: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const allStandaloneItems = standaloneContracts.map((contract) => {
    let publicUrl: string | null = null
    try {
      publicUrl = projectContractUrl(req.nextUrl.origin, decryptProjectContractToken(contract.tokenEncrypted))
    } catch {
      publicUrl = null
    }
    return {
      id: contract.id,
      standalone: true,
      name: contract.standaloneTitle || 'Contrato avulso',
      clientName: contract.client?.name || 'Cliente não informado',
      clientPhone: contract.client?.whatsapp || contract.client?.phone || null,
      managerName: contract.createdBy?.name || 'Sem responsável',
      status: standaloneStatus(contract),
      contract: {
        id: contract.id,
        version: contract.version,
        publicUrl,
        sentAt: contract.sentAt?.toISOString() || null,
        viewedAt: contract.viewedAt?.toISOString() || null,
        lastReminderAt: contract.lastReminderAt?.toISOString() || null,
        reminderCount: contract.reminderCount,
        expiresAt: contract.expiresAt?.toISOString() || null,
        signedAt: contract.signedAt?.toISOString() || null,
      },
    }
  })
  const standaloneItems = status
    ? allStandaloneItems.filter((item) => item.status === status)
    : allStandaloneItems

  const countRow = countRows[0]
  const standaloneCounts = {
    all: allStandaloneItems.length,
    attention: allStandaloneItems.filter((item) => item.status === 'EXPIRED').length,
    waiting: allStandaloneItems.filter((item) => item.status === 'SENT' || item.status === 'VIEWED').length,
    signed: allStandaloneItems.filter((item) => item.status === 'SIGNED').length,
  }
  const counts = {
    all: Number(countRow?.all || 0) + standaloneCounts.all,
    attention: Number(countRow?.attention || 0) + standaloneCounts.attention,
    waiting: Number(countRow?.waiting || 0) + standaloneCounts.waiting,
    signed: Number(countRow?.signed || 0) + standaloneCounts.signed,
    legacy: Number(countRow?.legacy || 0),
  }
  const total = status ? Number(countRow?.filtered || 0) : Number(countRow?.all || 0)

  return NextResponse.json({
    items: rows,
    standaloneItems,
    standaloneTotal: standaloneItems.length,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    counts,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(
    `api:contracts:create:${auth.user.id}:${getClientIp(req)}`,
    12,
    60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 })
  }

  const parsed = createStandaloneSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Confira os dados do contrato.' },
      { status: 400 },
    )
  }
  if (parsed.data.paymentMethod === 'CARD' && parsed.data.downPayment >= parsed.data.value) {
    return NextResponse.json(
      { error: 'A entrada deve ser menor que o valor total do contrato.' },
      { status: 400 },
    )
  }

  const client = await prisma.client.findFirst({
    where: {
      id: parsed.data.clientId,
      archivedAt: null,
      ...(auth.user.role === 'ADMIN' ? {} : { managerId: auth.user.id }),
    },
  })
  if (!client) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

  try {
    const company = await prisma.companyProfile.findUnique({ where: { id: 'vertex' } })
    const snapshot = buildStandaloneContractSnapshot(parsed.data, client, company || {
      tradeName: 'Vertex Móveis',
      legalName: 'Vertex Móveis',
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
      const created = await tx.projectContract.create({
        data: {
          clientId: client.id,
          standaloneTitle: parsed.data.title,
          createdById: auth.user.id,
          version: 1,
          status: 'SENT',
          tokenHash: secureToken.tokenHash,
          tokenEncrypted: secureToken.tokenEncrypted,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          sentAt: now,
          expiresAt,
        },
      })
      await tx.activityLog.create({
        data: {
          userId: auth.user.id,
          action: 'Contrato avulso criado',
          details: `${parsed.data.title} · ${client.name}`,
        },
      })
      return created
    })
    return NextResponse.json({
      id: contract.id,
      publicUrl: projectContractUrl(req.nextUrl.origin, secureToken.token),
    }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar contrato avulso.', error)
    return serverError()
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const parsed = reminderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Informe o contrato.' }, { status: 400 })

  const now = new Date()
  const outcome = await prisma.$transaction(async (tx) => {
    const contract = await tx.projectContract.findFirst({
      where: {
        id: parsed.data.contractId,
        projectId: null,
        ...(auth.user.role === 'ADMIN' ? {} : { createdById: auth.user.id }),
      },
    })
    if (!contract) return { status: 404, error: 'Contrato não encontrado.' }
    if (contract.status !== 'SENT' || contract.signedAt || contract.voidedAt) {
      return { status: 409, error: 'Este contrato não está aguardando aceite.' }
    }
    if (contract.lastReminderAt && now.getTime() - contract.lastReminderAt.getTime() < REMINDER_INTERVAL_MS) {
      return { status: 429, error: 'O último lembrete foi registrado há menos de 24 horas.' }
    }
    const updated = await tx.projectContract.update({
      where: { id: contract.id },
      data: { lastReminderAt: now, reminderCount: { increment: 1 } },
      select: { lastReminderAt: true, reminderCount: true },
    })
    await tx.activityLog.create({
      data: {
        userId: auth.user.id,
        action: 'Lembrete de contrato avulso registrado',
        details: contract.standaloneTitle || contract.id,
      },
    })
    return { status: 200, ...updated }
  })
  if ('error' in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status })
  return NextResponse.json({
    success: true,
    lastReminderAt: outcome.lastReminderAt?.toISOString() || null,
    reminderCount: outcome.reminderCount,
  })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const contractId = req.nextUrl.searchParams.get('contractId')?.trim()
  if (!contractId) return NextResponse.json({ error: 'Informe o contrato.' }, { status: 400 })

  const result = await prisma.projectContract.updateMany({
    where: {
      id: contractId,
      projectId: null,
      signedAt: null,
      voidedAt: null,
      ...(auth.user.role === 'ADMIN' ? {} : { createdById: auth.user.id }),
    },
    data: { status: 'VOID', voidedAt: new Date() },
  })
  if (result.count !== 1) {
    return NextResponse.json({ error: 'Este contrato não pode mais ser cancelado.' }, { status: 409 })
  }
  await prisma.activityLog.create({
    data: { userId: auth.user.id, action: 'Contrato avulso cancelado', details: contractId },
  })
  return NextResponse.json({ success: true })
}
