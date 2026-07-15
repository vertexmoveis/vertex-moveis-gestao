import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { badRequest, getClientIp, requireRole, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { isPaymentMethod } from '@/lib/payment-methods'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { id, paymentId } = await params
  const limited = await rateLimit(`api:payments:patch:${auth.user.id}:${paymentId}:${getClientIp(req)}`, 60, 60 * 1000).catch((error) => {
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

  const paid = typeof body === 'object' && body !== null && 'paid' in body ? Boolean(body.paid) : null
  const paymentMethod = typeof body === 'object' && body !== null && 'paymentMethod' in body ? body.paymentMethod : undefined
  if (paid === null) return badRequest()
  if (paid && paymentMethod !== undefined && paymentMethod !== null && !isPaymentMethod(paymentMethod)) return badRequest()

  try {
    const payment = await prisma.projectPayment.findFirst({
      where: { id: paymentId, projectId: id },
      select: { id: true },
    })
    if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.projectPayment.update({
      where: { id: paymentId },
      data: {
        paidAt: paid ? new Date() : null,
        paymentMethod: paid ? (isPaymentMethod(paymentMethod) ? paymentMethod : 'PIX') : null,
      },
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
      },
    })

    await prisma.paymentHistory.create({
      data: {
        paymentId,
        userId: auth.user.id,
        action: paid ? 'RECEIVED' : 'REOPENED',
        method: updated.paymentMethod,
        amount: updated.amount,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        projectId: id,
        action: paid ? 'Pagamento recebido' : 'Pagamento reaberto',
        details: `Parcela ${updated.installmentNumber || 'entrada'} - R$ ${updated.amount.toFixed(2)}`,
      },
    })

    return NextResponse.json({
      ...updated,
      dueDate: updated.dueDate.toISOString(),
      paidAt: updated.paidAt?.toISOString() || null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch {
    return serverError()
  }
}
