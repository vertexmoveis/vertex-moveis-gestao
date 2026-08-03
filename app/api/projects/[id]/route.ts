import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { projectPatchSchema, projectUpdateSchema } from '@/lib/schemas'
import {
  buildPaymentSchedule,
  financialScheduleChanged,
  PAYMENT_TYPE_INSTALLMENT,
  PaymentScheduleConflictError,
  reconcilePaymentSchedule,
} from '@/lib/payments'
import { calculateProjectProductionDates } from '@/lib/business-days'
import { ensureProjectChecklist } from '@/lib/checklist'
import {
  ensureProjectEnvironmentsFromRoom,
  serializeEnvironment,
  summarizeEnvironments,
  syncProjectEnvironments,
} from '@/lib/project-environments'
import {
  normalizeProductionStage,
  PRODUCTION_STAGE_STATUS,
  type ProductionStage,
  type ProjectEnvironmentStatus,
} from '@/types'
import {
  badRequest,
  canAccessProject,
  forbidden,
  getClientIp,
  requireAuth,
  requireRole,
  serverError,
  serviceUnavailable,
} from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { calculateProjectCostSummary } from '@/lib/project-costs'
import { moneyValue, optionalMoneyValue } from '@/lib/money'
import { syncClientRelationshipStage } from '@/lib/client-relationship'
import { calculateProjectPaymentPlan } from '@/lib/project-payment-plan'
import {
  getProjectContractReadiness,
  getProjectFinancialReadiness,
  type ProjectContractWorkflowStatus,
} from '@/lib/project-workflow'
import {
  getProjectMacroPhase,
  getProjectMacroPhaseIndex,
  getProjectPhaseBlockers,
  getProjectPhaseTasks,
} from '@/lib/project-phases'

function addCalendarDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function addCalendarYear(date: Date) {
  const result = new Date(date)
  result.setFullYear(result.getFullYear() + 1)
  return result
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:projects:id:get:${auth.user.id}:${id}:${getClientIp(req)}`, 120, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const access = await prisma.project.findFirst({
    where: { id, archivedAt: null },
    select: {
      managerId: true,
      downPayment: true,
      paymentConfirmedAt: true,
      payments: { select: { type: true, amount: true, paidAt: true, dueDate: true } },
    },
  })
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canAccessProject(auth.user, access.managerId)) return forbidden()

  const project = await prisma.project.findFirst({
    where: { id, archivedAt: null },
    select: {
      id: true,
      name: true,
      room: true,
      status: true,
      stage: true,
      approvalDate: true,
      paymentConfirmedAt: true,
      deliveryBusinessDays: true,
      deliveryDeadlineDate: true,
      productionReminderBusinessDays: true,
      productionStartReminderDate: true,
      startDate: true,
      estimatedEndDate: true,
      actualEndDate: true,
      postSaleFollowUpAt: true,
      postSaleContactedAt: true,
      warrantyEndsAt: true,
      value: auth.user.role === 'ADMIN',
      productionCost: auth.user.role === 'ADMIN',
      paymentMethod: auth.user.role === 'ADMIN',
      paymentDiscount: auth.user.role === 'ADMIN',
      cardFeePercent: auth.user.role === 'ADMIN',
      cardFeeAmount: auth.user.role === 'ADMIN',
      downPayment: auth.user.role === 'ADMIN',
      downPaymentDate: auth.user.role === 'ADMIN',
      installmentCount: auth.user.role === 'ADMIN',
      installmentValue: auth.user.role === 'ADMIN',
      firstInstallmentDate: auth.user.role === 'ADMIN',
      internalNotes: auth.user.role === 'ADMIN',
      productionBlockedAt: true,
      productionBlockReason: true,
      stageDeadlineDate: true,
      contractRevisionRequiredAt: true,
      createdAt: true,
      updatedAt: true,
      client: {
        select: {
          id: true,
          name: true,
          phone: true,
          whatsapp: true,
          email: auth.user.role === 'ADMIN',
          address: auth.user.role === 'ADMIN',
          createdAt: true,
          updatedAt: true,
        },
      },
      manager: { select: { id: true, name: true, email: auth.user.role === 'ADMIN' } },
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      files: {
        where: { securityStatus: { not: 'REJECTED' } },
        orderBy: { createdAt: 'desc' },
      },
      timeline: { select: { id: true, event: true, description: true, date: true, createdAt: true }, orderBy: { date: 'asc' } },
      payments: auth.user.role === 'ADMIN'
        ? {
            select: {
              id: true,
              installmentNumber: true,
              type: true,
              amount: true,
              dueDate: true,
              paidAt: true,
              paymentMethod: true,
              createdAt: true,
              updatedAt: true,
              history: {
                select: {
                  id: true,
                  action: true,
                  method: true,
                  amount: true,
                  createdAt: true,
                  user: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
            orderBy: [{ installmentNumber: 'asc' }, { dueDate: 'asc' }],
          }
        : false,
      checklist: {
        select: { id: true, label: true, position: true, completedAt: true, createdAt: true, updatedAt: true },
        orderBy: { position: 'asc' },
      },
      environments: {
        select: { id: true, name: true, status: true, position: true, notes: true, startedAt: true, completedAt: true, createdAt: true, updatedAt: true },
        orderBy: { position: 'asc' },
      },
      materials: auth.user.role === 'ADMIN'
        ? { select: { estimatedCost: true, actualCost: true } }
        : false,
      expenses: auth.user.role === 'ADMIN'
        ? { select: { amount: true } }
        : false,
      contracts: {
        orderBy: { version: 'desc' },
        take: 1,
        select: {
          id: true,
          version: true,
          status: true,
          sentAt: true,
          viewedAt: true,
          expiresAt: true,
          signedAt: true,
          signatoryName: true,
        },
      },
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let checklist = project.checklist
  const environments = await ensureProjectEnvironmentsFromRoom(id, project.room)
  checklist = await ensureProjectChecklist(id, prisma, checklist)
  const costSummary = auth.user.role === 'ADMIN' && 'materials' in project && Array.isArray(project.materials)
    ? calculateProjectCostSummary(
        project.productionCost,
        project.materials,
        'expenses' in project && Array.isArray(project.expenses) ? project.expenses : [],
      )
    : null
  const currentContract = project.contracts[0] || null
  const contractStatus = currentContract?.expiresAt
    && currentContract.expiresAt.getTime() < Date.now()
    && !currentContract.signedAt
      ? 'EXPIRED'
      : (currentContract?.status || 'NONE') as ProjectContractWorkflowStatus
  const financialReadiness = getProjectFinancialReadiness({
    paymentConfirmedAt: access.paymentConfirmedAt,
    downPayment: access.downPayment,
    payments: access.payments,
  })
  const contractReadiness = getProjectContractReadiness({
    createdAt: project.createdAt,
    contractStatus,
    viewedAt: currentContract?.viewedAt,
    revisionRequiredAt: project.contractRevisionRequiredAt,
  })

  return NextResponse.json({
    ...project,
    value: 'value' in project ? optionalMoneyValue(project.value) : null,
    productionCost: 'productionCost' in project ? optionalMoneyValue(project.productionCost) : null,
    paymentDiscount: 'paymentDiscount' in project ? optionalMoneyValue(project.paymentDiscount) : null,
    cardFeeAmount: 'cardFeeAmount' in project ? optionalMoneyValue(project.cardFeeAmount) : null,
    downPayment: 'downPayment' in project ? optionalMoneyValue(project.downPayment) : null,
    installmentValue: 'installmentValue' in project ? optionalMoneyValue(project.installmentValue) : null,
    approvalDate: project.approvalDate?.toISOString() || null,
    paymentConfirmedAt: project.paymentConfirmedAt?.toISOString() || null,
    deliveryDeadlineDate: project.deliveryDeadlineDate?.toISOString() || null,
    productionStartReminderDate: project.productionStartReminderDate?.toISOString() || null,
    startDate: project.startDate?.toISOString() || null,
    estimatedEndDate: project.estimatedEndDate?.toISOString() || null,
    actualEndDate: project.actualEndDate?.toISOString() || null,
    postSaleFollowUpAt: project.postSaleFollowUpAt?.toISOString() || null,
    postSaleContactedAt: project.postSaleContactedAt?.toISOString() || null,
    warrantyEndsAt: project.warrantyEndsAt?.toISOString() || null,
    productionBlockedAt: project.productionBlockedAt?.toISOString() || null,
    stageDeadlineDate: project.stageDeadlineDate?.toISOString() || null,
    contractRevisionRequiredAt: project.contractRevisionRequiredAt?.toISOString() || null,
    downPaymentDate: 'downPaymentDate' in project && project.downPaymentDate ? project.downPaymentDate.toISOString() : null,
    firstInstallmentDate: 'firstInstallmentDate' in project && project.firstInstallmentDate ? project.firstInstallmentDate.toISOString() : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    canOverridePhase: auth.user.role === 'ADMIN',
    workflow: {
      financial: financialReadiness,
      contract: contractReadiness,
    },
    contractSummary: currentContract ? {
      ...currentContract,
      status: contractStatus,
      sentAt: currentContract.sentAt?.toISOString() || null,
      viewedAt: currentContract.viewedAt?.toISOString() || null,
      expiresAt: currentContract.expiresAt?.toISOString() || null,
      signedAt: currentContract.signedAt?.toISOString() || null,
    } : null,
    contracts: undefined,
    client: {
      ...project.client,
      createdAt: project.client.createdAt.toISOString(),
      updatedAt: project.client.updatedAt.toISOString(),
    },
    notes: project.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    files: 'files' in project && Array.isArray(project.files) ? project.files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })) : [],
    payments: 'payments' in project && Array.isArray(project.payments)
      ? project.payments.map((payment) => ({
          ...payment,
          amount: moneyValue(payment.amount),
          dueDate: payment.dueDate.toISOString(),
          paidAt: payment.paidAt?.toISOString() || null,
          history: ('history' in payment && Array.isArray(payment.history) ? payment.history : []).map((history) => ({
              ...history,
              amount: moneyValue(history.amount),
              createdAt: history.createdAt.toISOString(),
            })),
          createdAt: payment.createdAt.toISOString(),
          updatedAt: payment.updatedAt.toISOString(),
        }))
      : [],
    checklist: checklist.map((item) => ({
      ...item,
      completedAt: item.completedAt?.toISOString() || null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    environments: environments.map(serializeEnvironment),
    environmentSummary: summarizeEnvironments(environments),
    costSummary,
    timeline: project.timeline.map((t) => ({
      ...t,
      date: t.date.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:projects:id:put:${auth.user.id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
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

  const parsed = projectUpdateSchema.safeParse(body)
  if (!parsed.success) return badRequest()

  try {
    const input = parsed.data
    const stage = normalizeProductionStage(input.stage as ProductionStage)
    const project = await prisma.$transaction(async (tx) => {
      const existing = await tx.project.findFirst({
        where: { id, archivedAt: null },
        include: {
          payments: {
            select: {
              id: true,
              installmentNumber: true,
              type: true,
              amount: true,
              dueDate: true,
              paidAt: true,
            },
          },
          contracts: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { id: true, status: true },
          },
        },
      })
      if (!existing) throw new PaymentScheduleConflictError('Projeto não encontrado.')

      const productionDates = calculateProjectProductionDates({
        approvalDate: input.paymentConfirmedAt || input.approvalDate,
        deliveryBusinessDays: input.deliveryBusinessDays,
        reminderBusinessDays: input.productionReminderBusinessDays,
      })
      const estimatedEndDate = productionDates.deliveryDeadlineDate || input.estimatedEndDate
      const completedAt = stage === 'COMPLETED' ? existing.actualEndDate || new Date() : existing.actualEndDate
      const postSaleFollowUpAt = stage === 'COMPLETED'
        ? existing.postSaleFollowUpAt || addCalendarDays(completedAt || new Date(), 30)
        : existing.postSaleFollowUpAt
      const warrantyEndsAt = stage === 'COMPLETED'
        ? existing.warrantyEndsAt || addCalendarYear(completedAt || new Date())
        : existing.warrantyEndsAt
      const paymentPlan = calculateProjectPaymentPlan({
        value: input.value,
        paymentMethod: input.paymentMethod,
        paymentDiscount: input.paymentDiscount,
        cardFeePercent: input.cardFeePercent,
        downPayment: input.downPayment,
        downPaymentDate: input.downPaymentDate,
        installmentCount: input.installmentCount,
        firstInstallmentDate: input.firstInstallmentDate,
        paymentConfirmedAt: input.paymentConfirmedAt,
        baseDate: input.startDate || existing.startDate || existing.createdAt,
      })
      const scheduleInput = {
        value: input.value,
        downPayment: paymentPlan.downPayment,
        downPaymentDate: paymentPlan.downPaymentDate,
        installmentCount: paymentPlan.installmentCount,
        firstInstallmentDate: paymentPlan.firstInstallmentDate,
        baseDate: paymentPlan.baseDate,
        startDate: input.startDate,
      }
      const schedule = buildPaymentSchedule(scheduleInput)
      const effectiveFirstInstallmentDate = schedule.payments.find(
        (payment) => payment.type === PAYMENT_TYPE_INSTALLMENT,
      )?.dueDate || null
      const shouldReconcilePayments = financialScheduleChanged(existing, scheduleInput)
      const paymentChanges = shouldReconcilePayments
        ? reconcilePaymentSchedule(schedule, existing.payments)
        : null

      const environments = await syncProjectEnvironments(id, input.environments, input.room, tx)
      const room = environments.length > 0
        ? environments.map((environment) => environment.name).join(', ')
        : input.room
      const dateTime = (value: Date | null | undefined) => value?.getTime() || 0
      const contractTermsChanged = Boolean(
        existing.contracts.length > 0
        && (
          existing.clientId !== input.clientId
          || existing.name !== input.name
          || (existing.room || '') !== (room || '')
          || moneyValue(existing.value) !== moneyValue(input.value)
          || existing.paymentMethod !== paymentPlan.paymentMethod
          || moneyValue(existing.paymentDiscount) !== paymentPlan.paymentDiscount
          || Number(existing.cardFeePercent) !== paymentPlan.cardFeePercent
          || moneyValue(existing.cardFeeAmount) !== paymentPlan.cardFeeAmount
          || moneyValue(existing.downPayment) !== schedule.terms.downPayment
          || existing.installmentCount !== schedule.terms.installmentCount
          || dateTime(existing.firstInstallmentDate) !== dateTime(effectiveFirstInstallmentDate)
          || existing.deliveryBusinessDays !== input.deliveryBusinessDays
          || dateTime(existing.approvalDate) !== dateTime(input.approvalDate)
        )
      )
      const contractRevisionRequiredAt = contractTermsChanged
        ? new Date()
        : existing.contractRevisionRequiredAt

      const updatedProject = await tx.project.update({
        where: { id },
        data: {
          clientId: input.clientId,
          name: input.name,
          room,
          status: input.status,
          stage,
          approvalDate: input.approvalDate,
          paymentConfirmedAt: input.paymentConfirmedAt,
          deliveryBusinessDays: input.deliveryBusinessDays,
          deliveryDeadlineDate: productionDates.deliveryDeadlineDate,
          productionReminderBusinessDays: input.productionReminderBusinessDays,
          productionStartReminderDate: productionDates.productionStartReminderDate,
          startDate: input.startDate,
          estimatedEndDate,
          actualEndDate: completedAt,
          postSaleFollowUpAt,
          warrantyEndsAt,
          value: input.value,
          productionCost: input.productionCost || 0,
          paymentMethod: paymentPlan.paymentMethod,
          paymentDiscount: paymentPlan.paymentDiscount,
          cardFeePercent: paymentPlan.cardFeePercent,
          cardFeeAmount: paymentPlan.cardFeeAmount,
          downPayment: schedule.terms.downPayment,
          downPaymentDate: paymentPlan.downPaymentDate,
          installmentCount: schedule.terms.installmentCount,
          installmentValue: schedule.terms.installmentValue,
          firstInstallmentDate: effectiveFirstInstallmentDate,
          managerId: input.managerId,
          internalNotes: input.internalNotes,
          contractRevisionRequiredAt,
        },
        include: {
          client: { select: { id: true, name: true, phone: true, whatsapp: true } },
          manager: { select: { id: true, name: true } },
          environments: { orderBy: { position: 'asc' } },
        },
      })

      if (paymentChanges) {
        if (paymentChanges.deleteIds.length > 0) {
          await tx.projectPayment.deleteMany({ where: { id: { in: paymentChanges.deleteIds } } })
        }

        for (const payment of paymentChanges.updates) {
          await tx.projectPayment.update({
            where: { id: payment.id },
            data: {
              amount: payment.amount,
              dueDate: payment.dueDate,
              paidAt: payment.paidAt,
            },
          })
        }

        if (paymentChanges.creates.length > 0) {
          await tx.projectPayment.createMany({
            data: paymentChanges.creates.map((payment) => ({ ...payment, projectId: id })),
          })
        }
      }

      await ensureProjectChecklist(id, tx)

      if (existing.status !== updatedProject.status || existing.stage !== updatedProject.stage) {
        await tx.activityLog.create({
          data: {
            userId: auth.user.id,
            projectId: id,
            action: 'Projeto atualizado',
            details: `Status: ${updatedProject.status} | Etapa: ${updatedProject.stage}`,
          },
        })
      }

      if (contractTermsChanged) {
        await tx.projectContract.updateMany({
          where: {
            projectId: id,
            status: { in: ['DRAFT', 'SENT'] },
            signedAt: null,
            voidedAt: null,
          },
          data: { status: 'VOID', voidedAt: contractRevisionRequiredAt },
        })
        await tx.timelineEvent.create({
          data: {
            projectId: id,
            event: 'Contrato precisa de nova versão',
            description: 'Os dados comerciais do projeto foram alterados. O link anterior foi cancelado.',
          },
        })
        await tx.activityLog.create({
          data: {
            userId: auth.user.id,
            projectId: id,
            action: 'Contrato invalidado após alteração',
            details: 'Uma nova versão deve ser gerada com os dados atualizados.',
          },
        })
      }

      await syncClientRelationshipStage(tx, input.clientId, { activityAt: new Date() })
      if (existing.clientId !== input.clientId) {
        await syncClientRelationshipStage(tx, existing.clientId)
      }

      return updatedProject
    })

    return NextResponse.json({
      ...project,
      value: optionalMoneyValue(project.value),
      productionCost: optionalMoneyValue(project.productionCost),
      paymentDiscount: optionalMoneyValue(project.paymentDiscount),
      cardFeeAmount: optionalMoneyValue(project.cardFeeAmount),
      downPayment: optionalMoneyValue(project.downPayment),
      installmentValue: optionalMoneyValue(project.installmentValue),
      approvalDate: project.approvalDate?.toISOString() || null,
      paymentConfirmedAt: project.paymentConfirmedAt?.toISOString() || null,
      deliveryDeadlineDate: project.deliveryDeadlineDate?.toISOString() || null,
      productionStartReminderDate: project.productionStartReminderDate?.toISOString() || null,
      startDate: project.startDate?.toISOString() || null,
      estimatedEndDate: project.estimatedEndDate?.toISOString() || null,
      actualEndDate: project.actualEndDate?.toISOString() || null,
      postSaleFollowUpAt: project.postSaleFollowUpAt?.toISOString() || null,
      postSaleContactedAt: project.postSaleContactedAt?.toISOString() || null,
      warrantyEndsAt: project.warrantyEndsAt?.toISOString() || null,
      downPaymentDate: project.downPaymentDate?.toISOString() || null,
      firstInstallmentDate: project.firstInstallmentDate?.toISOString() || null,
      environments: project.environments.map(serializeEnvironment),
      environmentSummary: summarizeEnvironments(project.environments),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      contractRevisionRequiredAt: project.contractRevisionRequiredAt?.toISOString() || null,
    })
  } catch (error) {
    if (error instanceof PaymentScheduleConflictError) {
      const status = error.message === 'Projeto não encontrado.' ? 404 : 409
      return NextResponse.json({ error: error.message }, { status })
    }
    return serverError()
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:projects:id:patch:${auth.user.id}:${getClientIp(req)}`, 60, 60 * 1000).catch((error) => {
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

  const parsed = projectPatchSchema.safeParse(body)
  if (!parsed.success) return badRequest()

  try {
    const existing = await prisma.project.findFirst({
      where: { id, archivedAt: null },
      select: {
        managerId: true,
        stage: true,
        createdAt: true,
        approvalDate: true,
        paymentConfirmedAt: true,
        downPayment: true,
        actualEndDate: true,
        postSaleFollowUpAt: true,
        warrantyEndsAt: true,
        productionBlockedAt: true,
        contractRevisionRequiredAt: true,
        environments: { select: { status: true } },
        files: {
          where: { securityStatus: { not: 'REJECTED' } },
          select: { category: true },
        },
        payments: { select: { type: true, amount: true, paidAt: true, dueDate: true } },
        contracts: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { status: true, viewedAt: true, expiresAt: true, signedAt: true },
        },
        client: { select: { whatsapp: true, phone: true } },
        postSaleContactedAt: true,
      },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!canAccessProject(auth.user, existing.managerId)) return forbidden()

    const nextStage = parsed.data.stage
      ? normalizeProductionStage(parsed.data.stage as ProductionStage)
      : undefined
    const stageOverrideReason = parsed.data.stageOverrideReason?.trim() || null
    if (stageOverrideReason && auth.user.role !== 'ADMIN') return forbidden()

    if (nextStage && nextStage !== existing.stage) {
      const currentPhase = getProjectMacroPhase(existing.stage as ProductionStage)
      const targetPhase = getProjectMacroPhase(nextStage)
      const advancingMacroPhase = getProjectMacroPhaseIndex(targetPhase) > getProjectMacroPhaseIndex(currentPhase)

      if (advancingMacroPhase) {
        const currentContract = existing.contracts[0] || null
        const contractStatus = currentContract?.expiresAt
          && currentContract.expiresAt.getTime() < Date.now()
          && !currentContract.signedAt
            ? 'EXPIRED'
            : (currentContract?.status || 'NONE') as ProjectContractWorkflowStatus
        const financialReadiness = getProjectFinancialReadiness({
          paymentConfirmedAt: existing.paymentConfirmedAt,
          downPayment: existing.downPayment,
          payments: existing.payments,
        })
        const blockers = getProjectPhaseBlockers(getProjectPhaseTasks({
          stage: existing.stage as ProductionStage,
          createdAt: existing.createdAt.toISOString(),
          approvalDate: existing.approvalDate?.toISOString() || null,
          paymentConfirmedAt: existing.paymentConfirmedAt?.toISOString() || null,
          downPayment: moneyValue(existing.downPayment),
          financialReady: financialReadiness.ready,
          contractStatus,
          contractViewedAt: currentContract?.viewedAt?.toISOString() || null,
          contractRevisionRequiredAt: existing.contractRevisionRequiredAt?.toISOString() || null,
          productionBlockedAt: existing.productionBlockedAt?.toISOString() || null,
          environments: existing.environments.map((environment) => ({ status: environment.status as ProjectEnvironmentStatus })),
          files: existing.files,
          payments: existing.payments,
          clientPhone: existing.client.whatsapp || existing.client.phone,
          postSaleContactedAt: existing.postSaleContactedAt?.toISOString() || null,
        }, currentPhase))

        if (blockers.length > 0 && !stageOverrideReason) {
          return NextResponse.json({
            error: `Resolva antes de avançar: ${blockers.join('; ')}.`,
            blockers,
          }, { status: 409 })
        }
      }
    }
    const actualEndDate =
      nextStage === 'COMPLETED'
        ? parsed.data.actualEndDate ?? existing.actualEndDate ?? new Date()
        : nextStage
          ? parsed.data.actualEndDate ?? null
          : parsed.data.actualEndDate
    const { productionBlocked, stageOverrideReason: _stageOverrideReason, ...patchData } = parsed.data
    void _stageOverrideReason
    const data = {
      ...patchData,
      ...(nextStage ? { stage: nextStage } : {}),
      status:
        nextStage && !parsed.data.status
          ? PRODUCTION_STAGE_STATUS[nextStage]
          : parsed.data.status,
      actualEndDate,
      ...(productionBlocked === undefined
        ? {}
        : productionBlocked
          ? { productionBlockedAt: existing.productionBlockedAt || new Date() }
          : { productionBlockedAt: null, productionBlockReason: null }),
      ...(nextStage && nextStage !== existing.stage && productionBlocked === undefined
        ? { productionBlockedAt: null, productionBlockReason: null }
        : {}),
      ...(nextStage === 'COMPLETED'
        ? {
            postSaleFollowUpAt: existing.postSaleFollowUpAt || addCalendarDays(actualEndDate || new Date(), 30),
            warrantyEndsAt: existing.warrantyEndsAt || addCalendarYear(actualEndDate || new Date()),
          }
        : {}),
    }

    const project = await prisma.project.update({
      where: { id },
      data,
      select: {
        stage: true,
        status: true,
        actualEndDate: true,
        postSaleFollowUpAt: true,
        postSaleContactedAt: true,
        warrantyEndsAt: true,
        productionBlockedAt: true,
        productionBlockReason: true,
        stageDeadlineDate: true,
      },
    })

    if (nextStage && nextStage !== existing.stage) {
      await prisma.timelineEvent.create({
        data: {
          projectId: id,
          event: nextStage === 'COMPLETED' ? 'Projeto concluído' : 'Etapa atualizada',
          description: nextStage === 'COMPLETED'
            ? 'Pós-venda agendado automaticamente para 30 dias após a conclusão.'
            : stageOverrideReason
              ? `Avanço manual para ${nextStage}. Justificativa: ${stageOverrideReason}`
              : `Projeto avançou para ${nextStage}.`,
        },
      })
    }

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        projectId: id,
        action: 'Projeto atualizado',
        details: `Status: ${project.status} | Etapa: ${project.stage}${stageOverrideReason ? ` | Avanço manual: ${stageOverrideReason}` : ''}`,
      },
    })

    return NextResponse.json({
      success: true,
      stage: project.stage,
      status: project.status,
      actualEndDate: project.actualEndDate?.toISOString() || null,
      postSaleFollowUpAt: project.postSaleFollowUpAt?.toISOString() || null,
      postSaleContactedAt: project.postSaleContactedAt?.toISOString() || null,
      warrantyEndsAt: project.warrantyEndsAt?.toISOString() || null,
      productionBlockedAt: project.productionBlockedAt?.toISOString() || null,
      productionBlockReason: project.productionBlockReason,
      stageDeadlineDate: project.stageDeadlineDate?.toISOString() || null,
    })
  } catch {
    return serverError()
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:projects:id:delete:${auth.user.id}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    await prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id },
        data: { archivedAt: new Date() },
        select: { name: true },
      })
      await tx.activityLog.create({
        data: {
          userId: auth.user.id,
          projectId: id,
          action: 'Projeto movido para a lixeira',
          details: `Projeto "${project.name}" arquivado pelo administrador`,
        },
      })
    })
  } catch {
    return serverError()
  }

  return NextResponse.json({ success: true, archived: true })
}
