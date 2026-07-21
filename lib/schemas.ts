import { z } from 'zod'
import { toDateOnlyUtc } from '@/lib/date-only'

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value)
const nullableString = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional()).transform((v) => v || null)

export const projectStatuses = [
  'APPROVED',
  'MEASUREMENT_SCHEDULED',
  'DESIGN_ENGINEERING',
  'PROJECT_READY',
  'IN_PRODUCTION',
  'INSTALLATION_SCHEDULED',
  'COMPLETED',
  'DELAYED',
] as const

export const productionStages = [
  'PENDING_START',
  'MEASUREMENT',
  'DESIGN',
  'PROJECT_READY',
  'PRODUCTION',
  'TRANSPORTATION',
  'INSTALLATION',
  'COMPLETED',
] as const

const dateField = z
  .preprocess(emptyToUndefined, z.string().trim().optional())
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), 'Invalid date')
  .transform((value) => (value ? toDateOnlyUtc(value) : null))

const moneyField = z
  .preprocess(emptyToUndefined, z.union([z.string(), z.number()]).optional())
  .transform((value) => {
    if (value === undefined) return null
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN
  })
  .refine((value) => value === null || !Number.isNaN(value), 'Invalid value')

const installmentCountField = z
  .preprocess(emptyToUndefined, z.union([z.string(), z.number()]).optional())
  .transform((value) => {
    if (value === undefined) return 0
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN
  })
  .refine((value) => !Number.isNaN(value), 'Invalid installment count')

const businessDaysField = (fallback: number) =>
  z
    .preprocess(emptyToUndefined, z.union([z.string(), z.number()]).optional())
    .transform((value) => {
      if (value === undefined) return fallback
      const parsed = typeof value === 'number' ? value : Number(value)
      return Number.isInteger(parsed) && parsed >= 1 && parsed <= 365 ? parsed : Number.NaN
    })
    .refine((value) => !Number.isNaN(value), 'Invalid business day count')

const environmentsField = z
  .preprocess(
    (value) => {
      if (typeof value === 'string') return value.split(/[,;\n]+/)
      return value
    },
    z.array(z.string().trim().min(1).max(120)).max(60).optional()
  )
  .transform((value) => value || [])

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  document: nullableString(30),
  phone: nullableString(30),
  whatsapp: nullableString(30),
  email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email().max(160).optional()
  ).transform((v) => v || null),
  address: nullableString(240),
  street: nullableString(160),
  number: nullableString(30),
  neighborhood: nullableString(100),
  city: nullableString(100),
  state: nullableString(40),
  zipCode: nullableString(20),
  notes: nullableString(1000),
}).strict()

export const clientUpdateSchema = clientCreateSchema

export const projectCreateSchema = z.object({
  clientId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  room: nullableString(500),
  environments: environmentsField,
  status: z.enum(projectStatuses).default('APPROVED'),
  stage: z.enum(productionStages).default('PENDING_START'),
  approvalDate: dateField,
  paymentConfirmedAt: dateField,
  deliveryBusinessDays: businessDaysField(30),
  productionReminderBusinessDays: businessDaysField(7),
  startDate: dateField,
  estimatedEndDate: dateField,
  value: moneyField,
  productionCost: moneyField.default(0),
  downPayment: moneyField.default(null),
  downPaymentDate: dateField,
  installmentCount: installmentCountField.default(0),
  firstInstallmentDate: dateField,
  managerId: nullableString(80),
  internalNotes: nullableString(2000),
}).strict().refine((value) => {
  if (value.value === null || value.downPayment === null) return true
  return value.downPayment <= value.value
}, 'Down payment cannot exceed total value')

export const projectUpdateSchema = projectCreateSchema

export const projectPatchSchema = z.object({
  status: z.enum(projectStatuses).optional(),
  stage: z.enum(productionStages).optional(),
  actualEndDate: dateField.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No fields to update')

export const noteCreateSchema = z.object({
  content: z.string().trim().min(1).max(2000),
}).strict()
