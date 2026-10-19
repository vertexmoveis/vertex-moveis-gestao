import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireRole, badRequest, getClientIp, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit } from '@/lib/rate-limit'
import { getFinanceSettlements } from '@/lib/finance-settlement-service'
import { allocateReceipt, paymentReceived, receiptAmounts } from '@/lib/finance-settlements'
import { moneyValue } from '@/lib/money'
import { dateOnlyKeyInTimeZone, startOfDateInTimeZone } from '@/lib/date-only'
import { syncProjectReceiptWorkflow } from '@/lib/project-receipt-workflow'

const money = z.number().finite().min(0).max(999999999999).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001, 'Use no máximo duas casas decimais.')
const note = z.string().trim().max(1000).nullable().optional()
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('RECEIVE'), projectId: z.string().min(1), requestId: z.uuid(), amount: money.refine(value => value > 0), fee: money.default(0),
    method: z.enum(['PIX', 'DINHEIRO', 'CARTAO', 'BOLETO', 'TRANSFERENCIA']), source: z.enum(['DIRECT', 'CARD', 'BOLETO_ADVANCE']).default('DIRECT'),
    receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), note }).strict(),
  z.object({ action: z.literal('CREDIT_REVIEW'), projectId: z.string().min(1), creditStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']), creditLimit: money.nullable().optional(), note }).strict(),
  z.object({ action: z.literal('REVERSE'), projectId: z.string().min(1), receiptId: z.string().min(1), note: z.string().trim().min(3).max(1000) }).strict(),
])

class FinanceConflict extends Error {}

export async function GET(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response
  const limited = await rateLimit(`finance:list:${auth.user.id}:${getClientIp(req)}`, 80, 60000).catch(() => null)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em instantes.' }, { status: 429 })
  try {
    return NextResponse.json(await getFinanceSettlements(req.nextUrl.searchParams.get('month'), (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 120)))
  } catch { return serverError() }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response
  const limited = await rateLimit(`finance:receive:${auth.user.id}:${getClientIp(req)}`, 60, 60000).catch(() => null)
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas solicitações. Tente novamente em instantes.' }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Confira os valores, a data e a forma de recebimento.')
  const input = parsed.data
  try {
    const result = await prisma.$transaction(async tx => {
      // Serialize all finance changes for this project, including repeated requests.
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${input.projectId} FOR UPDATE`
      const project = await tx.project.findFirst({ where: { id: input.projectId, archivedAt: null }, include: {
        payments: { orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }], include: {
          receiptAllocations: { include: { receipt: { select: { reversedAt: true } } } },
        } },
      } })
      if (!project) throw new FinanceConflict('Projeto não encontrado.')
      // Credit is shared by every project belonging to the same customer.
      await tx.$queryRaw`SELECT "id" FROM "Client" WHERE "id" = ${project.clientId} FOR UPDATE`
      const credit = await tx.client.findUniqueOrThrow({ where: { id: project.clientId } })

      if (input.action === 'CREDIT_REVIEW') {
        if (project.paymentMethod !== 'BOLETO') throw new FinanceConflict('A análise de crédito se aplica aos projetos em boleto.')
        if (input.creditStatus === 'APPROVED' && !input.creditLimit) throw new FinanceConflict('Informe o limite aprovado pelo jurídico.')
        const data = { creditStatus: input.creditStatus, creditLimit: input.creditStatus === 'APPROVED' ? input.creditLimit : null,
          creditNotes: input.note || null, creditReviewedAt: new Date() }
        await tx.client.update({ where: { id: project.clientId }, data })
        await tx.activityLog.create({ data: { userId: auth.user.id, projectId: project.id, action: 'Análise de crédito registrada', details: JSON.stringify(data) } })
        return { ok: true }
      }

      if (input.action === 'REVERSE') {
        const receipt = await tx.financeReceipt.findFirst({ where: { id: input.receiptId, projectId: project.id }, include: { allocations: true } })
        if (!receipt) throw new FinanceConflict('Recebimento não encontrado.')
        if (receipt.reversedAt) return { ok: true, receiptId: receipt.id }
        await tx.financeReceipt.update({ where: { id: receipt.id }, data: { reversedAt: new Date(), reversedById: auth.user.id, reversalNote: input.note } })
        for (const allocation of receipt.allocations) {
          const payment = await tx.projectPayment.findUniqueOrThrow({ where: { id: allocation.paymentId }, include: {
            receiptAllocations: { where: { receipt: { reversedAt: null } } },
          } })
          const received = moneyValue(payment.receiptAllocations.reduce((sum, item) => sum + moneyValue(item.amount), 0))
          await tx.projectPayment.update({ where: { id: payment.id }, data: {
            paidAt: received >= moneyValue(payment.amount) ? payment.paidAt : null,
            ...(received < moneyValue(payment.amount) ? { paymentMethod: null } : {}),
          } })
          await tx.paymentHistory.create({ data: { paymentId: payment.id, userId: auth.user.id, action: 'REVERSED', amount: allocation.amount, method: receipt.method } })
        }
        await tx.activityLog.create({ data: { userId: auth.user.id, projectId: project.id, action: 'Recebimento estornado', details: `${receipt.id}: ${input.note}` } })
        await syncProjectReceiptWorkflow(tx, project.id)
        return { ok: true, receiptId: receipt.id }
      }

      const existing = await tx.financeReceipt.findUnique({ where: { requestId: input.requestId } })
      if (existing) {
        const requestedDate = input.receivedAt || dateOnlyKeyInTimeZone(new Date())
        if (existing.projectId !== project.id || moneyValue(existing.amount) !== input.amount || moneyValue(existing.fee) !== input.fee
          || existing.method !== input.method || existing.source !== input.source || dateOnlyKeyInTimeZone(existing.receivedAt) !== requestedDate) {
          throw new FinanceConflict('Este identificador já foi utilizado para outro recebimento.')
        }
        return { ok: true, receiptId: existing.id, repeated: true }
      }
      const dateKey = input.receivedAt || dateOnlyKeyInTimeZone(new Date())
      const receivedAt = startOfDateInTimeZone(dateKey)!
      if (dateOnlyKeyInTimeZone(receivedAt) !== dateKey || dateKey > dateOnlyKeyInTimeZone(new Date())) throw new FinanceConflict('Informe uma data de recebimento válida, até hoje.')
      if (input.fee > input.amount) throw new FinanceConflict('A taxa não pode ser maior que o recebimento bruto.')
      receiptAmounts(input.amount, input.fee)
      const received = moneyValue(project.payments.reduce((sum, payment) => sum + paymentReceived(payment), 0))
      const scheduleValue = moneyValue(project.payments.reduce((sum, payment) => sum + moneyValue(payment.amount), 0))
      const totalValue = Math.max(moneyValue(project.value), scheduleValue)
      const remaining = moneyValue(totalValue - received)
      if (input.amount > remaining) throw new FinanceConflict('O recebimento ultrapassa o saldo em aberto. Atualize a tela.')
      if (input.source === 'CARD' && (input.method !== 'CARTAO' || project.paymentMethod !== 'CARD' || input.amount !== remaining)) {
        throw new FinanceConflict('No cartão, registre o saldo inteiro em um único recebimento.')
      }
      if (input.method === 'CARTAO' && input.source !== 'CARD') throw new FinanceConflict('Use o recebimento único do cartão.')
      if (input.source === 'BOLETO_ADVANCE') {
        if (project.paymentMethod !== 'BOLETO' || credit.creditStatus !== 'APPROVED' || input.method === 'CARTAO' || input.method === 'DINHEIRO') {
          throw new FinanceConflict('Registre primeiro o limite de crédito aprovado pelo jurídico.')
        }
        const advanced = await tx.financeReceipt.aggregate({ where: { project: { clientId: project.clientId }, source: 'BOLETO_ADVANCE', reversedAt: null }, _sum: { amount: true } })
        if (input.amount > moneyValue(moneyValue(credit.creditLimit) - moneyValue(advanced._sum.amount))) throw new FinanceConflict('O valor ultrapassa o limite de antecipação disponível para este cliente.')
      }
      if (totalValue > scheduleValue) {
        const balance = await tx.projectPayment.create({ data: { projectId: project.id, type: 'INSTALLMENT',
          installmentNumber: Math.max(0, ...project.payments.map(payment => payment.installmentNumber)) + 1,
          amount: moneyValue(totalValue - scheduleValue), dueDate: receivedAt } })
        project.payments.push({ ...balance, receiptAllocations: [] })
      }
      const allocations = allocateReceipt(project.payments, input.amount)
      const receipt = await tx.financeReceipt.create({ data: {
        projectId: project.id, requestId: input.requestId, amount: input.amount, fee: input.fee, method: input.method,
        source: input.source, receivedAt, note: input.note || null, recordedById: auth.user.id,
        allocations: { create: allocations },
      } })
      for (const allocation of allocations) {
        const payment = project.payments.find(item => item.id === allocation.paymentId)!
        const full = moneyValue(paymentReceived(payment) + allocation.amount) >= moneyValue(payment.amount)
        await tx.projectPayment.update({ where: { id: payment.id }, data: { paidAt: full ? receivedAt : null, paymentMethod: full ? input.method : null } })
        await tx.paymentHistory.create({ data: { paymentId: payment.id, userId: auth.user.id, action: full ? 'RECEIVED' : 'PARTIAL_RECEIVED', method: input.method, amount: allocation.amount } })
      }
      await tx.activityLog.create({ data: { projectId: project.id, userId: auth.user.id, action: 'Recebimento registrado', details: `Bruto R$ ${input.amount.toFixed(2)}; taxa R$ ${input.fee.toFixed(2)}; ${input.source}; ${receipt.id}` } })
      await syncProjectReceiptWorkflow(tx, project.id)
      return { ok: true, receiptId: receipt.id }
    }, { timeout: 15000 })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof FinanceConflict) return NextResponse.json({ error: error.message }, { status: 409 })
    return serverError()
  }
}
