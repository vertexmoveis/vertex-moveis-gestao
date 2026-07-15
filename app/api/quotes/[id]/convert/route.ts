import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildPaymentSchedule } from '@/lib/payments'
import { calculateProjectProductionDates } from '@/lib/business-days'
import { buildDefaultChecklistItems } from '@/lib/checklist'
import { normalizeEnvironmentNames } from '@/lib/project-environments'
import { buildProjectMaterialsFromQuoteItems } from '@/lib/project-materials'
import { badRequest, forbidden, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

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

  let body: { downPayment?: number; installmentCount?: number; firstInstallmentDate?: string; downPaymentDate?: string } = {}
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    return badRequest()
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id },
        include: {
          client: true,
          items: { orderBy: { position: 'asc' } },
        },
      })

      if (!quote) throw new Error('NOT_FOUND')
      if (auth.user.role !== 'ADMIN' && quote.createdById !== auth.user.id) throw new Error('FORBIDDEN')
      if (quote.convertedProjectId) throw new Error('ALREADY_CONVERTED')

      const approvalDate = new Date()
      const productionDates = calculateProjectProductionDates({ approvalDate })
      const environmentNames = normalizeEnvironmentNames(
        quote.items.map((item) => item.environment),
        quote.title
      )
      const room = environmentNames.length > 0 ? environmentNames.join(', ') : quote.title
      const quoteDownPayment = quote.paymentMethod === 'CARD' ? quote.cardDownPayment : 0
      const downPayment = Math.max(Number(body.downPayment ?? quoteDownPayment), 0)
      const quoteInstallments = quote.paymentMethod === 'CARD' ? quote.cardInstallments : 1
      const installmentCount = Math.max(Math.floor(Number(body.installmentCount ?? quoteInstallments)), 0)
      const firstInstallmentDate = body.firstInstallmentDate ? new Date(body.firstInstallmentDate) : null
      const downPaymentDate = body.downPaymentDate ? new Date(body.downPaymentDate) : approvalDate
      const schedule = buildPaymentSchedule({
        value: quote.total,
        downPayment,
        downPaymentDate,
        installmentCount,
        firstInstallmentDate,
        baseDate: approvalDate,
      })
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
          deliveryBusinessDays: 30,
          deliveryDeadlineDate: productionDates.deliveryDeadlineDate,
          productionReminderBusinessDays: 7,
          productionStartReminderDate: productionDates.productionStartReminderDate,
          startDate: approvalDate,
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
            quote.items.map((item) => `${item.environment}: ${item.description}`).join('\n'),
          ].filter(Boolean).join('\n\n'),
          payments: schedule.payments.length > 0 ? { create: schedule.payments } : undefined,
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

      await tx.quote.update({
        where: { id },
        data: {
          status: 'SOLD',
          approvedAt: quote.approvedAt || approvalDate,
          soldAt: approvalDate,
          convertedProjectId: project.id,
        },
      })

      await tx.timelineEvent.create({
        data: {
          projectId: project.id,
          event: 'Projeto criado do orçamento',
          description: `Orçamento "${quote.title}" convertido em projeto`,
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
    return serverError()
  }
}
