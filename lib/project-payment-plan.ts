import type { NumericValue } from '@/lib/money'
import { numberValue } from '@/lib/money'
import { roundCurrency } from '@/lib/payments'
import {
  safeQuoteCardDownPayment,
  safeQuoteCardFeePercent,
  safeQuoteCardInstallments,
  safeQuotePaymentMethod,
  isQuoteInstallmentPaymentMethod,
  type QuotePaymentMethod,
} from '@/lib/quotes'

export type ProjectPaymentPlanInput = {
  value: NumericValue
  paymentMethod?: string | null
  paymentDiscount?: NumericValue
  cardFeePercent?: number | null
  downPayment?: NumericValue
  downPaymentDate?: Date | null
  installmentCount?: number | null
  firstInstallmentDate?: Date | null
  paymentConfirmedAt?: Date | null
  baseDate?: Date | null
}

export type ProjectPaymentPlan = {
  paymentMethod: QuotePaymentMethod
  paymentDiscount: number
  cardFeePercent: number
  cardFeeAmount: number
  downPayment: number
  downPaymentDate: Date | null
  installmentCount: number
  firstInstallmentDate: Date | null
  baseDate: Date | null
}

export function calculateProjectPaymentPlan(input: ProjectPaymentPlanInput): ProjectPaymentPlan {
  const total = roundCurrency(Math.max(numberValue(input.value), 0))
  const paymentMethod = safeQuotePaymentMethod(input.paymentMethod)
  const baseDate = input.baseDate || input.paymentConfirmedAt || null

  if (paymentMethod === 'PIX') {
    return {
      paymentMethod,
      paymentDiscount: roundCurrency(Math.max(numberValue(input.paymentDiscount), 0)),
      cardFeePercent: 0,
      cardFeeAmount: 0,
      downPayment: total,
      downPaymentDate: input.downPaymentDate || input.paymentConfirmedAt || baseDate,
      installmentCount: 0,
      firstInstallmentDate: null,
      baseDate,
    }
  }

  if (isQuoteInstallmentPaymentMethod(paymentMethod)) {
    const downPayment = safeQuoteCardDownPayment(input.downPayment, total)
    const balance = roundCurrency(Math.max(total - downPayment, 0))
    const installmentCount = balance > 0 ? safeQuoteCardInstallments(input.installmentCount) : 0
    const cardFeePercent = paymentMethod === 'CARD' ? safeQuoteCardFeePercent(input.cardFeePercent) : 0

    return {
      paymentMethod,
      paymentDiscount: 0,
      cardFeePercent,
      cardFeeAmount: roundCurrency(balance * (cardFeePercent / 100)),
      downPayment,
      downPaymentDate: downPayment > 0
        ? input.downPaymentDate || input.paymentConfirmedAt || baseDate
        : null,
      installmentCount,
      firstInstallmentDate: balance > 0 ? input.firstInstallmentDate || null : null,
      baseDate,
    }
  }

  return {
    paymentMethod,
    paymentDiscount: 0,
    cardFeePercent: 0,
    cardFeeAmount: 0,
    downPayment: 0,
    downPaymentDate: null,
    installmentCount: 0,
    firstInstallmentDate: null,
    baseDate,
  }
}
