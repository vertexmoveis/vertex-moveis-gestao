import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { badRequest, requireRole } from '@/lib/security'
import { moneyValue, numberValue, optionalMoneyValue, type NumericValue } from '@/lib/money'

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

const MATERIAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'precisa comprar',
  ORDERED: 'pedido feito',
  RECEIVED: 'recebido',
}

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; materialId: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Dados inválidos')
  }
  const parsed = projectMaterialSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')

  const { id, materialId } = await params
  try {
    const existing = await prisma.projectMaterial.findFirst({
      where: { id: materialId, projectId: id, project: { archivedAt: null } },
      include: { project: { select: { name: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
    const material = await prisma.$transaction(async (tx) => {
      const updated = await tx.projectMaterial.update({
        where: { id: materialId },
        data: parsed.data,
      })
      if (existing.status !== updated.status) {
        const statusLabel = MATERIAL_STATUS_LABELS[updated.status] || updated.status
        await tx.timelineEvent.create({
          data: {
            projectId: id,
            event: 'Material atualizado',
            description: `${updated.materialName}: ${statusLabel}.`,
          },
        })
      }
      if (numberValue(existing.actualCost) !== numberValue(updated.actualCost)) {
        await tx.timelineEvent.create({
          data: {
            projectId: id,
            event: 'Custo de material atualizado',
            description: `${updated.materialName}: custo real registrado.`,
          },
        })
      }
      return updated
    })
    return NextResponse.json(serializeMaterial(material))
  } catch (error) {
    console.error('Erro ao excluir material do projeto:', error)
    return NextResponse.json({ error: 'Não foi possível excluir o material.' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; materialId: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { id, materialId } = await params
  try {
    const existing = await prisma.projectMaterial.findFirst({
      where: { id: materialId, projectId: id, project: { archivedAt: null } },
    })
    if (!existing) return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
    await prisma.$transaction(async (tx) => {
      await tx.projectMaterial.delete({ where: { id: materialId } })
      await tx.timelineEvent.create({
        data: {
          projectId: id,
          event: 'Material removido',
          description: `${existing.materialName} foi removido da lista de compras.`,
        },
      })
      await tx.activityLog.create({
        data: {
          userId: auth.user.id,
          projectId: id,
          action: 'Material removido',
          details: `${existing.materialName} | previsto: ${existing.estimatedQuantity} ${existing.unit} | comprado: ${existing.purchasedQuantity} ${existing.unit} | custo previsto: ${existing.estimatedCost} | custo real: ${existing.actualCost ?? 'não informado'} | status: ${existing.status}`,
        },
      })
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
  }
}
