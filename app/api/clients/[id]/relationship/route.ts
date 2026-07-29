import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { clientWhereForUser } from '@/lib/client-access'
import {
  CLIENT_RELATIONSHIP_STAGES,
  CUSTOMER_QUOTE_STATUSES,
  OPEN_QUOTE_STATUSES,
  syncClientRelationshipStage,
} from '@/lib/client-relationship'
import { badRequest, requireRole, serverError } from '@/lib/security'

const relationshipActionSchema = z.object({
  action: z.enum(['INACTIVATE', 'REACTIVATE', 'MARK_CUSTOMER']),
  reason: z.string().trim().max(300).optional(),
}).strict()

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Dados inválidos')
  }

  const parsed = relationshipActionSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')

  const { id } = await params
  const client = await prisma.client.findFirst({
    where: clientWhereForUser(auth.user, { id }),
    select: {
      id: true,
      name: true,
      relationshipStage: true,
      projects: {
        where: { archivedAt: null },
        take: 1,
        select: { id: true },
      },
      quotes: {
        where: { archivedAt: null },
        select: { status: true },
      },
    },
  })

  if (!client) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

  const now = new Date()
  try {
    const stage = await prisma.$transaction(async (tx) => {
      if (parsed.data.action === 'INACTIVATE') {
        const hasCustomerHistory = client.relationshipStage === CLIENT_RELATIONSHIP_STAGES.CUSTOMER
          || client.projects.length > 0
          || client.quotes.some((quote) => CUSTOMER_QUOTE_STATUSES.includes(quote.status as never))
        if (hasCustomerHistory) {
          throw new Error('CUSTOMER_HISTORY')
        }

        await tx.quote.updateMany({
          where: {
            clientId: id,
            archivedAt: null,
            status: { in: [...OPEN_QUOTE_STATUSES] },
          },
          data: {
            status: 'LOST',
            lostAt: now,
            lossReason: parsed.data.reason || 'Negociação encerrada sem retorno',
          },
        })
        await syncClientRelationshipStage(tx, id, {
          activityAt: now,
          forceStage: CLIENT_RELATIONSHIP_STAGES.INACTIVE,
          inactiveReason: parsed.data.reason || 'Negociação encerrada sem retorno',
        })
        await tx.activityLog.create({
          data: {
            userId: auth.user.id,
            action: 'Negociação encerrada',
            details: `${client.name}: ${parsed.data.reason || 'sem retorno'}`,
          },
        })
        return CLIENT_RELATIONSHIP_STAGES.INACTIVE
      }

      if (
        parsed.data.action === 'REACTIVATE'
        && client.relationshipStage === CLIENT_RELATIONSHIP_STAGES.CUSTOMER
      ) {
        return CLIENT_RELATIONSHIP_STAGES.CUSTOMER
      }

      const forceStage = parsed.data.action === 'MARK_CUSTOMER'
        ? CLIENT_RELATIONSHIP_STAGES.CUSTOMER
        : CLIENT_RELATIONSHIP_STAGES.CONTACT
      await syncClientRelationshipStage(tx, id, {
        activityAt: now,
        forceStage,
      })
      await tx.activityLog.create({
        data: {
          userId: auth.user.id,
          action: parsed.data.action === 'MARK_CUSTOMER'
            ? 'Contato marcado como cliente'
            : 'Contato reativado',
          details: client.name,
        },
      })
      return forceStage
    })

    return NextResponse.json({ success: true, relationshipStage: stage })
  } catch (error) {
    if (error instanceof Error && error.message === 'CUSTOMER_HISTORY') {
      return NextResponse.json({
        error: 'Este cadastro já possui projeto ou venda e deve permanecer como cliente.',
      }, { status: 409 })
    }
    return serverError()
  }
}
