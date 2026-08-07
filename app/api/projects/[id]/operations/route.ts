import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { addBusinessDays } from '@/lib/business-days'
import { numberValue } from '@/lib/money'
import { calculateCommission, estimateSheets, minutesBetween, QUALITY_CHECKS } from '@/lib/operational-toolkit'
import { badRequest, canAccessProject, forbidden, requireAuth } from '@/lib/security'
import { maxReservableQuantity } from '@/lib/inventory-reservations'

const pieceSchema = z.object({
  action: z.literal('PIECE_CREATE'),
  environment: z.string().trim().max(120).nullable().optional(),
  label: z.string().trim().min(2).max(160),
  material: z.string().trim().min(2).max(120),
  finish: z.string().trim().max(120).nullable().optional(),
  widthMm: z.coerce.number().positive().max(10_000),
  heightMm: z.coerce.number().positive().max(10_000),
  quantity: z.coerce.number().int().min(1).max(500),
  grain: z.boolean().default(false),
  notes: z.string().trim().max(500).nullable().optional(),
}).strict()

const changeSchema = z.object({
  action: z.literal('CHANGE_CREATE'),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(1500),
  amountDelta: z.coerce.number().min(-1_000_000).max(1_000_000),
  daysDelta: z.coerce.number().int().min(0).max(365),
}).strict()

async function getProject(projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, archivedAt: null },
    select: { id: true, name: true, managerId: true, value: true, deliveryDeadlineDate: true, productionWeight: true },
  })
}

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => (
    typeof item === 'object' && item?.constructor?.name === 'Decimal' ? Number(item) : item
  ))) as T
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  const project = await getProject(id)
  if (!project || !canAccessProject(auth.user, project.managerId)) {
    return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
  }

  const [pieces, timeEntries, qualityRows, changes, proofs, reservations, commission, profile, projectMaterials] = await Promise.all([
    prisma.projectCutPiece.findMany({ where: { projectId: id }, orderBy: [{ status: 'asc' }, { createdAt: 'asc' }], take: 300 }),
    prisma.projectTimeEntry.findMany({
      where: { projectId: id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 100,
    }),
    prisma.projectQualityCheck.findMany({
      where: { projectId: id },
      include: { checkedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.projectChangeOrder.findMany({
      where: { projectId: id },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.projectDeliveryProof.findMany({ where: { projectId: id }, orderBy: { deliveredAt: 'desc' }, take: 20 }),
    prisma.inventoryReservation.findMany({
      where: { projectId: id },
      include: { material: { select: { id: true, name: true, unit: true, stockQuantity: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.salesCommission.findFirst({
      where: { projectId: id },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.companyProfile.findUnique({
      where: { id: 'vertex' },
      select: { standardSheetWidthMm: true, standardSheetHeightMm: true, sheetWastePercent: true },
    }),
    prisma.projectMaterial.findMany({
      where: { projectId: id, materialId: { not: null } },
      select: {
        materialId: true,
        materialName: true,
        finish: true,
        unit: true,
        estimatedQuantity: true,
        material: { select: { id: true, name: true, stockQuantity: true, unit: true } },
      },
      orderBy: { materialName: 'asc' },
    }),
  ])

  const qualityByKey = new Map(qualityRows.map((row) => [row.key, row]))
  const quality = QUALITY_CHECKS.map((item) => qualityByKey.get(item.key) || {
    id: null,
    projectId: id,
    key: item.key,
    label: item.label,
    status: 'PENDING',
    notes: null,
    checkedAt: null,
    checkedBy: null,
  })
  const sheetSettings = profile || { standardSheetWidthMm: 2750, standardSheetHeightMm: 1850, sheetWastePercent: 15 }

  return NextResponse.json(serialize({
    pieces,
    sheetEstimate: estimateSheets(pieces, sheetSettings.standardSheetWidthMm, sheetSettings.standardSheetHeightMm, sheetSettings.sheetWastePercent),
    sheetSettings,
    timeEntries,
    quality,
    changes,
    proofs,
    reservations,
    commission: auth.user.role === 'ADMIN' ? commission : null,
    productionWeight: project.productionWeight,
    reservationOptions: projectMaterials,
  }))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params
  const project = await getProject(id)
  if (!project || !canAccessProject(auth.user, project.managerId)) return forbidden()
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const action = typeof body?.action === 'string' ? body.action : ''

  if (action === 'PIECE_CREATE') {
    const parsed = pieceSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados da peça inválidos.')
    const data = {
      environment: parsed.data.environment,
      label: parsed.data.label,
      material: parsed.data.material,
      finish: parsed.data.finish,
      widthMm: parsed.data.widthMm,
      heightMm: parsed.data.heightMm,
      quantity: parsed.data.quantity,
      grain: parsed.data.grain,
      notes: parsed.data.notes,
    }
    const piece = await prisma.projectCutPiece.create({ data: { projectId: id, createdById: auth.user.id, ...data } })
    return NextResponse.json(piece, { status: 201 })
  }

  if (action === 'PIECE_STATUS') {
    const parsed = z.object({ action: z.literal('PIECE_STATUS'), pieceId: z.string().min(1), status: z.enum(['PLANNED', 'CUT', 'LABELED', 'ASSEMBLED']) }).strict().safeParse(body)
    if (!parsed.success) return badRequest('Situação da peça inválida.')
    const updated = await prisma.projectCutPiece.updateMany({ where: { id: parsed.data.pieceId, projectId: id }, data: { status: parsed.data.status } })
    return NextResponse.json({ updated: updated.count })
  }

  if (action === 'PIECE_DELETE') {
    const parsed = z.object({ action: z.literal('PIECE_DELETE'), pieceId: z.string().min(1) }).strict().safeParse(body)
    if (!parsed.success) return badRequest()
    const deleted = await prisma.projectCutPiece.deleteMany({ where: { id: parsed.data.pieceId, projectId: id } })
    return NextResponse.json({ deleted: deleted.count })
  }

  if (action === 'TIME_START') {
    const parsed = z.object({ action: z.literal('TIME_START'), phase: z.enum(['MEASUREMENT', 'DESIGN', 'PRODUCTION', 'INSTALLATION']), notes: z.string().trim().max(500).nullable().optional() }).strict().safeParse(body)
    if (!parsed.success) return badRequest('Informe uma etapa válida.')
    const openEntry = await prisma.projectTimeEntry.findFirst({ where: { userId: auth.user.id, endedAt: null }, select: { id: true, project: { select: { name: true } } } })
    if (openEntry) return NextResponse.json({ error: `Existe um apontamento aberto em ${openEntry.project.name}. Finalize-o primeiro.` }, { status: 409 })
    const entry = await prisma.projectTimeEntry.create({ data: { projectId: id, userId: auth.user.id, phase: parsed.data.phase, startedAt: new Date(), notes: parsed.data.notes || null }, include: { user: { select: { id: true, name: true } } } })
    return NextResponse.json(entry, { status: 201 })
  }

  if (action === 'TIME_STOP') {
    const parsed = z.object({ action: z.literal('TIME_STOP'), entryId: z.string().min(1) }).strict().safeParse(body)
    if (!parsed.success) return badRequest()
    const entry = await prisma.projectTimeEntry.findFirst({ where: { id: parsed.data.entryId, projectId: id, ...(auth.user.role === 'ADMIN' ? {} : { userId: auth.user.id }), endedAt: null } })
    if (!entry) return NextResponse.json({ error: 'Apontamento aberto não encontrado.' }, { status: 404 })
    const endedAt = new Date()
    const updated = await prisma.projectTimeEntry.update({ where: { id: entry.id }, data: { endedAt, minutes: minutesBetween(entry.startedAt, endedAt) }, include: { user: { select: { id: true, name: true } } } })
    return NextResponse.json(updated)
  }

  if (action === 'QUALITY_SET') {
    const parsed = z.object({ action: z.literal('QUALITY_SET'), key: z.enum(QUALITY_CHECKS.map((item) => item.key) as [typeof QUALITY_CHECKS[number]['key'], ...typeof QUALITY_CHECKS[number]['key'][]]), status: z.enum(['PENDING', 'PASSED', 'ISSUE']), notes: z.string().trim().max(500).nullable().optional() }).strict().safeParse(body)
    if (!parsed.success) return badRequest('Conferência inválida.')
    const definition = QUALITY_CHECKS.find((item) => item.key === parsed.data.key)!
    const check = await prisma.projectQualityCheck.upsert({
      where: { projectId_key: { projectId: id, key: parsed.data.key } },
      create: { projectId: id, key: definition.key, label: definition.label, status: parsed.data.status, notes: parsed.data.notes || null, checkedById: auth.user.id, checkedAt: parsed.data.status === 'PENDING' ? null : new Date() },
      update: { status: parsed.data.status, notes: parsed.data.notes || null, checkedById: auth.user.id, checkedAt: parsed.data.status === 'PENDING' ? null : new Date() },
      include: { checkedBy: { select: { id: true, name: true } } },
    })
    return NextResponse.json(check)
  }

  if (action === 'CHANGE_CREATE') {
    const parsed = changeSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Alteração inválida.')
    const data = {
      title: parsed.data.title,
      description: parsed.data.description,
      amountDelta: parsed.data.amountDelta,
      daysDelta: parsed.data.daysDelta,
    }
    const change = await prisma.projectChangeOrder.create({ data: { projectId: id, createdById: auth.user.id, ...data }, include: { createdBy: { select: { id: true, name: true } } } })
    return NextResponse.json(serialize(change), { status: 201 })
  }

  if (action === 'CHANGE_STATUS') {
    const parsed = z.object({ action: z.literal('CHANGE_STATUS'), changeId: z.string().min(1), status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED']) }).strict().safeParse(body)
    if (!parsed.success) return badRequest()
    const existing = await prisma.projectChangeOrder.findFirst({ where: { id: parsed.data.changeId, projectId: id } })
    if (!existing) return NextResponse.json({ error: 'Alteração não encontrada.' }, { status: 404 })
    if ((existing.status === 'APPROVED' || existing.status === 'REJECTED') && existing.status !== parsed.data.status) {
      return NextResponse.json({ error: 'Uma alteração finalizada não pode ser reaberta automaticamente.' }, { status: 409 })
    }
    const change = await prisma.$transaction(async (tx) => {
      if (parsed.data.status === 'APPROVED' && existing.status !== 'APPROVED') {
        const nextProjectValue = numberValue(project.value) + numberValue(existing.amountDelta)
        const deliveryDeadlineDate = existing.daysDelta > 0 && project.deliveryDeadlineDate
          ? addBusinessDays(project.deliveryDeadlineDate, existing.daysDelta)
          : project.deliveryDeadlineDate
        await tx.project.update({ where: { id }, data: { value: nextProjectValue, deliveryDeadlineDate } })
        const commissions = await tx.salesCommission.findMany({ where: { projectId: id }, select: { id: true, percent: true } })
        await Promise.all(commissions.map((commission) => tx.salesCommission.update({
          where: { id: commission.id },
          data: { amount: calculateCommission(nextProjectValue, commission.percent) },
        })))
        await tx.timelineEvent.create({ data: { projectId: id, event: 'Alteração aprovada', description: `${existing.title}: ajuste de R$ ${numberValue(existing.amountDelta).toFixed(2)} e ${existing.daysDelta} dia(s) útil(eis).` } })
      }
      return tx.projectChangeOrder.update({ where: { id: existing.id }, data: { status: parsed.data.status, approvedAt: parsed.data.status === 'APPROVED' ? new Date() : null }, include: { createdBy: { select: { id: true, name: true } } } })
    })
    return NextResponse.json(serialize(change))
  }

  if (action === 'RESERVATION_SET') {
    const parsed = z.object({ action: z.literal('RESERVATION_SET'), materialId: z.string().min(1), quantity: z.coerce.number().min(0).max(100_000) }).strict().safeParse(body)
    if (!parsed.success) return badRequest('Reserva inválida.')
    if (parsed.data.quantity === 0) {
      await prisma.inventoryReservation.deleteMany({ where: { projectId: id, materialId: parsed.data.materialId } })
      return NextResponse.json({ deleted: true })
    }
    const material = await prisma.materialCatalogItem.findUnique({
      where: { id: parsed.data.materialId },
      select: { id: true, stockQuantity: true },
    })
    if (!material) return NextResponse.json({ error: 'Material não encontrado.' }, { status: 404 })

    const [reserved, currentReservation] = await Promise.all([
      prisma.inventoryReservation.aggregate({
        where: { materialId: material.id, status: 'ACTIVE' },
        _sum: { quantity: true },
      }),
      prisma.inventoryReservation.findUnique({
        where: { projectId_materialId: { projectId: id, materialId: material.id } },
        select: { quantity: true, status: true },
      }),
    ])
    const maximum = maxReservableQuantity({
      stockQuantity: material.stockQuantity,
      activeReservedQuantity: reserved._sum.quantity || 0,
      currentProjectQuantity: currentReservation?.status === 'ACTIVE' ? currentReservation.quantity : 0,
    })
    if (parsed.data.quantity > maximum + 0.0001) {
      return NextResponse.json({
        error: `Estoque insuficiente. Há ${maximum.toLocaleString('pt-BR')} disponível para este projeto.`,
      }, { status: 409 })
    }
    const reservation = await prisma.inventoryReservation.upsert({
      where: { projectId_materialId: { projectId: id, materialId: parsed.data.materialId } },
      create: { projectId: id, materialId: parsed.data.materialId, quantity: parsed.data.quantity },
      update: { quantity: parsed.data.quantity, status: 'ACTIVE' },
      include: { material: { select: { id: true, name: true, unit: true, stockQuantity: true } } },
    })
    return NextResponse.json(reservation)
  }

  if (action === 'COMMISSION_SET') {
    if (auth.user.role !== 'ADMIN') return forbidden()
    const parsed = z.object({ action: z.literal('COMMISSION_SET'), userId: z.string().min(1), percent: z.coerce.number().min(0).max(100) }).strict().safeParse(body)
    if (!parsed.success) return badRequest('Comissão inválida.')
    const paid = await prisma.projectPayment.aggregate({ where: { projectId: id, paidAt: { not: null } }, _sum: { amount: true } })
    const available = numberValue(paid._sum.amount) > 0
    const commission = await prisma.salesCommission.upsert({
      where: { projectId_userId: { projectId: id, userId: parsed.data.userId } },
      create: { projectId: id, userId: parsed.data.userId, percent: parsed.data.percent, amount: calculateCommission(numberValue(project.value), parsed.data.percent), status: available ? 'AVAILABLE' : 'PENDING', availableAt: available ? new Date() : null },
      update: { percent: parsed.data.percent, amount: calculateCommission(numberValue(project.value), parsed.data.percent), status: available ? 'AVAILABLE' : 'PENDING', availableAt: available ? new Date() : null },
      include: { user: { select: { id: true, name: true } } },
    })
    return NextResponse.json(serialize(commission))
  }

  if (action === 'PRODUCTION_WEIGHT_SET') {
    const parsed = z.object({ action: z.literal('PRODUCTION_WEIGHT_SET'), weight: z.coerce.number().min(0.25).max(10) }).strict().safeParse(body)
    if (!parsed.success) return badRequest('Informe um peso entre 0,25 e 10 pontos.')
    const updated = await prisma.project.update({ where: { id }, data: { productionWeight: parsed.data.weight }, select: { productionWeight: true } })
    return NextResponse.json(updated)
  }

  return badRequest('Ação operacional inválida.')
}
