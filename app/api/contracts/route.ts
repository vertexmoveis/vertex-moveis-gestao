import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  CONTRACT_CENTER_STATUSES,
  getContractCenterStatus,
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
  const where: Prisma.ProjectWhereInput = {
    archivedAt: null,
    contractRequirement: { not: 'WAIVED' },
    ...(auth.user.role === 'ADMIN' ? {} : { managerId: auth.user.id }),
    ...(q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { client: { name: { contains: q, mode: 'insensitive' } } },
      ],
    } : {}),
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 1000,
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

  const now = new Date()
  const priority: Record<ContractCenterStatus, number> = {
    NEEDS_REVISION: 0,
    EXPIRED: 1,
    NOT_SENT: 2,
    VIEWED: 3,
    SENT: 4,
    LEGACY: 5,
    SIGNED: 6,
  }
  const rows = projects.flatMap((project) => {
    const contract = project.contracts[0] || null
    const centerStatus = getContractCenterStatus({
      requirement: project.contractRequirement,
      revisionRequiredAt: project.contractRevisionRequiredAt,
      contract,
      now,
    })
    if (project.stage === 'COMPLETED' && centerStatus !== 'SIGNED') return []

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
      status: centerStatus,
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
  }).sort((left, right) => priority[left.status] - priority[right.status]
    || right.updatedAt.localeCompare(left.updatedAt))

  const counts = {
    all: rows.length,
    attention: rows.filter((row) => ['NOT_SENT', 'NEEDS_REVISION', 'EXPIRED'].includes(row.status)).length,
    waiting: rows.filter((row) => ['SENT', 'VIEWED'].includes(row.status)).length,
    signed: rows.filter((row) => row.status === 'SIGNED').length,
    legacy: rows.filter((row) => row.status === 'LEGACY').length,
  }
  const filtered = status ? rows.filter((row) => row.status === status) : rows
  const start = (page - 1) * pageSize

  return NextResponse.json({
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(filtered.length / pageSize), 1),
    counts,
  })
}
