import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getClientIp, requireRole, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { moneyValue } from '@/lib/money'
import { paymentMethodLabel } from '@/lib/payment-methods'
import { formatDateOnly } from '@/lib/date-only'

function parseMonth(value: string | null) {
  const now = new Date()
  const match = value?.match(/^(\d{4})-(\d{2})$/)
  const year = match ? Number(match[1]) : now.getFullYear()
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth()
  const paidStart = new Date(year, monthIndex, 1)
  const paidEnd = new Date(year, monthIndex + 1, 1)
  const dueStart = new Date(Date.UTC(year, monthIndex, 1))
  const dueEnd = new Date(Date.UTC(year, monthIndex + 1, 1))
  const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
  return { key, paidStart, paidEnd, dueStart, dueEnd }
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`api:financeiro:export:${auth.user.id}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const month = parseMonth(searchParams.get('month'))
  const q = (searchParams.get('q') || '').trim().slice(0, 120)
  const status = (searchParams.get('status') || 'TODOS').trim().toUpperCase()
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const statusWhere: Prisma.ProjectPaymentWhereInput =
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
              : {}

  const payments = await prisma.projectPayment.findMany({
    where: {
      AND: [
        {
          OR: [
            { paidAt: { gte: month.paidStart, lt: month.paidEnd } },
            { dueDate: { gte: month.dueStart, lt: month.dueEnd } },
            { dueDate: { lt: today }, paidAt: null },
          ],
        },
        q
          ? {
              OR: [
                { project: { name: { contains: q } } },
                { project: { client: { name: { contains: q } } } },
              ],
            }
          : {},
        statusWhere,
      ],
    },
    include: {
      project: {
        select: {
          name: true,
          client: { select: { name: true } },
        },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
  })

  const header = ['Cliente', 'Projeto', 'Tipo', 'Vencimento', 'Pago em', 'Método', 'Valor']
  const rows = payments.map((payment) => [
    payment.project.client.name,
    payment.project.name,
    payment.type === 'DOWN_PAYMENT' ? 'Entrada' : `Parcela ${payment.installmentNumber}`,
    formatDateOnly(payment.dueDate),
    payment.paidAt?.toLocaleDateString('pt-BR') || '',
    paymentMethodLabel(payment.paymentMethod),
    moneyValue(payment.amount).toFixed(2).replace('.', ','),
  ])

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="financeiro-${month.key}.csv"`,
    },
  })
}
