import { toDateOnlyUtc } from '@/lib/date-only'
import { normalizeEnvironmentNames } from '@/lib/project-environments'
import type { ProjectContractSnapshot } from '@/lib/project-contracts'
import { roundCurrency } from '@/lib/payments'

export const STANDALONE_ENTRY_PAYMENT_METHODS = [
  'PIX',
  'DINHEIRO',
  'CARTAO',
  'BOLETO',
  'TRANSFERENCIA',
] as const

export type StandaloneEntryPaymentMethod = typeof STANDALONE_ENTRY_PAYMENT_METHODS[number]

const STANDALONE_ENTRY_PAYMENT_METHOD_LABELS: Record<StandaloneEntryPaymentMethod, string> = {
  PIX: 'Pix',
  DINHEIRO: 'dinheiro',
  CARTAO: 'cartão',
  BOLETO: 'boleto',
  TRANSFERENCIA: 'transferência',
}

export const STANDALONE_BALANCE_PAYMENT_METHODS = ['CARD', 'BOLETO'] as const
export type StandaloneBalancePaymentMethod = typeof STANDALONE_BALANCE_PAYMENT_METHODS[number]

export function standaloneEntryPaymentMethodLabel(method: StandaloneEntryPaymentMethod) {
  return STANDALONE_ENTRY_PAYMENT_METHOD_LABELS[method]
}

function contractCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function contractDate(value?: string | null) {
  if (!value) return null
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : null
}

function boletoBalanceSummary(snapshot: ProjectContractSnapshot, entryMethod?: StandaloneEntryPaymentMethod) {
  const downPayment = roundCurrency(snapshot.payment.downPayment)
  if (downPayment > 0 && !entryMethod) throw new Error('ENTRY_PAYMENT_METHOD_REQUIRED')
  const installments = snapshot.payment.schedule.filter((payment) => payment.type === 'INSTALLMENT')
  const balance = roundCurrency(installments.reduce((sum, payment) => sum + payment.amount, 0))
  const firstDueDate = contractDate(installments[0]?.dueDate)
  const last = installments.at(-1)
  const regular = installments.slice(0, -1)
  const regularValue = regular[0]?.amount
  const regularAreEqual = regular.length > 0
    && regular.every((payment) => roundCurrency(payment.amount) === roundCurrency(regularValue))
  const installmentsText = installments.length === 1
    ? `1 boleto de ${contractCurrency(balance)}`
    : regularAreEqual && last
      ? `${installments.length} boletos (${regular.length}x de ${contractCurrency(roundCurrency(regularValue))} e último de ${contractCurrency(roundCurrency(last.amount))})`
      : `${installments.length} boletos conforme o cronograma`
  const entryText = downPayment > 0
    ? `Entrada de ${contractCurrency(downPayment)} via ${standaloneEntryPaymentMethodLabel(entryMethod as StandaloneEntryPaymentMethod)} + `
    : ''
  return `${entryText}saldo de ${contractCurrency(balance)} em ${installmentsText}${firstDueDate ? `, a partir de ${firstDueDate}` : ''}`
}

export function buildStandaloneCorrectedBoletoContractSnapshot({
  snapshot,
  projectId,
  projectName,
  environmentNames,
  approvalDate,
  recordedAt,
  entryPaymentMethod,
}: {
  snapshot: ProjectContractSnapshot
  projectId: string
  projectName: string
  environmentNames: string[]
  approvalDate: Date
  recordedAt: Date
  entryPaymentMethod?: StandaloneEntryPaymentMethod
}) {
  const paymentSummary = boletoBalanceSummary(snapshot, entryPaymentMethod)
  const paymentTerm = `O investimento total é de ${contractCurrency(roundCurrency(snapshot.project.value))}. Condição combinada: ${paymentSummary}. A entrada e as parcelas obedecem ao quadro financeiro deste documento, que integra o contrato para todos os fins.`
  const signatureTerm = 'A assinatura poderá ocorrer eletronicamente ou em via física. O sistema identifica a versão apresentada e registra a modalidade e a data informadas; na assinatura presencial, a via física é a evidência original. Os dados pessoais serão utilizados para execução do contrato, atendimento, cobrança e cumprimento de obrigações legais, com acesso restrito às finalidades do serviço.'

  return {
    ...snapshot,
    generatedAt: recordedAt.toISOString(),
    company: { ...snapshot.company },
    client: { ...snapshot.client },
    project: {
      ...snapshot.project,
      id: projectId,
      name: projectName,
      room: environmentNames.join(', '),
      environments: [...environmentNames],
      approvalDate: approvalDate.toISOString(),
      scope: snapshot.project.scope?.map((scope) => ({
        ...scope,
        furniture: [...scope.furniture],
        specifications: [...scope.specifications],
        items: scope.items?.map((item) => ({ ...item })),
      })),
    },
    payment: {
      ...snapshot.payment,
      method: 'BOLETO',
      methodLabel: roundCurrency(snapshot.payment.downPayment) > 0
        ? `Entrada via ${standaloneEntryPaymentMethodLabel(entryPaymentMethod as StandaloneEntryPaymentMethod)} + saldo em boleto`
        : 'Boleto parcelado',
      summary: paymentSummary,
      paymentDiscount: 0,
      cardFeePercent: 0,
      cardFeeAmount: 0,
      schedule: snapshot.payment.schedule.map((payment) => ({ ...payment })),
    },
    terms: snapshot.terms.map((term) => {
      if (term.title === 'Preço e condição de pagamento') return { ...term, text: paymentTerm }
      if (term.title === 'Aceite eletrônico e proteção de dados') {
        return { title: 'Assinatura, registros e proteção de dados', text: signatureTerm }
      }
      return { ...term }
    }),
  } satisfies ProjectContractSnapshot
}

const GENERIC_ENVIRONMENTS = new Set([
  'servico contratado',
  'serviço contratado',
  'contrato avulso',
])

function normalizedEnvironmentKey(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR')
}

function scopeNoteLines(snapshot: ProjectContractSnapshot) {
  return (snapshot.project.scope || [])
    .flatMap((scope) => scope.items || [])
    .flatMap((item) => (item.notes || '').split(/\r?\n/))
    .map((line) => line.replace(/^[\s•*-]+/, '').trim())
    .filter((line) => line.length >= 2 && line.length <= 120)
}

export function standaloneContractEnvironmentNames(snapshot: ProjectContractSnapshot) {
  const declared = normalizeEnvironmentNames(snapshot.project.environments, snapshot.project.room)
  const specificDeclared = declared.filter(
    (name) => !GENERIC_ENVIRONMENTS.has(normalizedEnvironmentKey(name)),
  )
  if (specificDeclared.length > 0) return specificDeclared

  const noteLines = scopeNoteLines(snapshot)
  if (noteLines.length >= 2) return normalizeEnvironmentNames(noteLines, snapshot.project.name)

  return declared.length > 0
    ? declared
    : normalizeEnvironmentNames(undefined, snapshot.project.room || snapshot.project.name)
}

export function standaloneContractSuggestedPaymentDate(snapshot: ProjectContractSnapshot) {
  const firstPayment = snapshot.payment.schedule.find((payment) => payment.type === 'DOWN_PAYMENT')
    || snapshot.payment.schedule[0]
  const date = toDateOnlyUtc(firstPayment?.dueDate || snapshot.project.approvalDate)
  return date?.toISOString().slice(0, 10) || ''
}

export function standaloneContractPaymentMethod(snapshot: ProjectContractSnapshot) {
  if (snapshot.payment.method === 'PIX') return 'PIX' as const
  if (snapshot.payment.method === 'CARD') return 'CARD' as const
  throw new Error('UNSUPPORTED_PAYMENT_METHOD')
}

export function standaloneContractProjectPaymentMethod(
  snapshot: ProjectContractSnapshot,
  balancePaymentMethod?: StandaloneBalancePaymentMethod,
) {
  const contractMethod = standaloneContractPaymentMethod(snapshot)
  if (contractMethod === 'PIX') {
    if (balancePaymentMethod) throw new Error('BALANCE_PAYMENT_METHOD_NOT_ALLOWED')
    return 'PIX' as const
  }
  return balancePaymentMethod || 'CARD'
}

export function buildStandaloneContractProjectPayments({
  snapshot,
  paymentConfirmedAt,
  entryPaymentMethod,
}: {
  snapshot: ProjectContractSnapshot
  paymentConfirmedAt: Date
  entryPaymentMethod?: StandaloneEntryPaymentMethod
}) {
  const paymentMethod = standaloneContractPaymentMethod(snapshot)
  const total = roundCurrency(snapshot.project.value)
  const normalizedSchedule = snapshot.payment.schedule.map((payment) => ({
    ...payment,
    amount: roundCurrency(payment.amount),
  }))
  const scheduleTotal = roundCurrency(
    normalizedSchedule.reduce((sum, payment) => sum + payment.amount, 0),
  )
  if (
    !Number.isFinite(total)
    || total <= 0
    || normalizedSchedule.length === 0
    || normalizedSchedule.some((payment) => (
      !Number.isFinite(payment.amount)
      || payment.amount <= 0
      || !['DOWN_PAYMENT', 'INSTALLMENT'].includes(payment.type)
    ))
    || scheduleTotal !== total
  ) {
    throw new Error('INVALID_PAYMENT_SCHEDULE')
  }

  if (paymentMethod === 'PIX') {
    const dueDate = toDateOnlyUtc(normalizedSchedule[0]?.dueDate || paymentConfirmedAt)
    if (normalizedSchedule.length !== 1 || normalizedSchedule[0].amount !== total || !dueDate) {
      throw new Error('INVALID_PAYMENT_SCHEDULE')
    }
    return [{
      installmentNumber: 0,
      type: 'DOWN_PAYMENT',
      amount: total,
      dueDate,
      paidAt: paymentConfirmedAt,
      paymentMethod: 'PIX',
    }]
  }

  const downPayment = roundCurrency(snapshot.payment.downPayment)
  const downPayments = normalizedSchedule.filter((payment) => payment.type === 'DOWN_PAYMENT')
  const installments = normalizedSchedule.filter((payment) => payment.type === 'INSTALLMENT')
  const validDownPayment = downPayment > 0
    ? downPayments.length === 1 && downPayments[0].amount === downPayment
    : downPayments.length === 0
  const validInstallments = installments.every(
    (payment) => Number.isInteger(payment.number) && payment.number >= 1,
  )
  if (!Number.isFinite(downPayment) || downPayment < 0 || !validDownPayment || !validInstallments) {
    throw new Error('INVALID_PAYMENT_SCHEDULE')
  }
  if (downPayment > 0 && !entryPaymentMethod) throw new Error('ENTRY_PAYMENT_METHOD_REQUIRED')

  const seen = new Set<string>()
  return normalizedSchedule.map((payment) => {
    const dueDate = toDateOnlyUtc(payment.dueDate)
    const installmentNumber = payment.type === 'DOWN_PAYMENT' ? 0 : payment.number
    const type = payment.type === 'DOWN_PAYMENT' ? 'DOWN_PAYMENT' : 'INSTALLMENT'
    const key = `${type}:${installmentNumber}`
    if (!dueDate || payment.amount <= 0 || seen.has(key)) throw new Error('INVALID_PAYMENT_SCHEDULE')
    seen.add(key)
    const received = type === 'DOWN_PAYMENT' && downPayment > 0
    return {
      installmentNumber,
      type,
      amount: payment.amount,
      dueDate,
      paidAt: received ? paymentConfirmedAt : null,
      paymentMethod: received ? entryPaymentMethod : null,
    }
  })
}

export function standaloneContractConversionPreview(snapshot: ProjectContractSnapshot) {
  const paymentMethod = standaloneContractPaymentMethod(snapshot)
  const environmentNames = standaloneContractEnvironmentNames(snapshot)
  if (
    !Number.isInteger(snapshot.project.deliveryBusinessDays)
    || snapshot.project.deliveryBusinessDays < 1
    || snapshot.project.deliveryBusinessDays > 365
  ) {
    throw new Error('INVALID_CONTRACT_TERMS')
  }
  return {
    title: snapshot.project.name,
    clientName: snapshot.client.name,
    value: roundCurrency(snapshot.project.value),
    paymentMethod,
    downPayment: roundCurrency(paymentMethod === 'PIX' ? snapshot.project.value : snapshot.payment.downPayment),
    installmentCount: paymentMethod === 'PIX'
      ? 0
      : snapshot.payment.schedule.filter((payment) => payment.type !== 'DOWN_PAYMENT').length,
    installmentValue: roundCurrency(paymentMethod === 'PIX' ? 0 : snapshot.payment.installmentValue),
    firstInstallmentDate: paymentMethod === 'PIX' ? null : snapshot.payment.firstInstallmentDate,
    suggestedPaymentDate: standaloneContractSuggestedPaymentDate(snapshot),
    environmentNames,
    deliveryBusinessDays: snapshot.project.deliveryBusinessDays,
    deliveryDeadlineDate: snapshot.project.deliveryDeadlineDate,
  }
}
