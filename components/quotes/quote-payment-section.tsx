'use client'

import { Input, Select } from '@/components/ui/input'
import {
  QUOTE_PAYMENT_METHOD_LABELS,
  QUOTE_PAYMENT_METHODS,
  getQuotePaymentSummary,
  type QuotePaymentMethod,
} from '@/lib/quotes'
import { formatCurrency } from '@/lib/utils'

type QuotePaymentSectionProps = {
  paymentMethod: QuotePaymentMethod
  cardDownPayment: string
  cardInstallments: string
  cardFeePercent: string
  cardFeeAmount: number
  paymentDiscount: number
  total: number
  calculatedCardInstallments: number
  calculatedCardDownPayment: number
  onPaymentMethodChange: (value: QuotePaymentMethod) => void
  onCardDownPaymentChange: (value: string) => void
  onCardInstallmentsChange: (value: string) => void
  onCardFeePercentChange: (value: string) => void
}

export function QuotePaymentSection({
  paymentMethod,
  cardDownPayment,
  cardInstallments,
  cardFeePercent,
  cardFeeAmount,
  paymentDiscount,
  total,
  calculatedCardInstallments,
  calculatedCardDownPayment,
  onPaymentMethodChange,
  onCardDownPaymentChange,
  onCardInstallmentsChange,
  onCardFeePercentChange,
}: QuotePaymentSectionProps) {
  return (
    <fieldset className="grid grid-cols-1 gap-3 border-y border-[#E8E8E8] py-4 lg:grid-cols-[minmax(220px,1fr)_160px_160px_180px]">
      <legend className="sr-only">Condições de pagamento</legend>
      <Select
        label="Forma de pagamento"
        value={paymentMethod}
        onChange={(event) => onPaymentMethodChange(event.target.value as QuotePaymentMethod)}
        options={QUOTE_PAYMENT_METHODS.map((value) => ({
          value,
          label: QUOTE_PAYMENT_METHOD_LABELS[value],
        }))}
      />

      {paymentMethod === 'CARD' ? (
        <>
          <Input
            label="Entrada (R$)"
            inputMode="decimal"
            value={cardDownPayment}
            onChange={(event) => onCardDownPaymentChange(event.target.value)}
          />
          <Select
            label="Parcelas no cartão"
            value={cardInstallments}
            onChange={(event) => onCardInstallmentsChange(event.target.value)}
            options={Array.from({ length: 24 }, (_, index) => {
              const value = String(index + 1)
              return { value, label: `${value}x` }
            })}
          />
          <Input
            label="Taxa da operadora (%)"
            inputMode="decimal"
            value={cardFeePercent}
            onChange={(event) => onCardFeePercentChange(event.target.value)}
            helperText={`Custo estimado: ${formatCurrency(cardFeeAmount)}`}
          />
        </>
      ) : (
        <div className="flex min-h-10 items-center border-l-4 border-[#FF6B00] bg-[#FFF7ED] px-4 py-2 text-sm text-[#7A3B00] lg:col-span-2">
          {paymentMethod === 'PIX'
            ? `Desconto Pix: ${formatCurrency(paymentDiscount)} · Total: ${formatCurrency(total)}`
            : 'O pagamento será definido com o cliente.'}
        </div>
      )}

      {paymentMethod === 'CARD' ? (
        <div className="border-l-4 border-blue-500 bg-blue-50 px-4 py-2 text-sm text-blue-800 lg:col-span-4">
          {getQuotePaymentSummary({
            total,
            paymentMethod,
            cardInstallments: calculatedCardInstallments,
            cardDownPayment: calculatedCardDownPayment,
          })}
        </div>
      ) : null}
    </fieldset>
  )
}
