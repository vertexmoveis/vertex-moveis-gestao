import { moneyValue, type NumericValue } from '@/lib/money'
import { PAYMENT_TYPE_DOWN_PAYMENT } from '@/lib/payments'
import { isDateOnlyExpired } from '@/lib/date-only'

// Contracts became part of the standard production workflow on this date.
const PROJECT_CONTRACT_WORKFLOW_STARTED_AT = new Date('2026-08-03T03:00:00.000Z')

export type ProjectContractWorkflowStatus = 'NONE' | 'DRAFT' | 'SENT' | 'SIGNED' | 'VOID' | 'EXPIRED'
export type ProjectContractRequirement = 'REQUIRED' | 'OPTIONAL_LEGACY' | 'WAIVED'

export type ProjectWorkflowPayment = {
  type: string
  amount?: NumericValue
  paidAt: Date | string | null
  dueDate?: Date | string | null
}

export type ProjectFinancialReadiness = {
  ready: boolean
  label: string
  detail: string
  hasOverdueInstallments: boolean
  expectedInitialAmount: number
  paidInitialAmount: number
}

function validDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isLegacyContractProject(createdAt: Date | string) {
  const created = validDate(createdAt)
  return Boolean(created && created.getTime() < PROJECT_CONTRACT_WORKFLOW_STARTED_AT.getTime())
}

export function getProjectFinancialReadiness(input: {
  paymentConfirmedAt?: Date | string | null
  downPayment?: NumericValue
  payments: ProjectWorkflowPayment[]
  now?: Date
}): ProjectFinancialReadiness {
  const now = input.now || new Date()
  const paidPayments = input.payments.filter((payment) => Boolean(payment.paidAt))
  const downPayment = Math.max(moneyValue(input.downPayment), 0)
  const paidEntranceAmount = paidPayments
    .filter((payment) => payment.type === PAYMENT_TYPE_DOWN_PAYMENT)
    .reduce((sum, payment) => sum + moneyValue(payment.amount), 0)
  const hasOverdueInstallments = input.payments.some(
    (payment) => !payment.paidAt && isDateOnlyExpired(payment.dueDate, now),
  )

  if (input.paymentConfirmedAt) {
    return {
      ready: true,
      label: 'Pagamento inicial confirmado',
      detail: hasOverdueInstallments
        ? 'A produção está liberada; existem parcelas vencidas para tratar no Financeiro.'
        : 'A produção está liberada. Parcelas futuras continuam no Financeiro.',
      hasOverdueInstallments,
      expectedInitialAmount: downPayment,
      paidInitialAmount: Math.max(paidEntranceAmount, downPayment),
    }
  }

  if (downPayment > 0) {
    if (paidEntranceAmount + 0.009 >= downPayment) {
      return {
        ready: true,
        label: 'Entrada recebida',
        detail: hasOverdueInstallments
          ? 'A entrada libera a produção; existem parcelas vencidas para cobrar.'
          : 'A entrada libera a produção. As demais parcelas não bloqueiam o projeto.',
        hasOverdueInstallments,
        expectedInitialAmount: downPayment,
        paidInitialAmount: paidEntranceAmount,
      }
    }
    return {
      ready: false,
      label: paidEntranceAmount > 0 ? 'Entrada recebida parcialmente' : 'Entrada pendente',
      detail: paidEntranceAmount > 0
        ? `Ainda faltam R$ ${(downPayment - paidEntranceAmount).toFixed(2).replace('.', ',')} da entrada para liberar a produção.`
        : 'Confirme o recebimento da entrada para liberar a produção.',
      hasOverdueInstallments,
      expectedInitialAmount: downPayment,
      paidInitialAmount: paidEntranceAmount,
    }
  }

  if (paidPayments.length > 0) {
    return {
      ready: true,
      label: 'Primeiro pagamento recebido',
      detail: hasOverdueInstallments
        ? 'A produção está liberada; existem parcelas vencidas para cobrar.'
        : 'A produção está liberada. Parcelas futuras seguem no Financeiro.',
      hasOverdueInstallments,
      expectedInitialAmount: 0,
      paidInitialAmount: paidPayments.reduce((sum, payment) => sum + moneyValue(payment.amount), 0),
    }
  }

  return {
    ready: false,
    label: 'Pagamento inicial pendente',
    detail: 'Registre a confirmação do pagamento ou o recebimento inicial.',
    hasOverdueInstallments,
    expectedInitialAmount: downPayment,
    paidInitialAmount: paidEntranceAmount,
  }
}

export function getProjectContractReadiness(input: {
  createdAt?: Date | string
  requirement?: ProjectContractRequirement | null
  contractStatus?: ProjectContractWorkflowStatus | null
  viewedAt?: Date | string | null
  revisionRequiredAt?: Date | string | null
  waivedReason?: string | null
}) {
  const requirement = input.requirement
    || (input.createdAt && isLegacyContractProject(input.createdAt) ? 'OPTIONAL_LEGACY' : 'REQUIRED')
  const legacy = requirement === 'OPTIONAL_LEGACY'
  const waived = requirement === 'WAIVED'
  const signed = input.contractStatus === 'SIGNED'

  if (waived) {
    return {
      ready: true,
      required: false,
      legacy: false,
      waived: true,
      label: 'Contrato dispensado',
      detail: input.waivedReason
        ? `Dispensa registrada: ${input.waivedReason}`
        : 'O administrador dispensou o contrato deste projeto.',
    }
  }

  if (input.revisionRequiredAt) {
    const replacementSent = input.contractStatus === 'SENT'
    return {
      ready: legacy,
      required: !legacy,
      legacy,
      waived: false,
      label: replacementSent
        ? 'Nova versão aguardando assinatura'
        : legacy
          ? 'Projeto antigo: contrato precisa ser atualizado'
          : 'Nova versão do contrato necessária',
      detail: replacementSent
        ? 'A versão atualizada foi enviada e ainda aguarda o aceite do cliente.'
        : legacy
          ? 'O projeto pode continuar, mas gere uma nova versão com os dados atualizados.'
          : 'Os dados comerciais mudaram. Gere e envie uma nova versão antes da produção.',
    }
  }

  if (signed) {
    return {
      ready: true,
      required: requirement === 'REQUIRED',
      legacy,
      waived: false,
      label: 'Contrato assinado',
      detail: 'O aceite do cliente está registrado.',
    }
  }

  if (legacy) {
    return {
      ready: true,
      required: false,
      legacy: true,
      waived: false,
      label: 'Projeto antigo: contrato em aberto',
      detail: 'Este projeto pode andar, mas o contrato continua aguardando o cliente.',
    }
  }

  if (input.contractStatus === 'SENT') {
    return {
      ready: false,
      required: true,
      legacy: false,
      waived: false,
      label: input.viewedAt ? 'Contrato visualizado' : 'Contrato enviado',
      detail: input.viewedAt
        ? 'O cliente abriu o contrato e ainda não registrou o aceite.'
        : 'Aguardando o cliente abrir e aceitar o contrato.',
    }
  }

  return {
    ready: false,
    required: true,
    legacy: false,
    waived: false,
    label: 'Contrato pendente',
    detail: 'Crie e envie o contrato antes de liberar a produção.',
  }
}
