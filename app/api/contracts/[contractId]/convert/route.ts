import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { calculateProjectProductionDates } from '@/lib/business-days'
import { buildDefaultChecklistItems } from '@/lib/checklist'
import { syncClientRelationshipStage } from '@/lib/client-relationship'
import { dateOnlyKey, dateOnlyKeyInTimeZone, toDateOnlyUtc } from '@/lib/date-only'
import { prisma } from '@/lib/db'
import { normalizeEnvironmentNames } from '@/lib/project-environments'
import { parseProjectContractSnapshot } from '@/lib/project-contracts'
import {
  buildStandaloneContractProjectPayments,
  STANDALONE_ENTRY_PAYMENT_METHODS,
  standaloneContractConversionPreview,
} from '@/lib/standalone-contract-conversion'
import { calculateProductionWeight } from '@/lib/operational-toolkit'
import {
  badRequest,
  forbidden,
  getClientIp,
  requireAuth,
  serverError,
  serviceUnavailable,
} from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

const conversionSchema = z.object({
  paymentConfirmedAt: z.string().date(),
  entryPaymentMethod: z.enum(STANDALONE_ENTRY_PAYMENT_METHODS).optional(),
  environmentNames: z.array(z.string().trim().min(2).max(120)).min(1).max(60).optional(),
}).strict()

function canAccessContract(auth: { id: string; role: string }, createdById: string | null) {
  return auth.role === 'ADMIN' || createdById === auth.id
}

function isStandaloneContract(contract: { standaloneTitle: string | null; clientId: string | null }) {
  return Boolean(contract.standaloneTitle?.trim() && contract.clientId)
}

function isConvertibleStatus(contract: { status: string; signedAt: Date | null }) {
  return Boolean(contract.signedAt || contract.status === 'SENT' || contract.status === 'SIGNED')
}

function contractScopeNotes(snapshot: NonNullable<ReturnType<typeof parseProjectContractSnapshot>>) {
  return (snapshot.project.scope || [])
    .flatMap((scope) => scope.items || [])
    .map((item) => [item.description, item.notes].filter(Boolean).join(': '))
    .filter(Boolean)
    .join('\n')
}

async function findStandaloneContract(contractId: string) {
  return prisma.projectContract.findUnique({
    where: { id: contractId },
    include: {
      client: true,
      project: { select: { id: true, name: true } },
    },
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { contractId } = await params

  const limited = await rateLimit(
    `api:contracts:convert:read:${auth.user.id}:${contractId}:${getClientIp(req)}`,
    60,
    60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas solicitações. Aguarde um minuto.' }, { status: 429 })

  const contract = await findStandaloneContract(contractId)
  if (!contract) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  if (!canAccessContract(auth.user, contract.createdById)) return forbidden()
  if (!isStandaloneContract(contract)) return badRequest('Este registro não é um contrato avulso.')
  if (contract.project) {
    return NextResponse.json({ alreadyConverted: true, project: contract.project })
  }
  if (contract.voidedAt || contract.status === 'VOID') {
    return badRequest('Este contrato foi cancelado e não pode virar venda.')
  }
  if (!isConvertibleStatus(contract)) {
    return badRequest('Envie o contrato ao cliente antes de registrar a venda.')
  }
  if (contract.expiresAt && contract.expiresAt < new Date() && !contract.signedAt) {
    return badRequest('Este contrato expirou. Crie uma nova versão antes da venda.')
  }

  const snapshot = parseProjectContractSnapshot(contract.snapshot)
  if (!snapshot || !contract.client || contract.client.archivedAt) {
    return badRequest('O contrato não possui dados válidos para criar o projeto.')
  }

  try {
    const preview = standaloneContractConversionPreview(snapshot)
    buildStandaloneContractProjectPayments({
      snapshot,
      paymentConfirmedAt: new Date(),
      entryPaymentMethod: preview.paymentMethod === 'CARD' && preview.downPayment > 0 ? 'PIX' : undefined,
    })
    return NextResponse.json({
      alreadyConverted: false,
      contract: {
        id: contract.id,
        status: contract.signedAt ? 'SIGNED' : contract.viewedAt ? 'VIEWED' : contract.status,
        signedAt: contract.signedAt?.toISOString() || null,
      },
      preview,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PAYMENT_SCHEDULE') {
      return badRequest('As parcelas do contrato não fecham o valor total.')
    }
    if (error instanceof Error && error.message === 'INVALID_CONTRACT_TERMS') {
      return badRequest('O prazo ou os valores do contrato estão inválidos.')
    }
    return badRequest('A forma de pagamento deste contrato não pode ser convertida automaticamente.')
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { contractId } = await params

  const limited = await rateLimit(
    `api:contracts:convert:${auth.user.id}:${contractId}:${getClientIp(req)}`,
    12,
    60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 })

  const parsed = conversionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Confira os dados da venda.')

  const paymentConfirmedAt = toDateOnlyUtc(parsed.data.paymentConfirmedAt)
  if (!paymentConfirmedAt) return badRequest('Informe uma data válida para a confirmação do pagamento.')
  if ((dateOnlyKey(paymentConfirmedAt) || '') > dateOnlyKeyInTimeZone(new Date())) {
    return badRequest('A confirmação do pagamento não pode ter uma data futura.')
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const contract = await tx.projectContract.findUnique({
        where: { id: contractId },
        include: {
          client: true,
          project: { select: { id: true, name: true } },
        },
      })
      if (!contract) throw new Error('NOT_FOUND')
      if (!canAccessContract(auth.user, contract.createdById)) throw new Error('FORBIDDEN')
      if (!isStandaloneContract(contract)) throw new Error('NOT_STANDALONE')
      if (contract.project) return { project: contract.project, alreadyConverted: true }
      if (contract.voidedAt || contract.status === 'VOID') throw new Error('VOID')
      if (!isConvertibleStatus(contract)) throw new Error('NOT_SENT')
      if (contract.expiresAt && contract.expiresAt < new Date() && !contract.signedAt) {
        throw new Error('EXPIRED')
      }
      if (!contract.client || contract.client.archivedAt) throw new Error('CLIENT_REQUIRED')

      const snapshot = parseProjectContractSnapshot(contract.snapshot)
      if (!snapshot) throw new Error('INVALID_SNAPSHOT')
      const preview = standaloneContractConversionPreview(snapshot)
      const environmentNames = normalizeEnvironmentNames(
        parsed.data.environmentNames || preview.environmentNames,
        snapshot.project.room || snapshot.project.name,
      )
      if (environmentNames.length === 0) throw new Error('ENVIRONMENTS_REQUIRED')

      const payments = buildStandaloneContractProjectPayments({
        snapshot,
        paymentConfirmedAt,
        entryPaymentMethod: parsed.data.entryPaymentMethod,
      })
      const productionDates = calculateProjectProductionDates({
        approvalDate: paymentConfirmedAt,
        deliveryBusinessDays: snapshot.project.deliveryBusinessDays,
      })
      const contractedDeadline = toDateOnlyUtc(snapshot.project.deliveryDeadlineDate)
      const deliveryDeadlineDate = contractedDeadline || productionDates.deliveryDeadlineDate
      const scopeNotes = contractScopeNotes(snapshot)
      const firstInstallmentDate = preview.firstInstallmentDate
        ? toDateOnlyUtc(preview.firstInstallmentDate)
        : null
      const managerId = contract.createdById || auth.user.id

      const project = await tx.project.create({
        data: {
          clientId: contract.client.id,
          name: snapshot.project.name,
          room: environmentNames.join(', '),
          status: 'APPROVED',
          stage: 'PENDING_START',
          approvalDate: contract.signedAt || paymentConfirmedAt,
          paymentConfirmedAt,
          deliveryBusinessDays: snapshot.project.deliveryBusinessDays,
          deliveryDeadlineDate,
          productionReminderBusinessDays: 7,
          productionStartReminderDate: productionDates.productionStartReminderDate,
          startDate: paymentConfirmedAt,
          estimatedEndDate: deliveryDeadlineDate,
          value: preview.value,
          productionCost: 0,
          productionWeight: calculateProductionWeight(environmentNames.length, []),
          paymentMethod: preview.paymentMethod,
          paymentDiscount: snapshot.payment.paymentDiscount || 0,
          cardFeePercent: snapshot.payment.cardFeePercent || 0,
          cardFeeAmount: snapshot.payment.cardFeeAmount || 0,
          downPayment: preview.downPayment,
          downPaymentDate: preview.downPayment > 0 ? paymentConfirmedAt : null,
          installmentCount: preview.installmentCount,
          installmentValue: preview.installmentValue,
          firstInstallmentDate,
          managerId,
          internalNotes: [
            `Projeto criado a partir do contrato avulso "${contract.standaloneTitle || snapshot.project.name}".`,
            `Contrato de origem: ${contract.id}.`,
            scopeNotes,
          ].filter(Boolean).join('\n\n'),
          payments: { create: payments },
          checklist: { create: buildDefaultChecklistItems() },
          environments: {
            create: environmentNames.map((name, index) => ({
              name,
              position: index + 1,
              status: 'PENDING',
              notes: 'Ambiente informado no contrato avulso.',
            })),
          },
        },
        select: { id: true, name: true },
      })

      const linked = await tx.projectContract.updateMany({
        where: { id: contract.id, projectId: null, voidedAt: null },
        data: { projectId: project.id },
      })
      if (linked.count !== 1) throw new Error('CONCURRENT_CONVERSION')

      const receivedPayments = await tx.projectPayment.findMany({
        where: { projectId: project.id, paidAt: { not: null } },
        select: { id: true, amount: true, paymentMethod: true },
      })
      if (receivedPayments.length > 0) {
        await tx.paymentHistory.createMany({
          data: receivedPayments.map((payment) => ({
            paymentId: payment.id,
            userId: auth.user.id,
            action: 'Pagamento confirmado na conversão do contrato avulso',
            method: payment.paymentMethod,
            amount: payment.amount,
          })),
        })
      }

      await tx.timelineEvent.create({
        data: {
          projectId: project.id,
          event: 'Projeto criado do contrato avulso',
          description: `Contrato "${contract.standaloneTitle || snapshot.project.name}" convertido em venda.`,
        },
      })
      await tx.activityLog.create({
        data: {
          userId: auth.user.id,
          projectId: project.id,
          action: 'Contrato avulso vendido',
          details: `${contract.standaloneTitle || snapshot.project.name} · ${contract.client.name}`,
        },
      })
      await syncClientRelationshipStage(tx, contract.client.id, { activityAt: paymentConfirmedAt })

      return { project, alreadyConverted: false }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbidden()
    if (error instanceof Error && error.message === 'NOT_STANDALONE') return badRequest('Este registro não é um contrato avulso.')
    if (error instanceof Error && error.message === 'VOID') return badRequest('Este contrato foi cancelado.')
    if (error instanceof Error && error.message === 'NOT_SENT') return badRequest('Envie o contrato ao cliente antes de registrar a venda.')
    if (error instanceof Error && error.message === 'EXPIRED') return badRequest('Este contrato expirou. Crie uma nova versão antes da venda.')
    if (error instanceof Error && error.message === 'CLIENT_REQUIRED') return badRequest('O cliente do contrato não está disponível.')
    if (error instanceof Error && error.message === 'INVALID_SNAPSHOT') return badRequest('O contrato armazenado está inválido.')
    if (error instanceof Error && error.message === 'UNSUPPORTED_PAYMENT_METHOD') return badRequest('A forma de pagamento não é compatível com a conversão.')
    if (error instanceof Error && error.message === 'ENTRY_PAYMENT_METHOD_REQUIRED') return badRequest('Informe como a entrada foi recebida.')
    if (error instanceof Error && error.message === 'INVALID_PAYMENT_SCHEDULE') return badRequest('As parcelas do contrato não fecham o valor total.')
    if (error instanceof Error && error.message === 'INVALID_CONTRACT_TERMS') return badRequest('O prazo ou os valores do contrato estão inválidos.')
    if (error instanceof Error && error.message === 'ENVIRONMENTS_REQUIRED') return badRequest('Informe ao menos um ambiente do projeto.')
    if (error instanceof Error && error.message === 'CONCURRENT_CONVERSION') {
      return NextResponse.json({ error: 'Este contrato está sendo convertido. Atualize a página.' }, { status: 409 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'A venda foi atualizada ao mesmo tempo. Tente novamente.' }, { status: 409 })
    }
    console.error('Erro ao converter contrato avulso em venda.', error)
    return serverError()
  }
}
