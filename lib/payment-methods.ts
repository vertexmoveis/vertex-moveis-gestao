export const PAYMENT_METHODS = [
  { value: 'PIX', label: 'Pix' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO', label: 'Cartão' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value']

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && PAYMENT_METHODS.some((method) => method.value === value)
}

export function paymentMethodLabel(value: string | null | undefined) {
  return PAYMENT_METHODS.find((method) => method.value === value)?.label || 'Não informado'
}
