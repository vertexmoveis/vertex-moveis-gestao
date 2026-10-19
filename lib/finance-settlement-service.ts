import { prisma } from '@/lib/db'
import { moneyValue } from '@/lib/money'
import { financeMonth, paymentReceived } from '@/lib/finance-settlements'

export async function getFinanceSettlements(monthValue?: string | null, query = '') {
  const month = financeMonth(monthValue)
  const records = await prisma.project.findMany({
    select: {
      id: true, name: true, value: true, paymentMethod: true, cardFeeAmount: true, archivedAt: true,
      clientId: true,
      client: { select: { name: true, creditStatus: true, creditLimit: true, creditNotes: true } },
      payments: { orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }], include: {
        receiptAllocations: { include: { receipt: { select: { reversedAt: true } } } },
      } },
      financeReceipts: { orderBy: { receivedAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })
  const inMonth = (date: Date) => date >= month.start && date < month.end
  const advancedByClient = new Map<string, number>()
  const advances = await prisma.financeReceipt.findMany({ where: {
    source: 'BOLETO_ADVANCE', reversedAt: null,
    project: { clientId: { in: [...new Set(records.map(project => project.clientId))] } },
  }, select: { amount: true, project: { select: { clientId: true } } } })
  for (const receipt of advances) {
    const clientId = receipt.project.clientId
    advancedByClient.set(clientId, moneyValue((advancedByClient.get(clientId) || 0) + moneyValue(receipt.amount)))
  }
  const projects = records.map(project => {
    const payments = project.payments.map(payment => ({
      id: payment.id, type: payment.type, installmentNumber: payment.installmentNumber,
      amount: moneyValue(payment.amount), received: paymentReceived(payment),
      remaining: moneyValue(Math.max(moneyValue(payment.amount) - paymentReceived(payment), 0)),
      dueDate: payment.dueDate.toISOString(), paidAt: payment.paidAt?.toISOString() || null,
    }))
    const receipts = [
      ...project.financeReceipts.map(receipt => ({
        id: receipt.id, amount: moneyValue(receipt.amount), fee: moneyValue(receipt.fee),
        method: receipt.method, source: receipt.source, receivedAt: receipt.receivedAt.toISOString(),
        note: receipt.note, reversedAt: receipt.reversedAt?.toISOString() || null,
      })),
      ...project.payments.filter(payment => payment.paidAt && !payment.receiptAllocations.length).map(payment => ({
        id: `legacy:${payment.id}`, amount: moneyValue(payment.amount), fee: 0,
        method: payment.paymentMethod || 'NAO_INFORMADO', source: 'LEGACY',
        receivedAt: payment.paidAt!.toISOString(), note: 'Recebimento registrado antes do novo controle; taxa não informada.', reversedAt: null,
      })),
    ].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    const received = moneyValue(payments.reduce((sum, payment) => sum + payment.received, 0))
    const value = Math.max(moneyValue(project.value), moneyValue(payments.reduce((sum, payment) => sum + payment.amount, 0)))
    const advanced = advancedByClient.get(project.clientId) || 0
    return {
      id: project.id, name: project.name, clientName: project.client.name, paymentMethod: project.paymentMethod, archivedAt: project.archivedAt?.toISOString() || null,
      cardFeeAmount: moneyValue(project.cardFeeAmount), value, received, remaining: moneyValue(Math.max(value - received, 0)),
      creditStatus: project.client.creditStatus, creditLimit: project.client.creditLimit === null ? null : moneyValue(project.client.creditLimit),
      creditAvailable: moneyValue(Math.max(moneyValue(project.client.creditLimit) - advanced, 0)), creditNotes: project.client.creditNotes,
      payments, receipts,
    }
  })
  const search = query.toLocaleLowerCase('pt-BR')
  const matchingProjects = projects.filter(project => !search || `${project.name} ${project.clientName}`.toLocaleLowerCase('pt-BR').includes(search))
  const summary = { received: 0, receivedGross: 0, fees: 0, pending: 0, boletoPending: 0, cardPending: 0, cashPending: 0 }
  for (const project of matchingProjects) {
    for (const receipt of project.receipts) {
      if (receipt.reversedAt || !inMonth(new Date(receipt.receivedAt))) continue
      summary.receivedGross += receipt.amount
      summary.fees += receipt.fee
    }
    if (project.archivedAt) continue
    summary.pending += project.remaining
    if (project.paymentMethod === 'CARD') summary.cardPending += project.remaining
    else if (project.paymentMethod === 'BOLETO') summary.boletoPending += project.remaining
    else summary.cashPending += project.remaining
  }
  summary.received = summary.receivedGross - summary.fees
  for (const key of Object.keys(summary) as Array<keyof typeof summary>) summary[key] = moneyValue(summary[key])
  return {
    month: month.key, summary,
    projects: matchingProjects.filter(project => (
      ((!project.archivedAt && project.remaining > 0) || project.receipts.some(receipt => inMonth(new Date(receipt.receivedAt))))
    )),
  }
}
