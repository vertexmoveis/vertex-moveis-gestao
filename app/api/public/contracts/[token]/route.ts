import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  hashProjectContractAcceptanceIp,
  hashProjectContractToken,
  parseProjectContractSnapshot,
} from '@/lib/project-contracts'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security'
import { isValidPublicToken, publicRateLimitKey } from '@/lib/public-access'

const acceptanceSchema = z.object({
  signatoryName: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  signatoryDocument: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().trim().min(5).max(30).optional(),
  ),
  acceptedTerms: z.literal(true),
}).strict()

async function publicLimit(req: NextRequest, action: 'read' | 'sign') {
  return rateLimit(
    publicRateLimitKey(`contract:${action}`, getClientIp(req)),
    action === 'read' ? 60 : 12,
    60 * 1000,
  ).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
}

function publicContract(contract: {
  id: string
  version: number
  status: string
  snapshot: unknown
  expiresAt: Date | null
  signedAt: Date | null
  voidedAt: Date | null
  signatoryName: string | null
}) {
  const snapshot = parseProjectContractSnapshot(contract.snapshot)
  if (!snapshot) return null
  const expired = Boolean(
    contract.expiresAt
    && contract.expiresAt.getTime() < Date.now()
    && !contract.signedAt
    && !contract.voidedAt,
  )
  return {
    id: contract.id,
    version: contract.version,
    status: expired ? 'EXPIRED' : contract.status,
    expiresAt: contract.expiresAt?.toISOString() || null,
    signedAt: contract.signedAt?.toISOString() || null,
    signatoryName: contract.signatoryName,
    snapshot,
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isValidPublicToken(token)) {
    return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  }

  const limited = await publicLimit(req, 'read')
  if (!limited || !limited.allowed) {
    return NextResponse.json({ error: 'Tente novamente em alguns instantes.' }, { status: 429 })
  }

  const contract = await prisma.projectContract.findUnique({
    where: { tokenHash: hashProjectContractToken(token) },
  })
  if (!contract) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  if (contract.voidedAt || contract.status === 'VOID') {
    return NextResponse.json({ error: 'Este contrato foi cancelado. Solicite um novo link.' }, { status: 410 })
  }
  if (contract.expiresAt && contract.expiresAt < new Date() && !contract.signedAt) {
    return NextResponse.json({ error: 'Este contrato expirou. Solicite um novo link.' }, { status: 410 })
  }
  const data = publicContract(contract)
  if (!data) return NextResponse.json({ error: 'Contrato inválido.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!isValidPublicToken(token)) {
    return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  }

  const limited = await publicLimit(req, 'sign')
  if (!limited || !limited.allowed) {
    return NextResponse.json({ error: 'Tente novamente em alguns instantes.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = acceptanceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Resposta inválida.' },
      { status: 400 },
    )
  }

  const now = new Date()
  const tokenHash = hashProjectContractToken(token)
  const outcome = await prisma.$transaction(async (tx) => {
    const contract = await tx.projectContract.findUnique({ where: { tokenHash } })
    if (!contract) return { status: 404, error: 'Contrato não encontrado.' }
    if (contract.voidedAt || contract.status === 'VOID') {
      return { status: 410, error: 'Este contrato foi cancelado. Solicite um novo link.' }
    }
    if (contract.signedAt || contract.status === 'SIGNED') {
      return { status: 409, error: 'Este contrato já foi aceito.' }
    }
    if (contract.expiresAt && contract.expiresAt < now) {
      return { status: 410, error: 'Este contrato expirou. Solicite um novo link.' }
    }
    if (!parseProjectContractSnapshot(contract.snapshot)) {
      return { status: 500, error: 'O contrato armazenado está inválido.' }
    }

    const result = await tx.projectContract.updateMany({
      where: {
        id: contract.id,
        signedAt: null,
        voidedAt: null,
        status: 'SENT',
      },
      data: {
        status: 'SIGNED',
        signedAt: now,
        signatoryName: parsed.data.signatoryName,
        signatoryDocument: parsed.data.signatoryDocument || null,
        acceptedIpHash: hashProjectContractAcceptanceIp(getClientIp(req)),
        acceptedUserAgent: (req.headers.get('user-agent') || '').slice(0, 500) || null,
      },
    })
    if (result.count !== 1) {
      return { status: 409, error: 'Este contrato já recebeu uma resposta.' }
    }

    await tx.timelineEvent.create({
      data: {
        projectId: contract.projectId,
        event: 'Contrato aceito',
        description: `Contrato versão ${contract.version} aceito por ${parsed.data.signatoryName}.`,
      },
    })
    return { status: 200, signedAt: now.toISOString() }
  })

  if ('error' in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status })
  }
  return NextResponse.json({ success: true, signedAt: outcome.signedAt })
}
