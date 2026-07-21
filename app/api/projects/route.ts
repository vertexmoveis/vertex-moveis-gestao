import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { projectCreateSchema } from '@/lib/schemas'
import { buildPaymentSchedule } from '@/lib/payments'
import { buildDefaultChecklistItems } from '@/lib/checklist'
import { calculateProjectProductionDates } from '@/lib/business-days'
import { normalizeEnvironmentNames, serializeEnvironment, summarizeEnvironments } from '@/lib/project-environments'
import { badRequest, getClientIp, requireAuth, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { normalizeProductionStage, type ProductionStage } from '@/types'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:projects:get:${auth.user.id}:${getClientIp(req)}`, 120, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim().slice(0, 120)
  const status = (searchParams.get('status') || '').trim()
  const stage = (searchParams.get('stage') || '').trim()
  const paged = searchParams.get('paged') === '1'
  const page = Math.max(Number(searchParams.get('page') || 1), 1)
  const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') || 20), 1), 100)

  const where: Record<string, unknown> = auth.user.role === 'ADMIN' ? {} : { managerId: auth.user.id }

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { client: { name: { contains: q } } },
    ]
  }
  if (status) where.status = status
  if (stage) {
    where.stage = stage === 'INSTALLATION' ? { in: ['INSTALLATION', 'TRANSPORTATION'] } : stage
  }

  const [projects, total] = await Promise.all([
  prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: paged ? (page - 1) * pageSize : undefined,
    take: paged ? pageSize : undefined,
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
      value: auth.user.role === 'ADMIN',
      productionCost: auth.user.role === 'ADMIN',
      downPayment: auth.user.role === 'ADMIN',
      downPaymentDate: auth.user.role === 'ADMIN',
      installmentCount: auth.user.role === 'ADMIN',
      installmentValue: auth.user.role === 'ADMIN',
      firstInstallmentDate: auth.user.role === 'ADMIN',
      internalNotes: false,
      environments: {
        select: { id: true, name: true, status: true, position: true, notes: true, startedAt: true, completedAt: true },
        orderBy: { position: 'asc' },
      },
      createdAt: true,
      updatedAt: true,
      client: { select: { id: true, name: true, phone: auth.user.role === 'ADMIN', whatsapp: auth.user.role === 'ADMIN' } },
      manager: { select: { id: true, name: true } },
    },
  }),
  paged ? prisma.project.count({ where }) : Promise.resolve(0),
  ])

  const items = projects.map((p) => ({
      ...p,
      approvalDate: p.approvalDate?.toISOString() || null,
      paymentConfirmedAt: p.paymentConfirmedAt?.toISOString() || null,
      deliveryDeadlineDate: p.deliveryDeadlineDate?.toISOString() || null,
      productionStartReminderDate: p.productionStartReminderDate?.toISOString() || null,
      startDate: p.startDate?.toISOString() || null,
      estimatedEndDate: p.estimatedEndDate?.toISOString() || null,
      actualEndDate: p.actualEndDate?.toISOString() || null,
      downPaymentDate: p.downPaymentDate?.toISOString() || null,
      firstInstallmentDate: p.firstInstallmentDate?.toISOString() || null,
      environments: p.environments.map(serializeEnvironment),
      environmentSummary: summarizeEnvironments(p.environments),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))

  if (paged) {
    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    })
  }

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:projects:post:${auth.user.id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
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

  const parsed = projectCreateSchema.safeParse(body)
  if (!parsed.success) return badRequest()

  try {
    const input = parsed.data
    const stage = normalizeProductionStage(input.stage as ProductionStage)
    const environmentNames = normalizeEnvironmentNames(input.environments, input.room)
    const room = environmentNames.length > 0 ? environmentNames.join(', ') : input.room
    const productionDates = calculateProjectProductionDates({
      approvalDate: input.paymentConfirmedAt || input.approvalDate,
      deliveryBusinessDays: input.deliveryBusinessDays,
      reminderBusinessDays: input.productionReminderBusinessDays,
    })
    const estimatedEndDate = productionDates.deliveryDeadlineDate || input.estimatedEndDate
    const schedule = buildPaymentSchedule({
      value: input.value,
      downPayment: input.downPayment,
      downPaymentDate: input.downPaymentDate,
      installmentCount: input.installmentCount,
      firstInstallmentDate: input.firstInstallmentDate,
      baseDate: input.startDate || new Date(),
    })
    const project = await prisma.project.create({
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
        value: auth.user.role === 'ADMIN' ? input.value : null,
        productionCost: auth.user.role === 'ADMIN' ? input.productionCost || 0 : 0,
        downPayment: auth.user.role === 'ADMIN' ? schedule.terms.downPayment : 0,
        downPaymentDate: auth.user.role === 'ADMIN' ? input.downPaymentDate : null,
        installmentCount: auth.user.role === 'ADMIN' ? schedule.terms.installmentCount : 0,
        installmentValue: auth.user.role === 'ADMIN' ? schedule.terms.installmentValue : 0,
        firstInstallmentDate: auth.user.role === 'ADMIN' ? input.firstInstallmentDate : null,
        managerId: auth.user.role === 'ADMIN' ? input.managerId : auth.user.id,
        internalNotes: auth.user.role === 'ADMIN' ? input.internalNotes : null,
        payments: auth.user.role === 'ADMIN'
          ? {
              create: schedule.payments,
            }
          : undefined,
        checklist: {
          create: buildDefaultChecklistItems(),
        },
        environments: environmentNames.length > 0
          ? {
              create: environmentNames.map((name, index) => ({
                name,
                position: index + 1,
                status: 'PENDING',
              })),
            }
          : undefined,
      },
      include: {
        client: { select: { id: true, name: true, phone: true, whatsapp: true } },
        manager: { select: { id: true, name: true } },
        environments: { orderBy: { position: 'asc' } },
      },
    })

    await prisma.timelineEvent.create({
      data: {
        projectId: project.id,
        event: 'Projeto Criado',
        description: `Projeto "${project.name}" criado no sistema`,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        projectId: project.id,
        action: 'Projeto criado',
        details: `Novo projeto: ${project.name}`,
      },
    })

    return NextResponse.json({
      ...project,
      approvalDate: project.approvalDate?.toISOString() || null,
      paymentConfirmedAt: project.paymentConfirmedAt?.toISOString() || null,
      deliveryDeadlineDate: project.deliveryDeadlineDate?.toISOString() || null,
      productionStartReminderDate: project.productionStartReminderDate?.toISOString() || null,
      startDate: project.startDate?.toISOString() || null,
      estimatedEndDate: project.estimatedEndDate?.toISOString() || null,
      actualEndDate: project.actualEndDate?.toISOString() || null,
      downPaymentDate: project.downPaymentDate?.toISOString() || null,
      firstInstallmentDate: project.firstInstallmentDate?.toISOString() || null,
      environments: project.environments.map(serializeEnvironment),
      environmentSummary: summarizeEnvironments(project.environments),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    })
  } catch {
    return serverError()
  }
}
