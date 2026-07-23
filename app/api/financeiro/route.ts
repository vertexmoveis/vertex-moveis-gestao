import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getClientIp, requireRole, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { calculateProjectCostSummary } from '@/lib/project-costs'
import { moneyValue, numberValue } from '@/lib/money'

function parseMonth(value: string | null) {
  const now = new Date()
  const match = value?.match(/^(\d{4})-(\d{2})$/)
  const year = match ? Number(match[1]) : now.getFullYear()
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth()
  const paidStart = new Date(year, monthIndex, 1)
  const paidEnd = new Date(year, monthIndex + 1, 1)
  const dueStart = new Date(Date.UTC(year, monthIndex, 1))
  const dueEnd = new Date(Date.UTC(year, monthIndex + 1, 1))

  return {
    key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    paidStart,
    paidEnd,
    dueStart,
    dueEnd,
  }
}

function paymentStatus(payment: { dueDate: Date; paidAt: Date | null }, today: Date) {
  if (payment.paidAt) return 'RECEBIDO'
  if (payment.dueDate < today) return 'ATRASADO'
  return 'PENDENTE'
}

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(Number.parseInt(searchParams.get('page') || '1', 10) || 1, 1)
  const pageSize = Math.min(Math.max(Number.parseInt(searchParams.get('pageSize') || '20', 10) || 20, 10), 100)
  return { page, pageSize }
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:financeiro:get:${auth.user.id}:${getClientIp(req)}`, 80, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const month = parseMonth(searchParams.get('month'))
  const status = (searchParams.get('status') || 'TODOS').trim().toUpperCase()
  const q = (searchParams.get('q') || '').trim().slice(0, 120)
  const { page, pageSize } = parsePagination(searchParams)
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const paymentWindowWhere: Prisma.ProjectPaymentWhereInput = {
    OR: [
      { paidAt: { gte: month.paidStart, lt: month.paidEnd } },
      { dueDate: { gte: month.dueStart, lt: month.dueEnd } },
      { dueDate: { lt: today }, paidAt: null },
    ],
  }
  const paymentSearchWhere: Prisma.ProjectPaymentWhereInput | null = q
    ? {
        OR: [
          { project: { name: { contains: q } } },
          { project: { client: { name: { contains: q } } } },
        ],
      }
    : null
  const statusWhere: Prisma.ProjectPaymentWhereInput | null =
    status === 'RECEBIDO'
      ? { paidAt: { not: null } }
      : status === 'PENDENTE'
        ? { paidAt: null, dueDate: { gte: today } }
        : status === 'ATRASADO'
          ? { paidAt: null, dueDate: { lt: today } }
          : status === 'ENTRADAS'
            ? { type: 'DOWN_PAYMENT' }
            : status === 'PARCELAS'
              ? { type: 'INSTALLMENT' }
              : null
  const paymentListWhere: Prisma.ProjectPaymentWhereInput = {
    AND: [
      { project: { archivedAt: null } },
      paymentWindowWhere,
      ...(paymentSearchWhere ? [paymentSearchWhere] : []),
      ...(statusWhere ? [statusWhere] : []),
    ],
  }
  const soldProjectsWhere: Prisma.ProjectWhereInput = {
    archivedAt: null,
    OR: [
      { approvalDate: { gte: month.dueStart, lt: month.dueEnd } },
      { startDate: { gte: month.dueStart, lt: month.dueEnd } },
      {
        approvalDate: null,
        startDate: null,
        createdAt: { gte: month.paidStart, lt: month.paidEnd },
      },
    ],
    value: { not: null },
  }

  const [received, receivable, overdue, future, soldProjects, allPayments, total] = await Promise.all([
    prisma.projectPayment.aggregate({
      where: { paidAt: { gte: month.paidStart, lt: month.paidEnd }, project: { archivedAt: null } },
      _sum: { amount: true },
    }),
    prisma.projectPayment.aggregate({
      where: { paidAt: null, dueDate: { gte: month.dueStart, lt: month.dueEnd }, project: { archivedAt: null } },
      _sum: { amount: true },
    }),
    prisma.projectPayment.aggregate({
      where: { paidAt: null, dueDate: { lt: today }, project: { archivedAt: null } },
      _sum: { amount: true },
    }),
    prisma.projectPayment.aggregate({
      where: { dueDate: { gte: month.dueEnd }, paidAt: null, project: { archivedAt: null } },
      _sum: { amount: true },
    }),
    prisma.project.findMany({
      where: soldProjectsWhere,
      select: {
        value: true,
        productionCost: true,
        materials: { select: { estimatedCost: true, actualCost: true } },
        expenses: { select: { amount: true } },
      },
    }),
    prisma.projectPayment.findMany({
      where: paymentListWhere,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.projectPayment.count({ where: paymentListWhere }),
  ])

  const soldValue = soldProjects.reduce((total, project) => total + numberValue(project.value), 0)
  const estimatedCost = soldProjects.reduce((total, project) => total + Math.max(numberValue(project.productionCost), 0), 0)
  const soldCost = soldProjects.reduce((total, project) => (
    total + calculateProjectCostSummary(project.productionCost, project.materials, project.expenses).adjustedCost
  ), 0)
  const summary = {
    received: moneyValue(received._sum.amount),
    receivable: moneyValue(receivable._sum.amount),
    overdue: moneyValue(overdue._sum.amount),
    sold: moneyValue(soldValue),
    cost: moneyValue(soldCost),
    estimatedCost: moneyValue(estimatedCost),
    estimatedProfit: moneyValue(soldValue - estimatedCost),
    profit: moneyValue(soldValue - soldCost),
    future: moneyValue(future._sum.amount),
  }

  const payments = allPayments
    .map((payment) => ({
      id: payment.id,
      projectId: payment.projectId,
      projectName: payment.project.name,
      clientName: payment.project.client.name,
      installmentNumber: payment.installmentNumber,
      type: payment.type,
      amount: moneyValue(payment.amount),
      dueDate: payment.dueDate.toISOString(),
      paidAt: payment.paidAt?.toISOString() || null,
      paymentMethod: payment.paymentMethod,
      status: paymentStatus(payment, today),
    }))

  return NextResponse.json({
    month: month.key,
    summary,
    payments,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    },
  })
}
