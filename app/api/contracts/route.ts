import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  CONTRACT_CENTER_STATUSES,
  type ContractCenterStatus,
} from '@/lib/contract-center'
import { decryptProjectContractToken, projectContractUrl } from '@/lib/project-contracts'
import { getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

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

  const countRow = countRows[0]
  const counts = {
    all: Number(countRow?.all || 0),
    attention: Number(countRow?.attention || 0),
    waiting: Number(countRow?.waiting || 0),
    signed: Number(countRow?.signed || 0),
    legacy: Number(countRow?.legacy || 0),
  }
  const total = status ? Number(countRow?.filtered || 0) : counts.all

  return NextResponse.json({
    items: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    counts,
  })
}
