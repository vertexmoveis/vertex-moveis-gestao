import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const QUOTE_GROUP_STATUS_PRIORITY = [
  'SOLD',
  'APPROVED',
  'WAITING_APPROVAL',
  'SENT',
  'DRAFT',
  'LOST',
] as const

export type QuoteGroupStatus = (typeof QUOTE_GROUP_STATUS_PRIORITY)[number]

type QuoteGroupCountsRow = {
  totalCount: number
  total: number
  expiredCount: number
  soldCount: number
  approvedCount: number
  waitingApprovalCount: number
  sentCount: number
  draftCount: number
  lostCount: number
}

type QuoteGroupIdRow = {
  id: string
}

type QuoteGroupListInput = {
  userId: string
  isAdmin: boolean
  query: string
  status: QuoteGroupStatus | null
  expiredOnly: boolean
  page: number
  pageSize: number
  today: Date
}

function buildSummaryCte(input: QuoteGroupListInput) {
  const scope = input.isAdmin
    ? Prisma.empty
    : Prisma.sql`AND groups."createdById" = ${input.userId}`
  const search = input.query
    ? Prisma.sql`
        AND (
          groups."title" ILIKE ${`%${input.query}%`}
          OR clients."name" ILIKE ${`%${input.query}%`}
          OR EXISTS (
            SELECT 1
            FROM "Quote" searched_quotes
            WHERE searched_quotes."groupId" = groups.id
              AND searched_quotes."archivedAt" IS NULL
              AND searched_quotes."variationName" ILIKE ${`%${input.query}%`}
          )
        )
      `
    : Prisma.empty

  return Prisma.sql`
    WITH summaries AS (
      SELECT
        groups.id,
        groups."updatedAt",
        CASE MIN(
          CASE quotes.status
            WHEN 'SOLD' THEN 1
            WHEN 'APPROVED' THEN 2
            WHEN 'WAITING_APPROVAL' THEN 3
            WHEN 'SENT' THEN 4
            WHEN 'DRAFT' THEN 5
            WHEN 'LOST' THEN 6
            ELSE 7
          END
        )
          WHEN 1 THEN 'SOLD'
          WHEN 2 THEN 'APPROVED'
          WHEN 3 THEN 'WAITING_APPROVAL'
          WHEN 4 THEN 'SENT'
          WHEN 5 THEN 'DRAFT'
          WHEN 6 THEN 'LOST'
          ELSE 'DRAFT'
        END AS status,
        BOOL_OR(
          quotes.status IN ('DRAFT', 'SENT', 'WAITING_APPROVAL', 'APPROVED')
          AND quotes."validUntil" IS NOT NULL
          AND quotes."validUntil" < ${input.today}
        ) AS expired
      FROM "QuoteGroup" groups
      INNER JOIN "Quote" quotes
        ON quotes."groupId" = groups.id
        AND quotes."archivedAt" IS NULL
      INNER JOIN "Client" clients ON clients.id = groups."clientId"
      WHERE TRUE
        ${scope}
        ${search}
      GROUP BY groups.id, groups."updatedAt"
    )
  `
}

export async function getQuoteGroupList(input: QuoteGroupListInput) {
  const cte = buildSummaryCte(input)
  const statusFilter = input.status
    ? Prisma.sql`AND status = ${input.status}`
    : Prisma.empty
  const expiredFilter = input.expiredOnly
    ? Prisma.sql`AND expired`
    : Prisma.empty
  const offset = (input.page - 1) * input.pageSize

  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw<QuoteGroupCountsRow[]>(Prisma.sql`
      ${cte}
      SELECT
        COUNT(*)::int AS "totalCount",
        COUNT(*) FILTER (WHERE TRUE ${statusFilter} ${expiredFilter})::int AS total,
        COUNT(*) FILTER (WHERE expired)::int AS "expiredCount",
        COUNT(*) FILTER (WHERE status = 'SOLD')::int AS "soldCount",
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS "approvedCount",
        COUNT(*) FILTER (WHERE status = 'WAITING_APPROVAL')::int AS "waitingApprovalCount",
        COUNT(*) FILTER (WHERE status = 'SENT')::int AS "sentCount",
        COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS "draftCount",
        COUNT(*) FILTER (WHERE status = 'LOST')::int AS "lostCount"
      FROM summaries
    `),
    prisma.$queryRaw<QuoteGroupIdRow[]>(Prisma.sql`
      ${cte}
      SELECT id
      FROM summaries
      WHERE TRUE
        ${statusFilter}
        ${expiredFilter}
      ORDER BY "updatedAt" DESC
      LIMIT ${input.pageSize}
      OFFSET ${offset}
    `),
  ])

  const counts = countRows[0] || {
    totalCount: 0,
    total: 0,
    expiredCount: 0,
    soldCount: 0,
    approvedCount: 0,
    waitingApprovalCount: 0,
    sentCount: 0,
    draftCount: 0,
    lostCount: 0,
  }

  return {
    groupIds: idRows.map((row) => row.id),
    total: counts.total,
    totalCount: counts.totalCount,
    expiredCount: counts.expiredCount,
    statusCounts: {
      SOLD: counts.soldCount,
      APPROVED: counts.approvedCount,
      WAITING_APPROVAL: counts.waitingApprovalCount,
      SENT: counts.sentCount,
      DRAFT: counts.draftCount,
      LOST: counts.lostCount,
    } satisfies Record<QuoteGroupStatus, number>,
  }
}
