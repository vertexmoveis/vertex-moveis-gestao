import type { Client, Quote, QuoteItem, User } from '@prisma/client'
import { addBusinessDays } from '@/lib/business-days'
import type { CompanyProfileData } from '@/lib/company-profile'
import { formatCompanyAddress } from '@/lib/company-profile'
import { formatDateOnly } from '@/lib/date-only'
import { formatClientAddress } from '@/lib/address'
import { getQuotePaymentDetails, quoteCentimetersToMillimeters, quoteDisplayCode } from '@/lib/quotes'

type ProposalQuote = Quote & {
  client: Client
  createdBy: Pick<User, 'name' | 'email'> | null
  items: QuoteItem[]
}

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

function formatMeasure(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)
}

function valueOrFallback(value?: string | null) {
  return value?.trim() || 'Não informado'
}

export function renderSimpleQuoteProposal({
  quote,
  company,
  logoUrl,
  whatsAppHref,
  commercialHref,
}: {
  quote: ProposalQuote
  company: CompanyProfileData
  logoUrl: string
  whatsAppHref: string
  commercialHref: string
}) {
  const payment = getQuotePaymentDetails(quote)
  const companyAddress = formatCompanyAddress(company)
  const clientAddress = formatClientAddress(quote.client)
  const deliveryForecast = addBusinessDays(quote.approvedAt || quote.createdAt, quote.deliveryBusinessDays)
  const itemSubtotal = quote.items.reduce((sum, item) => sum + item.total, 0)
  const totalQuantity = quote.items.reduce((sum, item) => sum + item.quantity, 0)
  const seller = quote.createdBy?.name || company.tradeName
  const paymentRows = payment.method === 'CARD'
    ? [
        ...(payment.downPayment > 0
          ? [{ label: 'Entrada', dueDate: quote.createdAt, amount: payment.downPayment, method: 'Entrada' }]
          : []),
        ...payment.installments.map((installment) => ({
          label: `Parcela ${installment.number}`,
          dueDate: installment.dueDate,
          amount: installment.amount,
          method: 'Cartão de crédito',
        })),
      ]
    : [{
        label: payment.method === 'PIX' ? 'Pagamento à vista' : 'Pagamento',
        dueDate: quote.createdAt,
        amount: payment.total,
        method: payment.methodLabel,
      }]

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Orçamento ${escapeHtml(quoteDisplayCode(quote))} - ${escapeHtml(quote.title)}</title>
  <style>
    :root { --ink: #151515; --muted: #626262; --line: #cfcfcf; --soft: #ececec; --orange: #ff6500; }
    * { box-sizing: border-box; }
    html { background: #e8e8e8; }
    body { margin: 0; color: var(--ink); font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { width: min(820px, calc(100% - 28px)); margin: 24px auto 92px; padding: 26px 32px 30px; background: #fff; box-shadow: 0 16px 42px rgba(0,0,0,.13); }
    .company { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; border: 1px solid var(--line); padding: 16px; }
    .brand { display: flex; gap: 12px; align-items: flex-start; }
    .brand img { width: 50px; height: 38px; object-fit: contain; }
    .company-name { font-size: 16px; font-weight: 800; text-transform: uppercase; }
    .company-legal { margin-top: 3px; color: var(--muted); font-size: 10px; }
    .company-lines, .company-contact { margin-top: 6px; color: #333; font-size: 10px; line-height: 1.45; }
    .company-contact { margin: 0; text-align: right; }
    .company-contact strong { color: var(--ink); }
    .bar { margin-top: 10px; display: grid; grid-template-columns: 1fr auto; gap: 16px; padding: 6px 8px; border: 1px solid var(--line); background: var(--soft); font-size: 12px; font-weight: 800; }
    .bar.center { grid-template-columns: 1fr auto 1fr; }
    .bar.center span:first-child { visibility: hidden; }
    .bar.center span:nth-child(2) { text-align: center; }
    .bar.center span:last-child { text-align: right; }
    .delivery { margin-top: 7px; padding: 6px 8px; border: 1px solid var(--line); background: #f5f5f5; font-size: 10px; font-weight: 700; }
    .section-title { margin-top: 10px; padding: 5px 7px; border: 1px solid var(--line); border-bottom: 0; background: var(--soft); font-size: 10px; font-weight: 800; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid var(--line); padding: 6px 7px; font-size: 10px; vertical-align: top; }
    th { background: #f7f7f7; text-align: left; font-weight: 800; text-transform: uppercase; }
    .client-label { width: 92px; font-weight: 800; background: #fafafa; }
    .number { width: 38px; text-align: center; }
    .quantity { width: 62px; text-align: right; }
    .money { width: 94px; text-align: right; white-space: nowrap; }
    .service-name { font-weight: 800; }
    .service-detail { margin-top: 3px; color: var(--muted); font-size: 9px; line-height: 1.4; }
    .totals td { font-weight: 800; background: #f4f4f4; }
    .payment-label { font-weight: 700; }
    .signature { margin-top: 18px; min-height: 82px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: end; border: 1px solid var(--ink); padding: 18px 30px 10px; }
    .signature-line { border-top: 1px solid var(--ink); padding-top: 5px; text-align: center; font-size: 9px; }
    .footer { margin-top: 12px; display: flex; justify-content: space-between; gap: 20px; color: var(--muted); font-size: 9px; }
    .actions { position: fixed; right: 22px; bottom: 22px; display: flex; gap: 8px; padding: 8px; background: rgba(255,255,255,.97); box-shadow: 0 8px 28px rgba(0,0,0,.18); }
    .actions a, .actions button { min-height: 38px; border: 1px solid #cfcfcf; padding: 9px 12px; background: #fff; color: var(--ink); font: inherit; font-size: 11px; font-weight: 800; text-decoration: none; cursor: pointer; }
    .actions .primary { border-color: var(--orange); background: var(--orange); color: #fff; }
    @media (max-width: 700px) {
      .sheet { width: 100%; margin: 0 0 82px; padding: 18px 14px 24px; box-shadow: none; }
      .company { grid-template-columns: 1fr; gap: 12px; }
      .company-contact { text-align: left; }
      .services { display: block; overflow-x: auto; }
      .signature { grid-template-columns: 1fr; gap: 36px; }
      .actions { left: 10px; right: 10px; bottom: 10px; overflow-x: auto; }
      .actions > * { flex: 1 0 auto; text-align: center; }
    }
    @page { size: A4; margin: 10mm; }
    @media print {
      html, body { background: #fff; }
      .sheet { width: auto; margin: 0; padding: 0; box-shadow: none; }
      .actions { display: none; }
      thead { display: table-header-group; }
      tr, .signature, .company { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="company">
      <div class="brand">
        <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(company.tradeName)}" />
        <div>
          <div class="company-name">${escapeHtml(company.tradeName)}</div>
          ${company.legalName ? `<div class="company-legal">${escapeHtml(company.legalName)}</div>` : ''}
          ${company.document ? `<div class="company-lines">CNPJ: ${escapeHtml(company.document)}</div>` : ''}
          <div class="company-lines">${companyAddress.map(escapeHtml).join('<br>')}</div>
        </div>
      </div>
      <div class="company-contact">
        ${company.phone ? `<strong>${escapeHtml(company.phone)}</strong><br>` : ''}
        ${company.email ? `${escapeHtml(company.email)}<br>` : ''}
        <strong>Vendedor:</strong> ${escapeHtml(seller)}
      </div>
    </header>

    <div class="bar center"><span></span><span>ORÇAMENTO Nº ${escapeHtml(quoteDisplayCode(quote))}</span><span>${formatDateOnly(quote.createdAt)}</span></div>
    <div class="delivery">PREVISÃO ESTIMADA DE ENTREGA: ${formatDateOnly(deliveryForecast)} (${quote.deliveryBusinessDays} dias úteis após aprovação e confirmação do pagamento)</div>

    <div class="section-title">Dados do cliente</div>
    <table aria-label="Dados do cliente">
      <tbody>
        <tr><td class="client-label">Cliente</td><td>${escapeHtml(quote.client.name)}</td><td class="client-label">CPF/CNPJ</td><td>${escapeHtml(valueOrFallback(quote.client.document))}</td></tr>
        <tr><td class="client-label">Endereço</td><td>${escapeHtml(valueOrFallback(clientAddress))}</td><td class="client-label">CEP</td><td>${escapeHtml(valueOrFallback(quote.client.zipCode))}</td></tr>
        <tr><td class="client-label">Cidade</td><td>${escapeHtml(valueOrFallback(quote.client.city))}</td><td class="client-label">Estado</td><td>${escapeHtml(valueOrFallback(quote.client.state))}</td></tr>
        <tr><td class="client-label">Telefone</td><td>${escapeHtml(valueOrFallback(quote.client.whatsapp || quote.client.phone))}</td><td class="client-label">E-mail</td><td>${escapeHtml(valueOrFallback(quote.client.email))}</td></tr>
      </tbody>
    </table>

    <div class="section-title">Serviços e móveis</div>
    <div class="services">
      <table aria-label="Itens do orçamento">
        <thead><tr><th class="number">Item</th><th>Descrição</th><th class="quantity">Qtd.</th><th class="money">Valor unit.</th><th class="money">Subtotal</th></tr></thead>
        <tbody>
          ${quote.items.map((item, index) => `
            <tr>
              <td class="number">${index + 1}</td>
              <td><div class="service-name">${escapeHtml(item.description)}</div><div class="service-detail">${escapeHtml(item.environment)} · ${formatMeasure(quoteCentimetersToMillimeters(item.width))} × ${formatMeasure(quoteCentimetersToMillimeters(item.height))} mm · ${escapeHtml([item.material || 'MDF', item.finish].filter(Boolean).join(' · '))}${item.notes ? ` · ${escapeHtml(item.notes)}` : ''}</div></td>
              <td class="quantity">${item.quantity}</td>
              <td class="money">${formatCurrency(item.quantity > 0 ? item.total / item.quantity : item.total)}</td>
              <td class="money">${formatCurrency(item.total)}</td>
            </tr>
          `).join('')}
          <tr class="totals"><td colspan="2">TOTAL</td><td class="quantity">${totalQuantity}</td><td></td><td class="money">${formatCurrency(itemSubtotal)}</td></tr>
        </tbody>
      </table>
    </div>

    <table class="totals" aria-label="Resumo financeiro">
      <tbody>
        ${quote.installationFee > 0 ? `<tr><td>Instalação</td><td class="money">${formatCurrency(quote.installationFee)}</td></tr>` : ''}
        ${quote.manualDiscount > 0 ? `<tr><td>Desconto comercial</td><td class="money">- ${formatCurrency(quote.manualDiscount)}</td></tr>` : ''}
        ${quote.paymentDiscount > 0 ? `<tr><td>Desconto Pix</td><td class="money">- ${formatCurrency(quote.paymentDiscount)}</td></tr>` : ''}
        <tr><td>TOTAL DA PROPOSTA</td><td class="money">${formatCurrency(quote.total)}</td></tr>
      </tbody>
    </table>

    <div class="section-title">Dados do pagamento</div>
    <table aria-label="Parcelas do orçamento">
      <thead><tr><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Forma de pagamento</th></tr></thead>
      <tbody>
        ${paymentRows.map((row) => `<tr><td class="payment-label">${escapeHtml(row.label)}</td><td>${row.dueDate ? formatDateOnly(row.dueDate) : 'A combinar'}</td><td>${formatCurrency(row.amount)}</td><td>${escapeHtml(row.method)}</td></tr>`).join('')}
      </tbody>
    </table>

    ${quote.customerNotes ? `<div class="section-title">Observações</div><table><tbody><tr><td>${escapeHtml(quote.customerNotes)}</td></tr></tbody></table>` : ''}

    <section class="signature" aria-label="Assinaturas">
      <div class="signature-line">Assinatura do cliente</div>
      <div class="signature-line">${escapeHtml(seller)} · Responsável pelo orçamento</div>
    </section>

    <footer class="footer">
      <span>${escapeHtml(company.tradeName)} · Orçamento ${escapeHtml(quoteDisplayCode(quote))}</span>
      <span>Documento gerado pelo sistema Vertex</span>
    </footer>
  </main>

  <nav class="actions" aria-label="Ações do orçamento">
    <a href="${escapeHtml(commercialHref)}">Proposta comercial</a>
    ${whatsAppHref ? `<a href="${escapeHtml(whatsAppHref)}" target="_blank" rel="noopener noreferrer">Enviar no WhatsApp</a>` : ''}
    <button class="primary" type="button" onclick="window.print()">Salvar em PDF</button>
  </nav>
</body>
</html>`
}
