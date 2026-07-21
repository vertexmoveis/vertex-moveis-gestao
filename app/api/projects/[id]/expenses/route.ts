import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { toDateOnlyUtc } from '@/lib/date-only'
import { badRequest, getClientIp, requireRole, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

export const expenseSchema = z.object({
  category: z.enum(['LABOR', 'FREIGHT', 'INSTALLATION', 'CONSUMABLES', 'REWORK', 'OTHER']),
  description: z.string().trim().min(2).max(160),
  amount: z.coerce.number().positive().max(10_000_000),
  incurredAt: z.string().date(),
  supplier: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).strict()

function serializeExpense<T extends { incurredAt: Date; createdAt: Date; updatedAt: Date }>(expense: T) {
  return {
    ...expense,
    incurredAt: expense.incurredAt.toISOString(),
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const limited = await rateLimit(`api:project:expenses:get:${auth.user.id}:${id}:${getClientIp(req)}`, 80, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })

  const expenses = await prisma.projectExpense.findMany({
    where: { projectId: id },
    orderBy: [{ incurredAt: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(expenses.map(serializeExpense))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { id } = await params
  const limited = await rateLimit(`api:project:expenses:post:${auth.user.id}:${id}:${getClientIp(req)}`, 40, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })

  const parsed = expenseSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos.')
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  const expense = await prisma.projectExpense.create({
    data: {
      projectId: id,
      createdById: auth.user.id,
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount,
      incurredAt: toDateOnlyUtc(parsed.data.incurredAt)!,
      supplier: parsed.data.supplier || null,
      notes: parsed.data.notes || null,
    },
  })
  await prisma.activityLog.create({
    data: { userId: auth.user.id, projectId: id, action: 'Despesa registrada', details: `${expense.description}: R$ ${expense.amount.toFixed(2)}` },
  })
  return NextResponse.json(serializeExpense(expense), { status: 201 })
}
