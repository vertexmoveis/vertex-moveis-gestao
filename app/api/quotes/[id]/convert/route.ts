import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { convertApprovedQuote } from '@/lib/quote-conversion'
import { badRequest, forbidden, getClientIp, requireRole, serverError, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'

const conversionSchema = z.object({
  downPaymentDueDate: z.string().date().optional(),
}).strict()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:quotes:id:convert:${auth.user.id}:${id}:${getClientIp(req)}`, 20, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' }, { status: 429 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest()
  }
  const parsed = conversionSchema.safeParse(body)
  if (!parsed.success) return badRequest('Confira o vencimento da entrada. Recebimentos devem ser registrados no Financeiro.')

  try {
    const result = await prisma.$transaction(async (tx) => {
      return convertApprovedQuote(tx, {
        quoteId: id,
        user: auth.user,
        downPaymentDueDate: parsed.data.downPaymentDueDate,
      })
    }, { isolationLevel: 'Serializable' })

    return NextResponse.json({ success: true, project: result })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && ['P2034', 'P2002'].includes(String(error.code))) return NextResponse.json({ error: 'O fechamento foi atualizado em outra operação. Atualize a página antes de continuar.' }, { status: 409 })
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') return forbidden()
    if (error instanceof Error && error.message === 'ALREADY_CONVERTED') {
      return NextResponse.json({ error: 'Este orçamento já virou projeto.' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'NOT_APPROVED') {
      return badRequest('Aprove o orçamento antes de transformá-lo em projeto.')
    }
    if (error instanceof Error && error.message === 'APPROVAL_PROOF_REQUIRED') {
      return badRequest('O cliente precisa aprovar pelo link antes de transformar o orçamento em projeto.')
    }
    if (error instanceof Error && error.message === 'PAYMENT_TERMS_REQUIRED') {
      return badRequest('Defina a forma de pagamento no orçamento antes de criar o projeto.')
    }
    if (error instanceof Error && error.message === 'INVALID_PAYMENT_DATE') {
      return badRequest('Informe uma data válida para a confirmação do pagamento.')
    }
    if (error instanceof Error && error.message === 'FUTURE_PAYMENT_DATE') {
      return badRequest('A confirmação do pagamento não pode ter uma data futura.')
    }
    if (error instanceof Error && error.message === 'INSTALLMENTS_REQUIRED') {
      return badRequest('Informe ao menos uma parcela para distribuir o saldo restante.')
    }
    if (error instanceof Error && error.message === 'FIRST_INSTALLMENT_REQUIRED') {
      return badRequest('Informe a data da primeira parcela antes de criar o projeto.')
    }
    if (error instanceof Error && error.message === 'ENTRY_PAYMENT_METHOD_REQUIRED') {
      return badRequest('Informe como a entrada foi recebida antes de criar o projeto.')
    }
    return serverError()
  }
}
