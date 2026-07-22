import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { buildPaymentSchedule } from '@/lib/payments'
import { calculateProjectProductionDates } from '@/lib/business-days'
import { dateOnlyKey, dateOnlyKeyInTimeZone, toDateOnlyUtc } from '@/lib/date-only'
import { buildDefaultChecklistItems } from '@/lib/checklist'
import { normalizeEnvironmentNames } from '@/lib/project-environments'
import { buildProjectMaterialsFromQuoteItems } from '@/lib/project-materials'
import { badRequest, forbidden, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

const conversionSchema = z.object({
  paymentConfirmedAt: z.string().date(),
  downPayment: z.coerce.number().min(0).optional(),
  installmentCount: z.coerce.number().int().min(0).max(24).optional(),
  firstInstallmentDate: z.string().date().optional(),
  downPaymentDate: z.string().date().optional(),
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
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

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
      const quote = await tx.quote.findUnique({
        where: { id },
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
      const room = environmentNames.length > 0 ? environmentNames.join(', ') : quote.title
      const requestedDownPayment = Number(parsed.data.downPayment ?? quote.cardDownPayment)
      if (quote.paymentMethod === 'CARD' && requestedDownPayment > quote.total) throw new Error('DOWN_PAYMENT_EXCEEDS_TOTAL')
      const downPayment = quote.paymentMethod === 'PIX'
        ? quote.total
        : Math.min(Math.max(requestedDownPayment, 0), quote.total)
      const remainingBalance = Math.max(quote.total - downPayment, 0)
      const requestedInstallments = Math.max(Math.floor(Number(parsed.data.installmentCount ?? quote.cardInstallments)), 0)
      const installmentCount = remainingBalance > 0 ? requestedInstallments : 0
      if (remainingBalance > 0 && installmentCount < 1) throw new Error('INSTALLMENTS_REQUIRED')
      const firstInstallmentDate = installmentCount > 0
        ? (parsed.data.firstInstallmentDate ? toDateOnlyUtc(parsed.data.firstInstallmentDate) : quote.firstInstallmentDate)
        : null
      if (installmentCount > 0 && !firstInstallmentDate) throw new Error('FIRST_INSTALLMENT_REQUIRED')
      const downPaymentDate = parsed.data.downPaymentDate ? toDateOnlyUtc(parsed.data.downPaymentDate) : paymentConfirmedAt
      const schedule = buildPaymentSchedule({
        value: quote.total,
        downPayment,
        downPaymentDate,
        installmentCount,
        firstInstallmentDate,
        baseDate: paymentConfirmedAt,
      })
      const payments = schedule.payments.map((payment) => (
        payment.type === 'DOWN_PAYMENT'
          ? { ...payment, paidAt: paymentConfirmedAt, paymentMethod: quote.paymentMethod }
          : payment
      ))
      const materialDrafts = buildProjectMaterialsFromQuoteItems(quote.items)
      const catalogMaterials = materialDrafts.length > 0
        ? await tx.materialCatalogItem.findMany({
            where: { name: { in: [...new Set(materialDrafts.map((material) => material.materialName))] } },
            select: { id: true, name: true },
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
          value: quote.total,
          productionCost: quote.costTotal,
          downPayment: schedule.terms.downPayment,
          downPaymentDate: schedule.terms.downPayment > 0 ? downPaymentDate : null,
          installmentCount: schedule.terms.installmentCount,
          installmentValue: schedule.terms.installmentValue,
          firstInstallmentDate,
          managerId: auth.user.role === 'ADMIN' ? quote.createdById : auth.user.id,
          internalNotes: [
            `Projeto criado a partir do orçamento "${quote.title}".`,
            quote.notes || '',
            quote.items.map((item) => `${item.environmentName || item.environment}: ${item.description}`).join('\n'),
          ].filter(Boolean).join('\n\n'),
          payments: payments.length > 0 ? { create: payments } : undefined,
          checklist: { create: buildDefaultChecklistItems() },
          environments: environmentNames.length > 0
            ? {
                create: environmentNames.map((name, index) => ({
                  name,
                  position: index + 1,
                  status: 'PENDING',
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
    if (error instanceof Error && error.message === 'INVALID_PAYMENT_DATE') {
      return badRequest('Informe uma data válida para a confirmação do pagamento.')
    }
    if (error instanceof Error && error.message === 'FUTURE_PAYMENT_DATE') {
      return badRequest('A confirmação do pagamento não pode ter uma data futura.')
    }
    if (error instanceof Error && error.message === 'DOWN_PAYMENT_EXCEEDS_TOTAL') {
      return badRequest('A entrada não pode ser maior que o total do orçamento.')
    }
    if (error instanceof Error && error.message === 'INSTALLMENTS_REQUIRED') {
      return badRequest('Informe ao menos uma parcela para distribuir o saldo restante.')
    }
    if (error instanceof Error && error.message === 'FIRST_INSTALLMENT_REQUIRED') {
      return badRequest('Informe a data da primeira parcela antes de criar o projeto.')
    }
    return serverError()
  }
}
