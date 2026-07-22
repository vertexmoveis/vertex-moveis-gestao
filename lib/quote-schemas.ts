import { z } from 'zod'
import { toDateOnlyUtc } from '@/lib/date-only'
import { QUOTE_STATUSES } from '@/lib/quotes'

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value)
const nullableString = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional()).transform((value) => value || null)

const dateField = z
  .preprocess(emptyToUndefined, z.string().trim().optional())
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), 'Data inválida')
  .transform((value) => (value ? toDateOnlyUtc(value) : null))

const moneyField = (fallback = 0) =>
  z
    .preprocess(emptyToUndefined, z.union([z.string(), z.number()]).optional())
    .transform((value) => {
      if (value === undefined) return fallback
      const parsed = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN
    })
    .refine((value) => !Number.isNaN(value), 'Valor inválido')

const percentField = z
  .preprocess(emptyToUndefined, z.union([z.string(), z.number()]).optional())
  .transform((value) => {
    if (value === undefined) return 35
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 300 ? parsed : Number.NaN
  })
  .refine((value) => !Number.isNaN(value), 'Percentual inválido')

const positiveNumberField = z
  .preprocess(emptyToUndefined, z.union([z.string(), z.number()]))
  .transform((value) => {
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.NaN
  })
  .refine((value) => !Number.isNaN(value), 'Medida inválida')

const optionalNumberField = z
  .preprocess(emptyToUndefined, z.union([z.string(), z.number(), z.null()]).optional())
  .transform((value) => {
    if (value === undefined || value === null) return null
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN
  })
  .refine((value) => value === null || !Number.isNaN(value), 'Medida inválida')

const quantityField = z
  .preprocess(emptyToUndefined, z.union([z.string(), z.number()]).optional())
  .transform((value) => {
    if (value === undefined) return 1
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 999 ? parsed : Number.NaN
  })
  .refine((value) => !Number.isNaN(value), 'Quantidade inválida')

const cardInstallmentsField = z
  .preprocess(emptyToUndefined, z.union([z.string(), z.number()]).optional())
  .transform((value) => {
    if (value === undefined) return 1
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 24 ? parsed : Number.NaN
  })
  .refine((value) => !Number.isNaN(value), 'Informe de 1 a 24 parcelas')

const cardFeePercentField = z
  .preprocess(emptyToUndefined, z.union([z.string(), z.number()]).optional())
  .transform((value) => {
    if (value === undefined) return 0
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 30 ? parsed : Number.NaN
  })
  .refine((value) => !Number.isNaN(value), 'Informe uma taxa entre 0% e 30%')

const deliveryBusinessDaysField = z
  .preprocess(emptyToUndefined, z.union([z.string(), z.number()]).optional())
  .transform((value) => {
    if (value === undefined) return 30
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 365 ? parsed : Number.NaN
  })
  .refine((value) => !Number.isNaN(value), 'Informe um prazo entre 1 e 365 dias úteis')

export const quoteItemSchema = z.object({
  environment: z.string().trim().min(1, 'Informe o ambiente').max(120),
  environmentName: nullableString(120),
  description: z.string().trim().min(1, 'Informe o móvel').max(240),
  furnitureType: nullableString(120),
  furnitureModel: nullableString(160),
  material: nullableString(120),
  finish: nullableString(120),
  width: positiveNumberField,
  height: positiveNumberField,
  depth: optionalNumberField,
  difficulty: z.enum(['NORMAL', 'DIFICIL']).default('NORMAL'),
  calculationMode: z.enum(['AREA_M2', 'LINEAR_METER', 'UNIT']).default('AREA_M2'),
  priceProfile: z.enum(['STANDARD', 'WOODGRAIN', 'PROVENCAL', 'EXTERNAL_LACQUER']).default('STANDARD'),
  manualPrice: moneyField(0),
  accessories: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  quantity: quantityField,
  notes: nullableString(800),
}).superRefine((item, context) => {
  if (item.calculationMode !== 'AREA_M2' && item.manualPrice <= 0) {
    context.addIssue({
      code: 'custom',
      path: ['manualPrice'],
      message: item.calculationMode === 'LINEAR_METER'
        ? 'Informe o valor por metro linear'
        : 'Informe o valor por unidade',
    })
  }
})

export const quoteSaveSchema = z.object({
  clientId: z.string().trim().min(1, 'Selecione um cliente'),
  title: z.string().trim().min(1, 'Informe o título').max(160),
  status: z.enum(QUOTE_STATUSES as [string, ...string[]]).default('DRAFT'),
  validUntil: dateField,
  deliveryBusinessDays: deliveryBusinessDaysField,
  firstInstallmentDate: dateField,
  pricePerM2: moneyField(1250),
  materialCostPerM2: moneyField(650),
  installationFee: moneyField(0),
  marginPercent: percentField,
  discount: moneyField(0),
  paymentMethod: z.enum(['TO_DEFINE', 'PIX', 'CARD']).default('TO_DEFINE'),
  cardInstallments: cardInstallmentsField,
  cardDownPayment: moneyField(0),
  cardFeePercent: cardFeePercentField,
  notes: nullableString(2000),
  customerNotes: nullableString(2000),
  lossReason: nullableString(500),
  items: z.array(quoteItemSchema).min(1, 'Adicione pelo menos um item').max(80),
}).strict()

export const quoteStatusSchema = z.object({
  status: z.enum(QUOTE_STATUSES as [string, ...string[]]),
  lossReason: nullableString(500).optional(),
}).strict()
