import { randomUUID } from 'node:crypto'
import { addBusinessDays } from '@/lib/business-days'
import { toDateOnlyUtc } from '@/lib/date-only'
import { buildPaymentSchedule } from '@/lib/payments'
import { buildProjectContractSnapshot } from '@/lib/project-contracts'

export type StandaloneContractInput = {
  title: string
  description: string
  value: number
  paymentMethod: 'PIX' | 'CARD'
  downPayment: number
  downPaymentDate: string
  installmentCount: number
  firstInstallmentDate: string
  deliveryBusinessDays: number
}

type StandaloneClient = {
  id: string
  name: string
  document: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  street: string | null
  number: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  zipCode: string | null
}

type StandaloneCompany = {
  tradeName: string
  legalName?: string | null
  document?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
}

export function buildStandaloneContractSnapshot(
  input: StandaloneContractInput,
  client: StandaloneClient,
  company: StandaloneCompany,
) {
  const now = new Date()
  const downPaymentDate = toDateOnlyUtc(input.downPaymentDate)
  const firstInstallmentDate = toDateOnlyUtc(input.firstInstallmentDate)
  if (!downPaymentDate || !firstInstallmentDate) {
    throw new Error('INVALID_PAYMENT_DATE')
  }

  const installmentCount = input.paymentMethod === 'PIX' ? 1 : input.installmentCount
  const downPayment = input.paymentMethod === 'PIX' ? 0 : input.downPayment
  const schedule = buildPaymentSchedule({
    value: input.value,
    downPayment,
    downPaymentDate,
    installmentCount,
    firstInstallmentDate,
    baseDate: now,
  })
  const deliveryDeadlineDate = addBusinessDays(now, input.deliveryBusinessDays)

  return buildProjectContractSnapshot({
    id: `standalone-${randomUUID()}`,
    name: input.title,
    room: 'Serviço contratado',
    value: input.value,
    approvalDate: now,
    deliveryBusinessDays: input.deliveryBusinessDays,
    deliveryDeadlineDate,
    paymentMethod: input.paymentMethod,
    paymentDiscount: 0,
    cardFeePercent: 0,
    cardFeeAmount: 0,
    downPayment,
    installmentCount,
    installmentValue: schedule.terms.installmentValue,
    firstInstallmentDate,
    client,
    environments: [{ name: 'Serviço contratado' }],
    sourceQuote: {
      variationName: 'Contrato avulso',
      items: [{
        environment: 'Serviço contratado',
        environmentName: 'Serviço contratado',
        description: input.title,
        furnitureModel: input.title,
        placement: null,
        material: null,
        finish: null,
        quantity: 1,
        width: null,
        height: null,
        unitPrice: input.value,
        total: input.value,
        notes: input.description,
      }],
    },
    payments: schedule.payments.map((payment) => ({ ...payment, paidAt: null })),
  }, company)
}
