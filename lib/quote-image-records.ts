import type { Prisma } from '@prisma/client'

export function serializeQuoteImage(image: {
  id: string
  environmentName: string
  name: string
  caption: string | null
  type: string
  size: number | null
  securityStatus: string
  securityDetails: string | null
  position: number
  createdAt: Date
}) {
  return {
    ...image,
    createdAt: image.createdAt.toISOString(),
  }
}

export async function invalidateQuoteGroupApprovals(
  tx: Prisma.TransactionClient,
  groupId: string,
) {
  const quotes = await tx.quote.findMany({ where: { groupId }, select: { id: true } })
  const quoteIds = quotes.map((quote) => quote.id)
  if (!quoteIds.length) return
  const now = new Date()
  await tx.quoteApprovalRequest.updateMany({
    where: {
      invalidatedAt: null,
      OR: [
        { quoteId: { in: quoteIds } },
        { comparisonQuoteId: { in: quoteIds } },
        { options: { some: { quoteId: { in: quoteIds } } } },
      ],
    },
    data: { invalidatedAt: now },
  })
  await tx.quote.updateMany({
    where: {
      id: { in: quoteIds },
      status: { in: ['SENT', 'WAITING_APPROVAL', 'APPROVED'] },
      convertedProjectId: null,
    },
    data: { status: 'DRAFT', sentAt: null, approvedAt: null },
  })
}
