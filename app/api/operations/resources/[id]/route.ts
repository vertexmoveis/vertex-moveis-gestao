import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { badRequest, requireRole } from '@/lib/security'

const resourceSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(80),
  type: z.enum(['TEAM', 'VEHICLE']),
  active: z.boolean().default(true),
}).strict()

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Dados inválidos')
  }
  const parsed = resourceSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')

  try {
    const { id } = await params
    const resource = await prisma.operationalResource.update({ where: { id }, data: parsed.data })
    return NextResponse.json(resource)
  } catch {
    return badRequest('Não foi possível salvar o recurso')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { id } = await params
  const used = await prisma.installationSchedule.count({ where: { OR: [{ teamId: id }, { vehicleId: id }] } })
  if (used > 0) return badRequest('Este recurso já está em uma agenda. Desative-o em vez de excluir.')
  try {
    await prisma.operationalResource.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return badRequest('Recurso não encontrado')
  }
}
