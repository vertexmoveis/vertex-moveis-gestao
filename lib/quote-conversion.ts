import type { Prisma } from '@prisma/client'
import { buildPaymentSchedule } from '@/lib/payments'
import { calculateProjectProductionDates } from '@/lib/business-days'
import { dateOnlyKeyInTimeZone, toDateOnlyUtc } from '@/lib/date-only'
import { buildDefaultChecklistItems } from '@/lib/checklist'
import { normalizeEnvironmentNames } from '@/lib/project-environments'
import { buildProjectMaterialsFromQuoteItems } from '@/lib/project-materials'
import { calculateProductionWeight } from '@/lib/operational-toolkit'
import { numberValue } from '@/lib/money'
import { syncClientRelationshipStage } from '@/lib/client-relationship'
import { automaticReservationQuantity } from '@/lib/inventory-reservations'
import { buildProjectMdfSpecificationsFromQuoteItems } from '@/lib/project-mdf-specifications'
import { isQuoteInstallmentPaymentMethod } from '@/lib/quotes'

export type ConvertApprovedQuoteInput = {
  quoteId: string
  user: { id: string; role: string; name?: string | null }
  downPaymentDueDate?: string
  soldAt?: Date
}

/** Convert an approved quote inside a caller-owned transaction, using a verified actor. */
export async function convertApprovedQuote(tx: Prisma.TransactionClient, input: ConvertApprovedQuoteInput) {
  const { quoteId, user } = input
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') throw new Error('FORBIDDEN')

  // Serialize conversions across every option in the same quote group.
  await tx.$queryRaw`
    SELECT "id" FROM "QuoteGroup"
    WHERE "id" = (SELECT "groupId" FROM "Quote" WHERE "id" = ${quoteId})
    FOR UPDATE
  `

  const quote = await tx.quote.findFirst({
    where: { id: quoteId, archivedAt: null },
    include: {
      client: true,
      items: { orderBy: { position: 'asc' } },
      approvalRequests: {
        where: { approvedAt: { not: null }, invalidatedAt: null },
        orderBy: { approvedAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  })

  if (!quote) throw new Error('NOT_FOUND')
  if (user.role !== 'ADMIN' && quote.createdById !== user.id) throw new Error('FORBIDDEN')
  if (quote.convertedProjectId) throw new Error('ALREADY_CONVERTED')
  const soldOption = await tx.quote.findFirst({ where: { groupId: quote.groupId, convertedProjectId: { not: null } }, select: { id: true } })
  if (soldOption) throw new Error('ALREADY_CONVERTED')
  if (quote.status !== 'APPROVED' || !quote.approvedAt) throw new Error('NOT_APPROVED')
  if (quote.approvalRequests.length === 0) throw new Error('APPROVAL_PROOF_REQUIRED')
  if (quote.paymentMethod === 'TO_DEFINE') throw new Error('PAYMENT_TERMS_REQUIRED')

  const approvalDate = quote.approvedAt
  const soldAt = input.soldAt ?? new Date()
  const paymentConfirmedAt = null
  const environmentNames = normalizeEnvironmentNames(
    quote.items.map((item) => item.environmentName || item.environment),
    quote.title
  )
  const environmentNotes = new Map(environmentNames.map((environmentName) => [
    environmentName,
    quote.items
      .filter((item) => (item.environmentName || item.environment) === environmentName)
      .map((item) => `${item.description}${item.placement ? ` — ${item.placement}` : ''}`)
      .join('\n'),
  ]))
  const environmentMdfSpecifications = new Map(environmentNames.map((environmentName) => [
    environmentName,
    buildProjectMdfSpecificationsFromQuoteItems(
      quote.items.filter((item) => (item.environmentName || item.environment) === environmentName),
    ),
  ]))
  const room = environmentNames.length > 0 ? environmentNames.join(', ') : quote.title
  const quoteTotal = numberValue(quote.total)
  const quoteCostTotal = numberValue(quote.costTotal)
  const installmentPayment = isQuoteInstallmentPaymentMethod(quote.paymentMethod)
  const downPayment = quote.paymentMethod === 'PIX'
    ? quoteTotal
    : installmentPayment
      ? Math.min(Math.max(numberValue(quote.cardDownPayment), 0), quoteTotal)
      : 0
  const remainingBalance = Math.max(quoteTotal - downPayment, 0)
  const installmentCount = installmentPayment && remainingBalance > 0
    ? Math.max(Math.floor(Number(quote.cardInstallments)), 0)
    : 0
  if (remainingBalance > 0 && installmentCount < 1) throw new Error('INSTALLMENTS_REQUIRED')
  const firstInstallmentDate = installmentCount > 0
    ? quote.firstInstallmentDate
    : null
  if (installmentCount > 0 && !firstInstallmentDate) throw new Error('FIRST_INSTALLMENT_REQUIRED')
  const downPaymentDate = toDateOnlyUtc(input.downPaymentDueDate || dateOnlyKeyInTimeZone(soldAt))
  const productionDates = calculateProjectProductionDates({ approvalDate: downPayment > 0 ? null : soldAt, deliveryBusinessDays: quote.deliveryBusinessDays })
  const schedule = buildPaymentSchedule({
    value: quoteTotal,
    downPayment,
    downPaymentDate,
    installmentCount,
    firstInstallmentDate,
    baseDate: soldAt,
    markDownPaymentReceived: false,
  })
  const payments = schedule.payments
  const materialDrafts = buildProjectMaterialsFromQuoteItems(quote.items)
  const catalogMaterials = materialDrafts.length > 0
    ? await tx.materialCatalogItem.findMany({
        where: { name: { in: [...new Set(materialDrafts.map((material) => material.materialName))] } },
        select: { id: true, name: true, unit: true, stockQuantity: true },
      })
    : []
  const materialIds = new Map(catalogMaterials.map((material) => [material.name, material.id]))

  const project = await tx.project.create({
    data: {
      clientId: quote.clientId,
      name: quote.title,
      room,
      status: 'APPROVED',
      stage: 'PENDING_START',
      approvalDate,
      paymentConfirmedAt,
      initialPaymentRequired: downPayment > 0,
      deliveryBusinessDays: quote.deliveryBusinessDays,
      deliveryDeadlineDate: productionDates.deliveryDeadlineDate,
      productionReminderBusinessDays: 7,
      productionStartReminderDate: productionDates.productionStartReminderDate,
      startDate: paymentConfirmedAt,
      estimatedEndDate: productionDates.deliveryDeadlineDate,
      value: quoteTotal,
      productionCost: quoteCostTotal,
      productionWeight: calculateProductionWeight(environmentNames.length, quote.items),
      paymentMethod: quote.paymentMethod,
      paymentDiscount: quote.paymentDiscount,
      cardFeePercent: quote.cardFeePercent,
      cardFeeAmount: quote.cardFeeAmount,
      downPayment: schedule.terms.downPayment,
      downPaymentDate: schedule.terms.downPayment > 0 ? downPaymentDate : null,
      installmentCount: schedule.terms.installmentCount,
      installmentValue: schedule.terms.installmentValue,
      firstInstallmentDate,
      managerId: user.role === 'ADMIN' ? quote.createdById : user.id,
      internalNotes: [
        `Projeto criado a partir do orçamento "${quote.title}", opção "${quote.variationName}".`,
        quote.notes || '',
        quote.items.map((item) => `${item.environmentName || item.environment}: ${item.description}${item.placement ? ` — ${item.placement}` : ''}`).join('\n'),
      ].filter(Boolean).join('\n\n'),
      payments: payments.length > 0 ? { create: payments } : undefined,
      checklist: { create: buildDefaultChecklistItems() },
      environments: environmentNames.length > 0
        ? {
            create: environmentNames.map((name, index) => ({
              name,
              position: index + 1,
              status: 'PENDING',
              notes: environmentNotes.get(name) || null,
              mdfSpecifications: (environmentMdfSpecifications.get(name) || []) as Prisma.InputJsonValue,
            })),
          }
        : undefined,
      materials: materialDrafts.length > 0
        ? {
            create: materialDrafts.map((material) => ({
              ...material,
              materialId: materialIds.get(material.materialName) || null,
              status: 'PENDING',
            })),
          }
        : undefined,
    },
    select: { id: true, name: true },
  })

  const requiredByMaterial = new Map<string, number>()
  for (const material of materialDrafts) {
    const catalogMaterial = catalogMaterials.find((candidate) => candidate.name === material.materialName)
    if (!catalogMaterial || catalogMaterial.unit !== material.unit) continue
    requiredByMaterial.set(
      catalogMaterial.id,
      (requiredByMaterial.get(catalogMaterial.id) || 0) + material.estimatedQuantity,
    )
  }

  const materialIdsForReservation = [...requiredByMaterial.keys()]
  const activeReservations = materialIdsForReservation.length > 0
    ? await tx.inventoryReservation.groupBy({
        by: ['materialId'],
        where: { materialId: { in: materialIdsForReservation }, status: 'ACTIVE' },
        _sum: { quantity: true },
      })
    : []
  const activeReservedByMaterial = new Map(activeReservations.map((reservation) => [
    reservation.materialId,
    reservation._sum.quantity || 0,
  ]))
  const reservations = catalogMaterials.flatMap((material) => {
    const requiredQuantity = requiredByMaterial.get(material.id) || 0
    const quantity = automaticReservationQuantity({
      requiredQuantity,
      stockQuantity: material.stockQuantity,
      activeReservedQuantity: activeReservedByMaterial.get(material.id) || 0,
    })
    return quantity > 0 ? [{ projectId: project.id, materialId: material.id, quantity }] : []
  })
  if (reservations.length > 0) {
    await tx.inventoryReservation.createMany({ data: reservations })
  }

  const paidOnCreation = await tx.projectPayment.findMany({
    where: { projectId: project.id, paidAt: { not: null } },
    select: { id: true, amount: true, paymentMethod: true },
  })
  if (paidOnCreation.length > 0) {
    await tx.paymentHistory.createMany({
      data: paidOnCreation.map((payment) => ({
        paymentId: payment.id,
        userId: user.id,
        action: 'Pagamento confirmado na criação do projeto',
        method: payment.paymentMethod,
        amount: payment.amount,
      })),
    })
  }

  await tx.quote.update({
    where: { id: quoteId },
    data: {
      status: 'SOLD',
      approvedAt: quote.approvedAt || approvalDate,
      soldAt,
      convertedProjectId: project.id,
    },
  })

  await tx.timelineEvent.create({
    data: {
      projectId: project.id,
      event: 'Projeto criado do orçamento',
      description: `Venda registrada por ${user.name || user.id}. Orçamento "${quote.title}" em preparação; recebimentos, contrato e aprovação técnica serão conferidos separadamente.`,
    },
  })

  await tx.activityLog.create({
    data: {
      userId: user.id,
      projectId: project.id,
      action: 'Orçamento vendido',
      details: `Orçamento "${quote.title}" virou projeto`,
    },
  })

  if (reservations.length > 0) {
    await tx.timelineEvent.create({
      data: {
        projectId: project.id,
        event: 'Materiais reservados no estoque',
        description: `${reservations.length} ${reservations.length === 1 ? 'material foi separado' : 'materiais foram separados'} automaticamente para o projeto.`,
      },
    })
  }

  await syncClientRelationshipStage(tx, quote.clientId, { activityAt: soldAt })
  return project
}
