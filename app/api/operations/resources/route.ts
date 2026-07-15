import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { badRequest, requireAuth, requireRole } from '@/lib/security'

const resourceSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(80),
  type: z.enum(['TEAM', 'VEHICLE']),
  active: z.boolean().default(true),
}).strict()

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const resources = await prisma.operationalResource.findMany({ orderBy: [{ type: 'asc' }, { active: 'desc' }, { name: 'asc' }] })
  return NextResponse.json(resources)
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
  const parsed = resourceSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')

  try {
    const resource = await prisma.operationalResource.create({ data: parsed.data })
    return NextResponse.json(resource, { status: 201 })
  } catch {
    return badRequest('Já existe um recurso com esse nome')
  }
}
