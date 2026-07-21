import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toDateOnlyUtc } from '@/lib/date-only'
import { badRequest, getClientIp, requireRole, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { expenseSchema } from '../route'

function serializeExpense<T extends { incurredAt: Date; createdAt: Date; updatedAt: Date }>(expense: T) {
  return { ...expense, incurredAt: expense.incurredAt.toISOString(), createdAt: expense.createdAt.toISOString(), updatedAt: expense.updatedAt.toISOString() }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; expenseId: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { id, expenseId } = await params
  const limited = await rateLimit(`api:project:expense:patch:${auth.user.id}:${expenseId}:${getClientIp(req)}`, 40, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })
  const parsed = expenseSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos.')
  const existing = await prisma.projectExpense.findFirst({ where: { id: expenseId, projectId: id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Despesa não encontrada.' }, { status: 404 })

  const expense = await prisma.projectExpense.update({
    where: { id: expenseId },
    data: {
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount,
      incurredAt: toDateOnlyUtc(parsed.data.incurredAt)!,
      supplier: parsed.data.supplier || null,
      notes: parsed.data.notes || null,
    },
  })
  return NextResponse.json(serializeExpense(expense))
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; expenseId: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response
  const { id, expenseId } = await params
  const limited = await rateLimit(`api:project:expense:delete:${auth.user.id}:${expenseId}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })
  const existing = await prisma.projectExpense.findFirst({ where: { id: expenseId, projectId: id }, select: { id: true, description: true } })
  if (!existing) return NextResponse.json({ error: 'Despesa não encontrada.' }, { status: 404 })
  await prisma.$transaction([
    prisma.projectExpense.delete({ where: { id: expenseId } }),
    prisma.activityLog.create({ data: { userId: auth.user.id, projectId: id, action: 'Despesa removida', details: existing.description } }),
  ])
  return NextResponse.json({ success: true })
}
