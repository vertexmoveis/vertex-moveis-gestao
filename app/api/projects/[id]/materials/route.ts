import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { badRequest, canAccessProject, forbidden, requireAuth, requireRole, type AuthenticatedUser } from '@/lib/security'
import { moneyValue, optionalMoneyValue, type NumericValue } from '@/lib/money'

const optionalText = (max: number) => z.preprocess(
  (value) => value === '' ? null : value,
  z.string().trim().max(max).nullable().optional()
).transform((value) => value || null)

const projectMaterialSchema = z.object({
  materialId: optionalText(80),
  materialName: z.string().trim().min(2, 'Informe o material').max(120),
  finish: optionalText(120),
  unit: z.enum(['m2', 'metro', 'unidade']).default('m2'),
  estimatedQuantity: z.coerce.number().min(0).default(0),
  purchasedQuantity: z.coerce.number().min(0).default(0),
  estimatedCost: z.coerce.number().min(0).default(0),
  actualCost: z.coerce.number().min(0).nullable().optional(),
  supplier: optionalText(120),
  status: z.enum(['PENDING', 'ORDERED', 'RECEIVED']).default('PENDING'),
  notes: optionalText(800),
}).strict()

function serializeMaterial(material: {
  id: string
  materialId: string | null
  materialName: string
  finish: string | null
  unit: string
  estimatedQuantity: number
  purchasedQuantity: number
  estimatedCost: NumericValue
  actualCost: NumericValue
  supplier: string | null
  status: string
  notes: string | null
  updatedAt: Date
}) {
  return {
    ...material,
    estimatedCost: moneyValue(material.estimatedCost),
    actualCost: optionalMoneyValue(material.actualCost),
    updatedAt: material.updatedAt.toISOString(),
  }
}

async function checkAccess(projectId: string, user: AuthenticatedUser) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, archivedAt: null },
    select: { managerId: true },
  })
  if (!project) return { ok: false as const, missing: true }
  return { ok: canAccessProject(user, project.managerId), missing: false }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const access = await checkAccess(id, auth.user)
  if (access.missing) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
  if (!access.ok) return forbidden()

  const materials = await prisma.projectMaterial.findMany({
    where: { projectId: id },
    orderBy: [{ status: 'asc' }, { materialName: 'asc' }],
  })
  return NextResponse.json(materials.map((material) => {
    const serialized = serializeMaterial(material)
    return auth.user.role === 'ADMIN'
      ? serialized
      : { ...serialized, estimatedCost: null, actualCost: null, supplier: null }
  }))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Dados inválidos')
  }
  const parsed = projectMaterialSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')

  const project = await prisma.project.findFirst({
    where: { id, archivedAt: null },
    select: { id: true },
  })
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

  try {
    const material = await prisma.projectMaterial.create({ data: { projectId: id, ...parsed.data } })
    return NextResponse.json(serializeMaterial(material), { status: 201 })
  } catch {
    return badRequest('Não foi possível adicionar o material')
  }
}
