import type { Prisma } from '@prisma/client'

export const CLIENT_RELATIONSHIP_STAGES = {
  CONTACT: 'CONTACT',
  NEGOTIATING: 'NEGOTIATING',
  CUSTOMER: 'CUSTOMER',
  INACTIVE: 'INACTIVE',
} as const

export type ClientRelationshipStage =
  (typeof CLIENT_RELATIONSHIP_STAGES)[keyof typeof CLIENT_RELATIONSHIP_STAGES]

export const OPEN_QUOTE_STATUSES = ['DRAFT', 'SENT', 'WAITING_APPROVAL'] as const
export const CUSTOMER_QUOTE_STATUSES = ['APPROVED', 'SOLD'] as const

export const CLIENT_RELATIONSHIP_LABELS: Record<ClientRelationshipStage, string> = {
  CONTACT: 'Contato',
  NEGOTIATING: 'Em negociação',
  CUSTOMER: 'Cliente',
  INACTIVE: 'Inativo',
}

function normalizeDigits(value?: string | null) {
  const normalized = value?.replace(/\D/g, '') || ''
  return normalized || null
}

function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase() || ''
  return normalized || null
}

export function clientIdentityData(input: {
  document?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
}) {
  return {
    documentNormalized: normalizeDigits(input.document),
    phoneNormalized: normalizeDigits(input.phone),
    whatsappNormalized: normalizeDigits(input.whatsapp),
    emailNormalized: normalizeEmail(input.email),
  }
}

export function classifyClientRelationship(input: {
  currentStage?: string | null
  hasProject: boolean
  quoteStatuses: string[]
}): ClientRelationshipStage {
  if (input.currentStage === CLIENT_RELATIONSHIP_STAGES.CUSTOMER) {
    return CLIENT_RELATIONSHIP_STAGES.CUSTOMER
  }

  if (
    input.hasProject
    || input.quoteStatuses.some((status) => CUSTOMER_QUOTE_STATUSES.includes(status as never))
  ) {
    return CLIENT_RELATIONSHIP_STAGES.CUSTOMER
  }

  if (input.quoteStatuses.some((status) => OPEN_QUOTE_STATUSES.includes(status as never))) {
    return CLIENT_RELATIONSHIP_STAGES.NEGOTIATING
  }

  if (
    input.currentStage === CLIENT_RELATIONSHIP_STAGES.CONTACT
    && input.quoteStatuses.length > 0
  ) {
    return CLIENT_RELATIONSHIP_STAGES.CONTACT
  }

  if (input.quoteStatuses.length > 0) {
    return CLIENT_RELATIONSHIP_STAGES.INACTIVE
  }

  return CLIENT_RELATIONSHIP_STAGES.CONTACT
}

export function clientAttentionLevel(
  stage: string,
  lastActivityAt: Date | string | null,
  options: { noResponseDays?: number; closeSuggestionDays?: number } = {},
) {
  if (
    stage !== CLIENT_RELATIONSHIP_STAGES.CONTACT
    && stage !== CLIENT_RELATIONSHIP_STAGES.NEGOTIATING
  ) {
    return null
  }

  if (!lastActivityAt) return null

  const noResponseDays = options.noResponseDays ?? 30
  const closeSuggestionDays = options.closeSuggestionDays ?? 90
  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / 86_400_000),
  )

  if (elapsedDays >= closeSuggestionDays) {
    return { code: 'CLOSE_SUGGESTED', label: 'Encerrar negociação', elapsedDays }
  }

  if (elapsedDays >= noResponseDays) {
    return { code: 'NO_RESPONSE', label: 'Sem retorno', elapsedDays }
  }

  return null
}

type RelationshipDb = Prisma.TransactionClient

export async function findClientIdentityConflict(
  db: RelationshipDb,
  input: {
    document?: string | null
    phone?: string | null
    whatsapp?: string | null
    email?: string | null
  },
  excludeClientId?: string,
) {
  const identity = clientIdentityData(input)
  const baseWhere = {
    archivedAt: null,
    ...(excludeClientId ? { id: { not: excludeClientId } } : {}),
  }

  if (identity.documentNormalized) {
    const documentMatch = await db.client.findFirst({
      where: {
        ...baseWhere,
        documentNormalized: identity.documentNormalized,
      },
      select: { id: true, name: true },
    })
    if (documentMatch) return { kind: 'DOCUMENT' as const, client: documentMatch }
  }

  const contactValues = [
    identity.phoneNormalized,
    identity.whatsappNormalized,
  ].filter((value): value is string => Boolean(value))

  if (contactValues.length === 0 && !identity.emailNormalized) return null

  const possibleMatch = await db.client.findFirst({
    where: {
      ...baseWhere,
      OR: [
        ...(contactValues.length > 0
          ? [
            { phoneNormalized: { in: contactValues } },
            { whatsappNormalized: { in: contactValues } },
          ]
          : []),
        ...(identity.emailNormalized
          ? [{ emailNormalized: identity.emailNormalized }]
          : []),
      ],
    },
    select: { id: true, name: true },
  })

  return possibleMatch ? { kind: 'CONTACT' as const, client: possibleMatch } : null
}

export async function syncClientRelationshipStage(
  db: RelationshipDb,
  clientId: string,
  options: {
    activityAt?: Date
    inactiveReason?: string
    forceStage?: ClientRelationshipStage
  } = {},
) {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      relationshipStage: true,
      archivedAt: true,
      projects: {
        where: { archivedAt: null },
        take: 1,
        select: { id: true },
      },
      quotes: {
        where: { archivedAt: null },
        select: { status: true },
      },
    },
  })

  if (!client || client.archivedAt) return null

  const nextStage = options.forceStage ?? classifyClientRelationship({
    currentStage: client.relationshipStage,
    hasProject: client.projects.length > 0,
    quoteStatuses: client.quotes.map((quote) => quote.status),
  })
  const changed = nextStage !== client.relationshipStage
  const now = options.activityAt ?? new Date()

  if (!changed && !options.activityAt && !options.inactiveReason) {
    return nextStage
  }

  await db.client.update({
    where: { id: clientId },
    data: {
      relationshipStage: nextStage,
      ...(changed ? { relationshipStageChangedAt: now } : {}),
      ...(options.activityAt ? { lastCommercialActivityAt: options.activityAt } : {}),
      ...(nextStage === CLIENT_RELATIONSHIP_STAGES.INACTIVE
        ? {
          inactivatedAt: changed ? now : undefined,
          inactiveReason: options.inactiveReason ?? (changed ? 'Negociação encerrada' : undefined),
        }
        : {
          inactivatedAt: null,
          inactiveReason: null,
        }),
    },
  })

  return nextStage
}

export async function reconcileClientRelationshipStages(
  db: RelationshipDb,
  options: { take?: number } = {},
) {
  const clients = await db.client.findMany({
    where: { archivedAt: null },
    orderBy: { updatedAt: 'asc' },
    take: options.take ?? 500,
    select: { id: true },
  })

  let classified = 0
  const batchSize = 10

  for (let index = 0; index < clients.length; index += batchSize) {
    const batch = clients.slice(index, index + batchSize)
    const results = await Promise.all(
      batch.map((client) => syncClientRelationshipStage(db, client.id)),
    )
    classified += results.filter(Boolean).length
  }

  return {
    checked: clients.length,
    classified,
  }
}
