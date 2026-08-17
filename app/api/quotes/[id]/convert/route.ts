import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { buildPaymentSchedule } from '@/lib/payments'
import { calculateProjectProductionDates } from '@/lib/business-days'
import { dateOnlyKey, dateOnlyKeyInTimeZone, toDateOnlyUtc } from '@/lib/date-only'
import { buildDefaultChecklistItems } from '@/lib/checklist'
import { normalizeEnvironmentNames } from '@/lib/project-environments'
import { buildProjectMaterialsFromQuoteItems } from '@/lib/project-materials'
import { calculateProductionWeight } from '@/lib/operational-toolkit'
import { numberValue } from '@/lib/money'
import { badRequest, forbidden, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { syncClientRelationshipStage } from '@/lib/client-relationship'
import { automaticReservationQuantity } from '@/lib/inventory-reservations'
import { buildProjectMdfSpecificationsFromQuoteItems } from '@/lib/project-mdf-specifications'

const conversionSchema = z.object({
  paymentConfirmedAt: z.string().date(),
  entryPaymentMethod: z.enum(['PIX', 'DINHEIRO', 'CARTAO', 'BOLETO', 'TRANSFERENCIA']).optional(),
}).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:quotes:id:convert:${auth.user.id}:${id}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' }, { status: 429 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest()
  }
  const parsed = conversionSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Informe a data de confirmação do pagamento.')

  try {
    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id, archivedAt: null },
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
      if (auth.user.role !== 'ADMIN' && quote.createdById !== auth.user.id) throw new Error('FORBIDDEN')
      if (quote.convertedProjectId) throw new Error('ALREADY_CONVERTED')
      if (quote.status !== 'APPROVED' || !quote.approvedAt) throw new Error('NOT_APPROVED')
      if (quote.approvalRequests.length === 0) throw new Error('APPROVAL_PROOF_REQUIRED')
      if (quote.paymentMethod === 'TO_DEFINE') throw new Error('PAYMENT_TERMS_REQUIRED')

      const approvalDate = quote.approvedAt
      const paymentConfirmedAt = toDateOnlyUtc(parsed.data.paymentConfirmedAt)
      if (!paymentConfirmedAt) throw new Error('INVALID_PAYMENT_DATE')
      if ((dateOnlyKey(paymentConfirmedAt) || '') > dateOnlyKeyInTimeZone(new Date())) {
        throw new Error('FUTURE_PAYMENT_DATE')
      }
      const productionDates = calculateProjectProductionDates({
        approvalDate: paymentConfirmedAt,
        deliveryBusinessDays: quote.deliveryBusinessDays,
      })
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
      const downPayment = quote.paymentMethod === 'PIX'
        ? quoteTotal
        : Math.min(Math.max(numberValue(quote.cardDownPayment), 0), quoteTotal)
      const remainingBalance = Math.max(quoteTotal - downPayment, 0)
      const installmentCount = quote.paymentMethod === 'CARD' && remainingBalance > 0
        ? Math.max(Math.floor(Number(quote.cardInstallments)), 0)
        : 0
      if (remainingBalance > 0 && installmentCount < 1) throw new Error('INSTALLMENTS_REQUIRED')
      const firstInstallmentDate = installmentCount > 0
        ? quote.firstInstallmentDate
        : null
      if (installmentCount > 0 && !firstInstallmentDate) throw new Error('FIRST_INSTALLMENT_REQUIRED')
      if (quote.paymentMethod === 'CARD' && downPayment > 0 && !parsed.data.entryPaymentMethod) {
        throw new Error('ENTRY_PAYMENT_METHOD_REQUIRED')
      }
      const downPaymentDate = paymentConfirmedAt
      const schedule = buildPaymentSchedule({
        value: quoteTotal,
        downPayment,
        downPaymentDate,
        installmentCount,
        firstInstallmentDate,
        baseDate: paymentConfirmedAt,
      })
      const payments = schedule.payments.map((payment) => (
        payment.type === 'DOWN_PAYMENT'
          ? {
              ...payment,
              paidAt: paymentConfirmedAt,
              paymentMethod: quote.paymentMethod === 'PIX' ? 'PIX' : parsed.data.entryPaymentMethod,
            }
          : payment
      ))
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
          managerId: auth.user.role === 'ADMIN' ? quote.createdById : auth.user.id,
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
            userId: auth.user.id,
            action: 'Pagamento confirmado na criação do projeto',
            method: payment.paymentMethod,
            amount: payment.amount,
          })),
        })
      }

      await tx.quote.update({
        where: { id },
        data: {
          status: 'SOLD',
          approvedAt: quote.approvedAt || approvalDate,
          soldAt: paymentConfirmedAt,
          convertedProjectId: project.id,
        },
      })

      await tx.timelineEvent.create({
        data: {
          projectId: project.id,
          event: 'Projeto criado do orçamento',
          description: `Orçamento "${quote.title}" convertido após confirmação do pagamento`,
        },
      })

      await tx.activityLog.create({
        data: {
          userId: auth.user.id,
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

      await syncClientRelationshipStage(tx, quote.clientId, { activityAt: paymentConfirmedAt })
      return project
    })

    return NextResponse.json({ success: true, project: result })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbidden()
    if (error instanceof Error && error.message === 'ALREADY_CONVERTED') {
      return NextResponse.json({ error: 'Este orçamento já virou projeto.' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'NOT_APPROVED') {
      return badRequest('Aprove o orçamento antes de transformá-lo em projeto.')
    }
    if (error instanceof Error && error.message === 'APPROVAL_PROOF_REQUIRED') {
      return badRequest('O cliente precisa aprovar pelo link antes de transformar o orçamento em projeto.')
    }
    if (error instanceof Error && error.message === 'PAYMENT_TERMS_REQUIRED') {
      return badRequest('Defina a forma de pagamento no orçamento antes de criar o projeto.')
    }
    if (error instanceof Error && error.message === 'INVALID_PAYMENT_DATE') {
      return badRequest('Informe uma data válida para a confirmação do pagamento.')
    }
    if (error instanceof Error && error.message === 'FUTURE_PAYMENT_DATE') {
      return badRequest('A confirmação do pagamento não pode ter uma data futura.')
    }
    if (error instanceof Error && error.message === 'INSTALLMENTS_REQUIRED') {
      return badRequest('Informe ao menos uma parcela para distribuir o saldo restante.')
    }
    if (error instanceof Error && error.message === 'FIRST_INSTALLMENT_REQUIRED') {
      return badRequest('Informe a data da primeira parcela antes de criar o projeto.')
    }
    if (error instanceof Error && error.message === 'ENTRY_PAYMENT_METHOD_REQUIRED') {
      return badRequest('Informe como a entrada foi recebida antes de criar o projeto.')
    }
    return serverError()
  }
}
