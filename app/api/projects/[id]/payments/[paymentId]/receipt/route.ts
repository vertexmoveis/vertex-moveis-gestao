import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getClientIp, requireRole, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import { moneyValue } from '@/lib/money'
import { paymentMethodLabel } from '@/lib/payment-methods'
import { formatDateOnly } from '@/lib/date-only'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return map[char]
  })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const { id, paymentId } = await params
  const limited = await rateLimit(`api:payments:receipt:${auth.user.id}:${paymentId}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const payment = await prisma.projectPayment.findFirst({
    where: { id: paymentId, projectId: id, project: { archivedAt: null } },
    include: {
      project: {
        select: {
          name: true,
          client: { select: { name: true, phone: true, whatsapp: true } },
        },
      },
    },
  })
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Recibo Vertex Móveis</title>
  <style>
    body { font-family: Arial, sans-serif; color: #121212; margin: 40px; }
    .receipt { max-width: 720px; margin: 0 auto; border: 1px solid #ddd; padding: 28px; }
    h1 { margin: 0 0 4px; font-size: 24px; }
    .muted { color: #666; font-size: 13px; }
    .row { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 12px 0; gap: 24px; }
    .label { color: #666; font-size: 12px; text-transform: uppercase; }
    .value { margin-top: 4px; font-weight: 700; }
    .total { font-size: 22px; color: #ff6b00; }
    .actions { margin-top: 24px; }
    button { background: #ff6b00; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
    @media print { .actions { display: none; } body { margin: 0; } .receipt { border: 0; } }
  </style>
</head>
<body>
  <div class="receipt">
    <h1>Recibo de pagamento</h1>
    <p class="muted">Vertex Móveis</p>
    <div class="row">
      <div><div class="label">Cliente</div><div class="value">${escapeHtml(payment.project.client.name)}</div></div>
      <div><div class="label">Projeto</div><div class="value">${escapeHtml(payment.project.name)}</div></div>
    </div>
    <div class="row">
      <div><div class="label">Lançamento</div><div class="value">${payment.type === 'DOWN_PAYMENT' ? 'Entrada' : `Parcela ${payment.installmentNumber}`}</div></div>
      <div><div class="label">Método</div><div class="value">${escapeHtml(paymentMethodLabel(payment.paymentMethod))}</div></div>
    </div>
    <div class="row">
      <div><div class="label">Vencimento</div><div class="value">${formatDateOnly(payment.dueDate)}</div></div>
      <div><div class="label">Pago em</div><div class="value">${payment.paidAt?.toLocaleDateString('pt-BR') || 'Em aberto'}</div></div>
    </div>
    <div class="row">
      <div><div class="label">Valor recebido</div><div class="value total">${moneyValue(payment.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div></div>
    </div>
    <p class="muted">Documento gerado pelo sistema Vertex Móveis em ${new Date().toLocaleString('pt-BR')}.</p>
    <div class="actions"><button type="button" onclick="window.print()">Imprimir / salvar PDF</button></div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
