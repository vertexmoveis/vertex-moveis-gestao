import { z } from 'zod'

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value)
const nullableString = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional()).transform((v) => v || null)

export const projectStatuses = [
  'APPROVED',
  'MEASUREMENT_SCHEDULED',
  'DESIGN_ENGINEERING',
  'IN_PRODUCTION',
  'INSTALLATION_SCHEDULED',
  'COMPLETED',
  'DELAYED',
] as const

export const productionStages = [
  'PENDING_START',
  'MEASUREMENT',
  'DESIGN',
  'CUTTING',
  'MANUFACTURING',
  'FINISHING',
  'QUALITY_CONTROL',
  'PACKAGING',
  'TRANSPORTATION',
  'INSTALLATION',
  'COMPLETED',
] as const

const dateField = z
  .preprocess(emptyToUndefined, z.string().trim().optional())
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), 'Invalid date')
  .transform((value) => (value ? new Date(value) : null))

const moneyField = z
  .preprocess(emptyToUndefined, z.union([z.string(), z.number()]).optional())
  .transform((value) => {
    if (value === undefined) return null
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN
  })
  .refine((value) => value === null || !Number.isNaN(value), 'Invalid value')

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: nullableString(30),
  whatsapp: nullableString(30),
  email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email().max(160).optional()
  ).transform((v) => v || null),
  address: nullableString(240),
  notes: nullableString(1000),
}).strict()

export const clientUpdateSchema = clientCreateSchema

export const projectCreateSchema = z.object({
  clientId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  room: nullableString(80),
  status: z.enum(projectStatuses).default('APPROVED'),
  stage: z.enum(productionStages).default('PENDING_START'),
  startDate: dateField,
  estimatedEndDate: dateField,
  value: moneyField,
  managerId: nullableString(80),
  internalNotes: nullableString(2000),
}).strict()

export const projectUpdateSchema = projectCreateSchema

export const projectPatchSchema = z.object({
  status: z.enum(projectStatuses).optional(),
  stage: z.enum(productionStages).optional(),
  actualEndDate: dateField.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No fields to update')

export const noteCreateSchema = z.object({
  content: z.string().trim().min(1).max(2000),
}).strict()
