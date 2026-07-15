import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { serializeQuotePriceRule } from '@/lib/quote-price-rules'
import { badRequest, requireRole } from '@/lib/security'
import { toDateOnlyUtc } from '@/lib/date-only'

const optionalText = (max: number) => z.preprocess(
  (value) => value === '' ? null : value,
  z.string().trim().max(max).nullable().optional()
).transform((value) => value || null)

const priceRuleSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da regra').max(120),
  environment: optionalText(120),
  furnitureType: optionalText(120),
  furnitureModel: optionalText(160),
  priceProfile: optionalText(40),
  calculationMode: z.enum(['AREA_M2', 'LINEAR_METER', 'UNIT']).default('AREA_M2'),
  pricePerM2: z.coerce.number().positive('Informe um preço maior que zero'),
  materialCostPerM2: z.coerce.number().min(0, 'Informe um custo válido').nullable().optional(),
  validFrom: optionalText(20),
  validUntil: optionalText(20),
  active: z.boolean().default(true),
}).strict()

function parseDate(value: string | null | undefined, label: string) {
  if (!value) return null
  const date = toDateOnlyUtc(value)
  if (!date || Number.isNaN(date.getTime())) throw new Error(`${label} inválida`)
  return date
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Dados inválidos')
  }

  const parsed = priceRuleSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')

  try {
    const { id } = await params
    const validFrom = parseDate(parsed.data.validFrom, 'Data de início') || new Date()
    const validUntil = parseDate(parsed.data.validUntil, 'Data final')
    if (validUntil && validUntil < validFrom) return badRequest('A data final deve ser posterior à data de início')

    const rule = await prisma.quotePriceRule.update({
      where: { id },
      data: { ...parsed.data, validFrom, validUntil },
    })
    return NextResponse.json(serializeQuotePriceRule(rule))
  } catch {
    return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { id } = await params
  try {
    await prisma.quotePriceRule.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 })
  }
}
