import { z } from 'zod'
import { parseProjectContractSnapshot } from '@/lib/project-contracts'
import { dateOnlyKey } from '@/lib/date-only'
import { moneyValue } from '@/lib/money'
import { parseBRLCurrency } from '@/lib/currency-input'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}, 'Informe uma data válida.')
const money = z.preprocess(parseBRLCurrency, z.number().finite().min(0).max(10_000_000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001, 'Use no máximo duas casas decimais.'))
const shape = {
  clientId: z.string().trim().min(1, 'Escolha o cliente.'),
  title: z.string().trim().min(3, 'Informe o serviço contratado.').max(160),
  description: z.string().trim().min(5, 'Descreva o que será contratado.').max(3000),
  value: money.refine(value => value > 0, 'Informe um valor maior que zero.'),
  paymentMethod: z.enum(['PIX', 'CARD']),
  downPayment: money.default(0),
  downPaymentDate: date,
  installmentCount: z.coerce.number().int().min(1).max(24).default(1),
  firstInstallmentDate: date,
  deliveryBusinessDays: z.coerce.number().int().min(1).max(365).default(30),
}
const paymentValid = (input: { paymentMethod: string; downPayment: number; value: number }) => input.paymentMethod !== 'CARD' || input.downPayment < input.value
export const createStandaloneSchema = z.object(shape).strict().refine(paymentValid, { message: 'A entrada deve ser menor que o valor total do contrato.', path: ['downPayment'] })
export const editStandaloneSchema = z.object({ ...shape, updatedAt: z.string().datetime() }).strict().refine(paymentValid, { message: 'A entrada deve ser menor que o valor total do contrato.', path: ['downPayment'] })

export function standaloneContractEditForm(contract: { clientId: string | null; standaloneTitle: string | null; snapshot: unknown }) {
  const snapshot = parseProjectContractSnapshot(contract.snapshot)
  if (!snapshot || !contract.clientId || !['PIX', 'CARD'].includes(snapshot.payment.method || '')) return null
  const entry = snapshot.payment.schedule.find(payment => payment.type === 'DOWN_PAYMENT')
  const firstInstallment = snapshot.payment.schedule.find(payment => payment.type === 'INSTALLMENT')
  const firstInstallmentDate = dateOnlyKey(firstInstallment?.dueDate || snapshot.payment.firstInstallmentDate || entry?.dueDate)
  const downPaymentDate = dateOnlyKey(entry?.dueDate) || firstInstallmentDate
  if (!firstInstallmentDate || !downPaymentDate) return null
  const description = [...new Set((snapshot.project.scope || []).flatMap(scope => scope.items || []).map(item => item.notes?.trim()).filter(Boolean))].join('\n\n')
  return {
    clientId: contract.clientId, title: contract.standaloneTitle || snapshot.project.name,
    description, value: moneyValue(snapshot.project.value), paymentMethod: snapshot.payment.method as 'PIX' | 'CARD',
    downPayment: moneyValue(snapshot.payment.downPayment), downPaymentDate,
    installmentCount: snapshot.payment.installmentCount, firstInstallmentDate,
    deliveryBusinessDays: snapshot.project.deliveryBusinessDays,
  }
}
