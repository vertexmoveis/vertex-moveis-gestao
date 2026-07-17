import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/db'
import { forbidden, getClientIp, requireAuth, serviceUnavailable } from '@/lib/security'
import { rateLimit, RateLimitUnavailableError } from '@/lib/rate-limit'
import {
  buildQuoteWhatsAppMessage,
  QUOTE_CALCULATION_MODE_LABELS,
  QUOTE_DIFFICULTY_LABELS,
  getQuoteAutomaticPricing,
  getQuoteInstallmentGridColumns,
  getQuotePaymentDetails,
  parseQuoteAccessories,
  quoteCentimetersToMillimeters,
  quoteDisplayCode,
  safeQuoteCalculationMode,
  safeQuoteDifficulty,
} from '@/lib/quotes'

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(value) : 'A combinar'
}

function formatMeasure(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const limited = await rateLimit(`api:quotes:id:proposal:${auth.user.id}:${id}:${getClientIp(req)}`, 30, 60 * 1000).catch((error) => {
    if (error instanceof RateLimitUnavailableError) return null
    throw error
  })
  if (!limited) return serviceUnavailable()
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      items: { orderBy: { position: 'asc' } },
    },
  })

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (auth.user.role !== 'ADMIN' && quote.createdById !== auth.user.id) return forbidden()

  const grouped = quote.items.reduce<Record<string, typeof quote.items>>((acc, item) => {
    acc[item.environment] = acc[item.environment] || []
    acc[item.environment].push(item)
    return acc
  }, {})
  const environments = Object.entries(grouped)
  const itemSubtotal = quote.items.reduce((sum, item) => sum + item.total, 0)
  const totalQuantity = quote.items.reduce((sum, item) => sum + item.quantity, 0)
  const payment = getQuotePaymentDetails(quote)
  const installmentGridColumns = getQuoteInstallmentGridColumns(payment.installments.length)
  const phone = quote.client.whatsapp || quote.client.phone || ''
  const digits = phone.replace(/\D/g, '')
  const whatsAppNumber = digits ? (digits.startsWith('55') ? digits : `55${digits}`) : ''
  const whatsAppHref = whatsAppNumber
    ? `https://wa.me/${whatsAppNumber}?text=${encodeURIComponent(buildQuoteWhatsAppMessage(quote))}`
    : ''
  const logoUrl = await readFile(path.join(process.cwd(), 'public', 'vertex-symbol.png'))
    .then((file) => `data:image/png;base64,${file.toString('base64')}`)
    .catch(() => new URL('/vertex-symbol.png', req.url).toString())
  const generatedAt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date())

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Proposta ${escapeHtml(quoteDisplayCode(quote))} - ${escapeHtml(quote.title)}</title>
  <style>
    :root { --ink: #151515; --muted: #6b6b6b; --line: #e7e7e7; --soft: #f7f7f5; --orange: #ff6500; --orange-soft: #fff3e9; }
    * { box-sizing: border-box; }
    html { background: #e9e9e7; }
    body { margin: 0; color: var(--ink); font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .document { width: min(940px, calc(100% - 32px)); margin: 24px auto 96px; background: #fff; box-shadow: 0 18px 50px rgba(0,0,0,.12); }
    .accent { height: 8px; background: var(--orange); }
    .header { padding: 34px 42px 28px; display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; border-bottom: 1px solid var(--line); }
    .brand-wrap { display: flex; align-items: center; gap: 14px; }
    .brand-mark { width: 48px; height: 38px; object-fit: contain; }
    .brand-name { font-size: 20px; line-height: 1; font-weight: 800; }
    .brand-tagline { margin-top: 6px; color: var(--muted); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
    .proposal-meta { min-width: 220px; text-align: right; }
    .proposal-meta strong { display: block; font-size: 12px; color: var(--orange); letter-spacing: .08em; text-transform: uppercase; }
    .proposal-meta h1 { margin: 5px 0 10px; font-size: 25px; line-height: 1.1; }
    .proposal-code { color: var(--muted); font-size: 12px; line-height: 1.7; }
    .intro { padding: 38px 42px 28px; }
    .eyebrow { margin: 0 0 8px; color: var(--orange); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .intro h2 { margin: 0; max-width: 700px; font-size: 30px; line-height: 1.15; }
    .intro p { max-width: 700px; margin: 15px 0 0; color: #4f4f4f; font-size: 14px; line-height: 1.65; }
    .overview { margin: 0 42px 34px; display: grid; grid-template-columns: 1fr 1fr 1.4fr; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    .overview-item { min-height: 82px; padding: 17px 20px; border-right: 1px solid var(--line); }
    .overview-item:last-child { border: 0; background: var(--ink); color: #fff; }
    .overview-label { display: block; margin-bottom: 7px; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
    .overview-item:last-child .overview-label { color: #bdbdbd; }
    .overview-value { font-size: 19px; font-weight: 800; }
    .overview-item:last-child .overview-value { color: #ff9a52; font-size: 22px; }
    .section { padding: 0 42px 34px; }
    .section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; margin-bottom: 14px; }
    .section-heading h2 { margin: 0; font-size: 17px; }
    .section-heading span { color: var(--muted); font-size: 11px; }
    .environment { margin-bottom: 18px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
    .environment-header { padding: 13px 16px; display: flex; justify-content: space-between; gap: 16px; background: var(--soft); border-bottom: 1px solid var(--line); }
    .environment-title { font-size: 14px; font-weight: 800; }
    .environment-count { color: var(--muted); font-size: 12px; }
    .item { display: grid; grid-template-columns: minmax(176px, 1.6fr) minmax(110px, .8fr) minmax(140px, 1fr) auto; gap: 14px; align-items: center; padding: 15px 16px; border-bottom: 1px solid var(--line); break-inside: avoid; page-break-inside: avoid; }
    .item:last-child { border: 0; }
    .item-name { font-size: 14px; font-weight: 800; }
    .item-notes { margin-top: 5px; color: var(--muted); font-size: 12px; line-height: 1.5; }
    .item-detail span { display: block; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .item-detail strong { display: block; margin-top: 4px; font-size: 13px; line-height: 1.4; }
    .item-price { min-width: 104px; text-align: right; font-size: 14px; font-weight: 800; }
    .difficulty { display: inline-block; margin-top: 6px; padding: 3px 6px; border-radius: 4px; background: var(--orange-soft); color: #b84a00; font-size: 10px; font-weight: 800; }
    .payment-section { padding: 0 42px 34px; break-inside: avoid; page-break-inside: avoid; }
    .payment-panel { overflow: hidden; border: 1px solid var(--line); border-top: 4px solid var(--orange); border-radius: 8px; }
    .payment-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding: 17px 18px; background: var(--soft); border-bottom: 1px solid var(--line); }
    .payment-header h2 { margin: 0; font-size: 17px; }
    .payment-header p { margin: 5px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
    .payment-method { min-width: 150px; text-align: right; }
    .payment-method span { display: block; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
    .payment-method strong { display: block; margin-top: 5px; color: var(--orange); font-size: 14px; }
    .payment-metrics { display: grid; grid-template-columns: repeat(4, 1fr); }
    .payment-metric { min-height: 78px; padding: 15px 16px; border-right: 1px solid var(--line); }
    .payment-metric:last-child { border-right: 0; }
    .payment-metric span { display: block; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .payment-metric strong { display: block; margin-top: 7px; font-size: 15px; line-height: 1.25; }
    .payment-metric.total { background: var(--ink); color: #fff; }
    .payment-metric.total span { color: #bdbdbd; }
    .payment-metric.total strong { color: #ff9a52; font-size: 18px; }
    .installments { padding: 16px 18px 18px; border-top: 1px solid var(--line); }
    .installments-title { display: flex; justify-content: space-between; gap: 18px; margin-bottom: 10px; }
    .installments-title strong { font-size: 13px; }
    .installments-title span { color: var(--muted); font-size: 11px; }
    .installment-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--line); border-left: 1px solid var(--line); }
    .installment-grid.columns-1 { grid-template-columns: minmax(0, 1fr); }
    .installment-grid.columns-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .installment-grid.columns-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .installment-grid.columns-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .installment { padding: 9px 10px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); background: #fff; }
    .installment span { display: block; color: var(--muted); font-size: 10px; }
    .installment strong { display: block; margin-top: 3px; font-size: 12px; }
    .payment-note { margin: 11px 0 0; color: var(--muted); font-size: 10px; line-height: 1.5; }
    .closing { padding: 0 42px 38px; display: grid; grid-template-columns: 1.15fr .85fr; gap: 28px; align-items: start; break-inside: avoid; page-break-inside: avoid; }
    .details { border-top: 2px solid var(--ink); padding-top: 15px; }
    .details h2 { margin: 0 0 12px; font-size: 16px; }
    .details p { margin: 0 0 12px; color: #4f4f4f; font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
    .conditions { margin: 14px 0 0; padding: 0; list-style: none; }
    .conditions li { position: relative; margin: 8px 0; padding-left: 15px; color: #4f4f4f; font-size: 12px; line-height: 1.55; }
    .conditions li::before { content: ''; position: absolute; left: 0; top: 6px; width: 5px; height: 5px; border-radius: 50%; background: var(--orange); }
    .summary { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    .summary-title { padding: 13px 15px; background: var(--soft); font-size: 12px; font-weight: 800; }
    .summary-row { display: flex; justify-content: space-between; gap: 18px; padding: 10px 15px; border-top: 1px solid var(--line); color: #4f4f4f; font-size: 12px; }
    .summary-row strong { color: var(--ink); }
    .summary-total { padding: 16px 15px; display: flex; justify-content: space-between; align-items: baseline; gap: 18px; background: var(--ink); color: #fff; }
    .summary-total span { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
    .summary-total strong { color: #ff9a52; font-size: 22px; }
    .footer { padding: 22px 42px 28px; display: flex; justify-content: space-between; gap: 24px; border-top: 1px solid var(--line); color: var(--muted); font-size: 10px; line-height: 1.6; }
    .footer strong { color: var(--ink); }
    .actions { position: fixed; right: 24px; bottom: 24px; z-index: 10; display: flex; gap: 10px; padding: 8px; border-radius: 10px; background: rgba(255,255,255,.96); box-shadow: 0 10px 30px rgba(0,0,0,.18); }
    .actions button, .actions a { min-height: 40px; border: 1px solid #d4d4d4; border-radius: 7px; padding: 10px 14px; background: #fff; color: var(--ink); font: inherit; font-size: 12px; font-weight: 800; text-decoration: none; cursor: pointer; }
    .actions .primary { border-color: var(--orange); background: var(--orange); color: #fff; }
    @media (max-width: 700px) {
      .document { width: 100%; margin: 0 0 86px; box-shadow: none; }
      .header, .intro, .section, .closing, .footer { padding-left: 22px; padding-right: 22px; }
      .header { flex-direction: column; }
      .proposal-meta { min-width: 0; text-align: left; }
      .intro h2 { font-size: 25px; }
      .overview { margin-left: 22px; margin-right: 22px; grid-template-columns: 1fr; }
      .overview-item { border-right: 0; border-bottom: 1px solid var(--line); }
      .item { grid-template-columns: 1fr 1fr; }
      .item-main, .item-price { grid-column: 1 / -1; }
      .item-price { text-align: left; }
      .payment-section { padding-left: 22px; padding-right: 22px; }
      .payment-header { flex-direction: column; gap: 12px; }
      .payment-method { min-width: 0; text-align: left; }
      .payment-metrics { grid-template-columns: 1fr 1fr; }
      .payment-metric:nth-child(2) { border-right: 0; }
      .payment-metric { border-bottom: 1px solid var(--line); }
      .payment-metric:nth-last-child(-n + 2) { border-bottom: 0; }
      .installment-grid,
      .installment-grid.columns-2,
      .installment-grid.columns-3,
      .installment-grid.columns-5 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .installment-grid.columns-1 { grid-template-columns: minmax(0, 1fr); }
      .closing { grid-template-columns: 1fr; }
      .actions { left: 12px; right: 12px; bottom: 12px; justify-content: stretch; }
      .actions > * { flex: 1; text-align: center; }
    }
    @page { size: A4; margin: 10mm; }
    @media print {
      html, body { background: #fff; }
      .document { width: auto; margin: 0; box-shadow: none; }
      .actions { display: none !important; }
      .header { padding-top: 20px; }
      .intro { padding-top: 26px; }
      .section, .closing { padding-bottom: 24px; }
      .header, .overview, .payment-panel, .closing, .summary, .footer { break-inside: avoid; page-break-inside: avoid; }
      .section-heading, .environment-header, h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
      .environment { break-inside: auto; page-break-inside: auto; }
      .item, .installments { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="document">
    <div class="accent"></div>
    <header class="header">
      <div class="brand-wrap">
        <img class="brand-mark" src="${escapeHtml(logoUrl)}" alt="Vertex Móveis" />
        <div>
          <div class="brand-name">Vertex Móveis</div>
          <div class="brand-tagline">Móveis planejados</div>
        </div>
      </div>
      <div class="proposal-meta">
        <strong>Proposta comercial</strong>
        <h1>${escapeHtml(quote.title)}</h1>
        <div class="proposal-code">Código ${escapeHtml(quoteDisplayCode(quote))}<br>Emitida em ${generatedAt}<br>Válida até ${formatDate(quote.validUntil)}</div>
      </div>
    </header>

    <section class="intro">
      <p class="eyebrow">Preparado especialmente para</p>
      <h2>${escapeHtml(quote.client.name)}</h2>
      <p>Apresentamos esta proposta para transformar seus ambientes com móveis planejados, produzidos sob medida conforme as especificações abaixo.</p>
    </section>

    <section class="overview" aria-label="Resumo da proposta">
      <div class="overview-item"><span class="overview-label">Ambientes</span><span class="overview-value">${environments.length}</span></div>
      <div class="overview-item"><span class="overview-label">Móveis</span><span class="overview-value">${totalQuantity}</span></div>
      <div class="overview-item"><span class="overview-label">Investimento total</span><span class="overview-value">${formatCurrency(quote.total)}</span></div>
    </section>

    <section class="section">
      <div class="section-heading"><h2>Composição do orçamento</h2><span>Medidas em largura × altura</span></div>
      ${environments.map(([environment, items]) => `
        <article class="environment">
          <div class="environment-header">
            <span class="environment-title">${escapeHtml(environment)}</span>
            <span class="environment-count">${items.reduce((sum, item) => sum + item.quantity, 0)} ${items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'móvel' : 'móveis'}</span>
          </div>
          ${items.map((item) => {
            const accessories = parseQuoteAccessories(item.accessories)
            const calculationMode = safeQuoteCalculationMode(item.calculationMode)
            const automaticPricing = getQuoteAutomaticPricing(item)
            return `
            <div class="item">
              <div class="item-main">
                <div class="item-name">${escapeHtml(item.description)}</div>
                ${item.notes ? `<div class="item-notes">${escapeHtml(item.notes)}</div>` : ''}
                ${accessories.length ? `<div class="item-notes"><strong>Adicionais:</strong> ${escapeHtml(accessories.join(', '))}</div>` : ''}
                ${safeQuoteDifficulty(item.difficulty) === 'DIFICIL' ? `<span class="difficulty">${escapeHtml(QUOTE_DIFFICULTY_LABELS.DIFICIL)}</span>` : ''}
              </div>
              <div class="item-detail"><span>Medidas</span><strong>${formatMeasure(quoteCentimetersToMillimeters(item.width))} × ${formatMeasure(quoteCentimetersToMillimeters(item.height))} mm</strong></div>
              <div class="item-detail"><span>${escapeHtml(`${automaticPricing.label} · ${QUOTE_CALCULATION_MODE_LABELS[calculationMode]}`)}</span><strong>${escapeHtml([item.material || 'MDF', item.finish].filter(Boolean).join(' · '))}</strong></div>
              <div class="item-price">${formatCurrency(item.total)}</div>
            </div>
          `}).join('')}
        </article>
      `).join('')}
    </section>

    <section class="payment-section">
      <div class="payment-panel">
        <div class="payment-header">
          <div>
            <h2>Condições de pagamento</h2>
            <p>Valores apresentados de forma completa para facilitar sua conferência.</p>
          </div>
          <div class="payment-method"><span>Forma escolhida</span><strong>${escapeHtml(payment.methodLabel)}</strong></div>
        </div>
        <div class="payment-metrics">
          ${payment.method === 'CARD' ? `
            <div class="payment-metric"><span>Entrada</span><strong>${payment.downPayment > 0 ? formatCurrency(payment.downPayment) : 'Sem entrada'}</strong></div>
            <div class="payment-metric"><span>Saldo parcelado</span><strong>${formatCurrency(payment.financedAmount)}</strong></div>
            <div class="payment-metric"><span>Parcelamento</span><strong>${payment.installments.length > 0 ? `${payment.installments.length}x no cartão` : 'Sem saldo restante'}</strong></div>
          ` : payment.method === 'PIX' ? `
            <div class="payment-metric"><span>Valor antes do Pix</span><strong>${formatCurrency(payment.totalBeforePaymentDiscount)}</strong></div>
            <div class="payment-metric"><span>Desconto Pix</span><strong>− ${formatCurrency(payment.paymentDiscount)}</strong></div>
            <div class="payment-metric"><span>Pagamento</span><strong>À vista</strong></div>
          ` : `
            <div class="payment-metric"><span>Forma</span><strong>A combinar</strong></div>
            <div class="payment-metric"><span>Entrada</span><strong>A combinar</strong></div>
            <div class="payment-metric"><span>Parcelamento</span><strong>A combinar</strong></div>
          `}
          <div class="payment-metric total"><span>Total da proposta</span><strong>${formatCurrency(payment.total)}</strong></div>
        </div>
        ${payment.method === 'CARD' && payment.installments.length > 0 ? `
          <div class="installments">
            <div class="installments-title"><strong>Detalhamento das parcelas</strong><span>${payment.installments.length} ${payment.installments.length === 1 ? 'parcela' : 'parcelas'}</span></div>
            <div class="installment-grid columns-${installmentGridColumns}">
              ${payment.installments.map((installment) => `
                <div class="installment"><span>Parcela ${installment.number}</span><strong>${formatCurrency(installment.amount)}</strong></div>
              `).join('')}
            </div>
            <p class="payment-note">As datas de vencimento serão combinadas na contratação. A última parcela pode ter ajuste de centavos para fechar o valor total.</p>
          </div>
        ` : ''}
      </div>
    </section>

    <section class="closing">
      <div class="details">
        <h2>Informações da proposta</h2>
        ${quote.customerNotes ? `<p>${escapeHtml(quote.customerNotes)}</p>` : '<p>Produção conforme as medidas e os acabamentos descritos nesta proposta.</p>'}
        <ul class="conditions">
          <li>As medidas finais serão conferidas antes do início da fabricação.</li>
          <li>Alterações de medidas, materiais ou acabamentos podem exigir uma revisão do valor.</li>
          <li>As condições de pagamento estão detalhadas no quadro acima.</li>
          <li>Prazo previsto de entrega: 30 dias úteis após a aprovação do projeto e a confirmação do pagamento.</li>
          <li>${quote.validUntil ? `Esta proposta é válida até ${formatDate(quote.validUntil)}.` : 'A validade desta proposta será confirmada no envio.'}</li>
        </ul>
      </div>
      <div class="summary">
        <div class="summary-title">Resumo do investimento</div>
        <div class="summary-row"><span>Móveis planejados</span><strong>${formatCurrency(itemSubtotal)}</strong></div>
        ${quote.installationFee > 0 ? `<div class="summary-row"><span>Instalação</span><strong>${formatCurrency(quote.installationFee)}</strong></div>` : ''}
        ${quote.manualDiscount > 0 ? `<div class="summary-row"><span>Desconto comercial</span><strong>− ${formatCurrency(quote.manualDiscount)}</strong></div>` : ''}
        ${quote.paymentDiscount > 0 ? `<div class="summary-row"><span>Desconto Pix (3%)</span><strong>− ${formatCurrency(quote.paymentDiscount)}</strong></div>` : ''}
        <div class="summary-total"><span>Total</span><strong>${formatCurrency(quote.total)}</strong></div>
      </div>
    </section>

    <footer class="footer">
      <div><strong>Vertex Móveis</strong><br>Rua Saturno, 6 · Cotia, SP · 06702-170</div>
      <div>Proposta ${escapeHtml(quoteDisplayCode(quote))}<br>Documento gerado pelo sistema Vertex</div>
    </footer>
  </main>

  <nav class="actions" aria-label="Ações da proposta">
    ${whatsAppHref ? `<a href="${whatsAppHref}" target="_blank" rel="noopener noreferrer">Enviar no WhatsApp</a>` : ''}
    <button class="primary" type="button" onclick="window.print()">Salvar em PDF</button>
  </nav>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}
