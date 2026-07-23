import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ensureDefaultQuoteSettings } from '@/lib/quote-price-rules'
import { badRequest, requireAuth, requireRole } from '@/lib/security'
import { moneyValue, type NumericValue } from '@/lib/money'

const optionalText = (max: number) => z.preprocess(
  (value) => value === '' ? null : value,
  z.string().trim().max(max).nullable().optional()
).transform((value) => value || null)

const materialSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do material').max(120),
  category: optionalText(80),
  defaultFinish: optionalText(120),
  unit: z.string().trim().min(1).max(30).default('m2'),
  unitCost: z.coerce.number().min(0, 'Informe um custo válido').default(0),
  supplier: optionalText(120),
  active: z.boolean().default(true),
}).strict()

function serializeMaterial(material: {
  id: string
  name: string
  category: string | null
  defaultFinish: string | null
  unit: string
  unitCost: NumericValue
  supplier: string | null
  active: boolean
  updatedAt: Date
}) {
  return { ...material, unitCost: moneyValue(material.unitCost), updatedAt: material.updatedAt.toISOString() }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  await ensureDefaultQuoteSettings(prisma)
  const activeOnly = new URL(req.url).searchParams.get('active') === '1'
  const materials = await prisma.materialCatalogItem.findMany({
    where: activeOnly ? { active: true } : {},
    orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(materials.map(serializeMaterial))
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

  const parsed = materialSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')

  try {
    const material = await prisma.materialCatalogItem.create({ data: parsed.data })
    return NextResponse.json(serializeMaterial(material), { status: 201 })
  } catch {
    return badRequest('Já existe um material com esse nome')
  }
}
