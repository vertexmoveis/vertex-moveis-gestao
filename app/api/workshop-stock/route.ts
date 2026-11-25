import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { badRequest, getClientIp, requireRole, serverError, serviceUnavailable } from '@/lib/security'
import {
  isCountedStockUnit,
  workshopStockItemTypes,
  workshopStockMovementKinds,
  workshopStockRoles,
  workshopStockUnits,
} from '@/lib/workshop-stock'
import {
  applyWorkshopStockOperation,
  readWorkshopStockMovements,
  serializeWorkshopStockItem,
  WorkshopStockError,
  workshopStockMaximum,
} from '@/lib/workshop-stock-ledger'

const itemId = z.string().trim().min(1).max(80)
const uuid = z.uuid().transform((value) => value.toLowerCase())
const textField = (max: number) => z.string().trim().max(max).nullish()
const quantityField = (minimum: number, maximum: number) => z.number()
  .min(minimum, minimum === 0 ? 'Informe uma quantidade igual ou maior que zero.' : 'Informe uma quantidade de pelo menos 0,001.')
  .max(maximum, 'A quantidade ultrapassa o limite suportado.')
  .refine((value) => new Prisma.Decimal(value).decimalPlaces() <= 3, 'Informe até três casas decimais.')
const quantity = quantityField(0.001, 1_000_000)

const stockProfile = z.object({
  name: z.string().trim().min(2, 'Informe o nome do item.').max(120),
  category: textField(80),
  unit: z.enum(workshopStockUnits),
  itemType: z.enum(workshopStockItemTypes).optional(),
  code: textField(80),
  brand: textField(120),
  location: textField(120),
  finish: textField(120),
  minimumStock: quantityField(0, 1_000_000).nullish(),
  unitsPerPackage: quantity.nullish(),
  thicknessMm: quantity.nullish(),
  lengthMm: z.number().int().positive().max(1_000_000).nullish(),
  widthMm: z.number().int().positive().max(1_000_000).nullish(),
})

const movementNotes = { supplier: textField(160), reason: textField(500), reference: textField(160) }
const packaging = { packaged: z.boolean().optional(), expectedUnitsPerPackage: quantity.optional() }

const stockActionSchema = z.discriminatedUnion('action', [
  stockProfile.extend({ action: z.literal('CREATE_ITEM') }).strict(),
  stockProfile.extend({ action: z.literal('UPDATE_ITEM'), itemId }).strict(),
  z.object({ action: z.literal('SET_ITEM_ACTIVE'), itemId, active: z.boolean() }).strict(),
  z.object({ action: z.literal('RECORD_PURCHASE'), requestId: uuid, itemId, quantity }).strict(),
  z.object({
    action: z.literal('RECORD_MOVEMENT'),
    requestId: uuid,
    itemId,
    kind: z.enum(workshopStockMovementKinds),
    quantity: quantityField(0, workshopStockMaximum),
    expectedStockQuantity: quantityField(0, workshopStockMaximum).optional(),
    ...packaging,
    ...movementNotes,
  }).strict().superRefine((value, context) => {
    if (value.kind !== 'COUNT' && (value.quantity < 0.001 || value.quantity > 1_000_000)) {
      context.addIssue({ code: 'custom', path: ['quantity'], message: 'Informe uma quantidade entre 0,001 e 1.000.000.' })
    }
    if ((value.kind === 'COUNT' || value.kind === 'LOSS') && !value.reason) {
      context.addIssue({ code: 'custom', path: ['reason'], message: 'Informe o motivo deste movimento.' })
    }
    if (value.packaged && value.kind !== 'PURCHASE') {
      context.addIssue({ code: 'custom', path: ['packaged'], message: 'Embalagens só podem ser usadas nas compras.' })
    }
  }),
  z.object({
    action: z.literal('RECORD_PURCHASE_BATCH'),
    requestId: uuid,
    lines: z.array(z.object({ itemId, quantity, ...packaging }).strict())
      .min(1, 'Adicione pelo menos um material à compra.').max(30, 'Registre até 30 materiais por compra.')
      .refine((lines) => new Set(lines.map((line) => line.itemId)).size === lines.length, 'Use uma única linha por material.'),
    ...movementNotes,
  }).strict(),
  z.object({
    action: z.literal('REVERSE_MOVEMENT'),
    requestId: uuid,
    movementId: uuid,
    reason: z.string().trim().min(1, 'Informe o motivo do estorno.').max(500),
  }).strict(),
])

type StockProfile = z.infer<typeof stockProfile>

function cleanText(value: string | null | undefined) {
  return value === undefined ? undefined : value || null
}

function profileData(profile: StockProfile) {
  return {
    name: profile.name,
    unit: profile.unit,
    itemType: profile.itemType,
    category: cleanText(profile.category),
    code: cleanText(profile.code),
    brand: cleanText(profile.brand),
    location: cleanText(profile.location),
    finish: cleanText(profile.finish),
    minimumStock: profile.minimumStock,
    unitsPerPackage: profile.unitsPerPackage,
    thicknessMm: profile.thicknessMm,
    lengthMm: profile.lengthMm,
    widthMm: profile.widthMm,
  }
}

function stockError(error: unknown, message: string) {
  if (error instanceof WorkshopStockError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof RateLimitUnavailableError) return serviceUnavailable()
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = String(error.meta?.target || '')
      const failure = target.includes('code')
        ? 'Já existe um material com este código.'
        : target.includes('name')
          ? 'Já existe um item com este nome e unidade.'
          : 'Este lançamento já foi registrado.'
      return NextResponse.json({ error: failure }, { status: 409 })
    }
    if (error.code === 'P2020') {
      return NextResponse.json({ error: 'O saldo ultrapassaria o limite suportado.' }, { status: 409 })
    }
    if (error.code === 'P2034') {
      return NextResponse.json({ error: 'O estoque está sendo atualizado. Tente novamente.' }, { status: 409 })
    }
  }
  console.error(message, error)
  return serverError()
}

const historyQuery = z.object({ itemId, cursor: uuid.optional() })

export async function GET(req: NextRequest) {
  const auth = await requireRole([...workshopStockRoles])
  if (!auth.ok) return auth.response

  try {
    const params = req.nextUrl.searchParams
    if (params.has('itemId') || params.has('cursor')) {
      const parsed = historyQuery.safeParse({ itemId: params.get('itemId'), cursor: params.get('cursor') ?? undefined })
      if (!parsed.success) return badRequest('Informe um material e um cursor válidos.')
      return NextResponse.json(await readWorkshopStockMovements(parsed.data.itemId, parsed.data.cursor))
    }

    const items = await prisma.workshopStockItem.findMany({ orderBy: [{ name: 'asc' }, { unit: 'asc' }] })
    return NextResponse.json({ items: items.map(serializeWorkshopStockItem) })
  } catch (error) {
    return stockError(error, 'Erro ao consultar o estoque da marcenaria.')
  }
}

async function saveItem(profile: StockProfile, id?: string) {
  const previous = id ? await prisma.workshopStockItem.findUnique({ where: { id } }) : null
  if (id && !previous) throw new WorkshopStockError('Material não encontrado.', 404)
  if (previous && previous.unit !== profile.unit) {
    throw new WorkshopStockError('A unidade do material é fixa. Cadastre um novo item para usar outra unidade.', 409)
  }
  if (isCountedStockUnit(profile.unit) &&
    ((profile.minimumStock != null && !Number.isInteger(profile.minimumStock)) ||
      (profile.unitsPerPackage != null && !Number.isInteger(profile.unitsPerPackage)))) {
    throw new WorkshopStockError('O mínimo e a quantidade por embalagem devem ser inteiros para esta unidade.', 400)
  }

  const itemType = profile.itemType ?? previous?.itemType ?? 'OTHER'
  if (itemType === 'MDF_SHEET' && profile.unit !== 'chapa') {
    throw new WorkshopStockError('Use chapa como unidade para as chapas de MDF.', 400)
  }
  const dimension = (key: 'thicknessMm' | 'lengthMm' | 'widthMm') =>
    profile[key] === undefined ? previous?.[key] : profile[key]
  if (itemType === 'MDF_OFFCUT' && (profile.unit !== 'unidade' ||
    !dimension('thicknessMm') || !dimension('lengthMm') || !dimension('widthMm'))) {
    throw new WorkshopStockError('Use unidade e informe espessura, comprimento e largura para o retalho.', 400)
  }

  const data = profileData(profile)
  return previous
    ? await prisma.workshopStockItem.update({ where: { id: previous.id }, data })
    : await prisma.workshopStockItem.create({ data })
}

type MovementAction = Extract<z.infer<typeof stockActionSchema>, {
  action: 'RECORD_PURCHASE' | 'RECORD_MOVEMENT' | 'RECORD_PURCHASE_BATCH' | 'REVERSE_MOVEMENT'
}>

function applyMovement(input: MovementAction, actorId: string) {
  const requestId = input.requestId
  switch (input.action) {
    case 'RECORD_PURCHASE':
      return applyWorkshopStockOperation({
        requestId, mode: 'legacy', lines: [{ itemId: input.itemId, kind: 'PURCHASE', quantity: input.quantity }],
      }, actorId)
    case 'RECORD_MOVEMENT':
      return applyWorkshopStockOperation({
        requestId, mode: 'single', lines: [input],
        reason: input.reason, reference: input.reference, supplier: input.supplier,
      }, actorId)
    case 'RECORD_PURCHASE_BATCH':
      return applyWorkshopStockOperation({
        requestId, mode: 'batch', lines: input.lines.map((line) => ({ ...line, kind: 'PURCHASE' })),
        reason: input.reason, reference: input.reference, supplier: input.supplier,
      }, actorId)
    case 'REVERSE_MOVEMENT':
      return applyWorkshopStockOperation({ requestId, mode: 'reverse', movementId: input.movementId, reason: input.reason }, actorId)
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole([...workshopStockRoles])
  if (!auth.ok) return auth.response

  try {
    const limit = await rateLimit(`api:workshop-stock:${auth.user.id}:${getClientIp(req)}`, 60, 60 * 1000)
    if (!limit.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 })

    const parsed = stockActionSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos.')
    const input = parsed.data

    if (input.action === 'CREATE_ITEM' || input.action === 'UPDATE_ITEM') {
      const item = await saveItem(input, input.action === 'UPDATE_ITEM' ? input.itemId : undefined)
      return NextResponse.json({ item: serializeWorkshopStockItem(item) }, { status: input.action === 'CREATE_ITEM' ? 201 : 200 })
    }
    if (input.action === 'SET_ITEM_ACTIVE') {
      const item = await prisma.workshopStockItem.update({
        where: { id: input.itemId }, data: { active: input.active },
      }).catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new WorkshopStockError('Material não encontrado.', 404)
        }
        throw error
      })
      return NextResponse.json({ item: serializeWorkshopStockItem(item) })
    }

    const result = await applyMovement(input, auth.user.id)
    const items = result.items.map(serializeWorkshopStockItem)
    const payload = input.action === 'RECORD_PURCHASE_BATCH' ? { items } : { item: items[0] }
    return NextResponse.json(payload, { status: result.recorded ? 201 : 200 })
  } catch (error) {
    return stockError(error, 'Erro ao atualizar o estoque da marcenaria.')
  }
}
