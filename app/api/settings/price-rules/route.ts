import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ensureDefaultQuoteSettings, serializeQuotePriceRule } from '@/lib/quote-price-rules'
import { badRequest, requireAuth, requireRole } from '@/lib/security'
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

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  await ensureDefaultQuoteSettings(prisma)
  const activeOnly = new URL(req.url).searchParams.get('active') === '1'
  const rules = await prisma.quotePriceRule.findMany({
    where: activeOnly ? { active: true } : {},
    orderBy: [{ active: 'desc' }, { environment: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(rules.map(serializeQuotePriceRule))
}

export async function POST(req: NextRequest) {
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
    const validFrom = parseDate(parsed.data.validFrom, 'Data de início') || new Date()
    const validUntil = parseDate(parsed.data.validUntil, 'Data final')
    if (validUntil && validUntil < validFrom) return badRequest('A data final deve ser posterior à data de início')

    const rule = await prisma.quotePriceRule.create({
      data: {
        ...parsed.data,
        validFrom,
        validUntil,
      },
    })
    return NextResponse.json(serializeQuotePriceRule(rule), { status: 201 })
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Não foi possível salvar a regra')
  }
}
