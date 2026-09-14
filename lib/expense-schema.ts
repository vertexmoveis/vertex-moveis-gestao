import { z } from 'zod'

export const expenseSchema = z.object({
  category: z.enum(['LABOR', 'FREIGHT', 'INSTALLATION', 'CONSUMABLES', 'REWORK', 'OTHER']),
  description: z.string().trim().min(2).max(160),
  amount: z.coerce.number().positive().max(10_000_000),
  incurredAt: z.string().date(),
  supplier: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).strict()
