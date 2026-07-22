import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID, formatCompanyAddress, withCompanyProfileDefaults } from '@/lib/company-profile'
import { formatDateOnly } from '@/lib/date-only'
import { parseQuoteApprovalSnapshot } from '@/lib/quote-approval'
import { quoteDisplayCode } from '@/lib/quotes'
import { formatCurrency } from '@/lib/utils'

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  }).format(value)
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [request, rawCompany] = await Promise.all([
    prisma.quoteApprovalRequest.findUnique({
      where: { token },
      include: {
        quote: {
          include: {
            client: true,
            items: { orderBy: { position: 'asc' } },
          },
        },
      },
    }),
    prisma.companyProfile.findUnique({ where: { id: COMPANY_PROFILE_ID } }),
  ])

  if (!request?.approvedAt) {
    return NextResponse.json({ error: 'Comprovante de aprovação não encontrado.' }, { status: 404 })
  }

  const company = withCompanyProfileDefaults(rawCompany)
  const quote = request.quote
  const approvedSnapshot = parseQuoteApprovalSnapshot(request.snapshot)
  const approvedQuote = approvedSnapshot?.quote
  const approvedClient = approvedQuote?.client || quote.client
  const approvedItems = approvedQuote?.items || quote.items
  const approvedTotal = approvedQuote?.total ?? quote.total
  const approvedValidity = approvedQuote?.validUntil || quote.validUntil
  const approvedTitle = approvedQuote?.title || quote.title
  const code = quoteDisplayCode(quote)
  const certificateCode = `VERTEX-${code}-${request.id.slice(-8).toUpperCase()}`
  const snapshotHash = createHash('sha256').update(request.snapshot || '').digest('hex')
  const clientAddress = approvedClient.address || [
    [approvedClient.street, approvedClient.number].filter(Boolean).join(', '),
    approvedClient.neighborhood,
    [approvedClient.city, approvedClient.state].filter(Boolean).join('/'),
    approvedClient.zipCode,
  ].filter(Boolean).join(' - ')
  const companyAddress = formatCompanyAddress(company).join(' | ')
  const items = approvedItems.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(item.environmentName || item.environment)}</strong><br><span>${escapeHtml(item.description)}</span></td>
      <td>${escapeHtml(item.quantity)}</td>
      <td>${escapeHtml(formatCurrency(item.total))}</td>
    </tr>
  `).join('')

  const html = `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Comprovante ${escapeHtml(certificateCode)}</title>
      <style>
        *{box-sizing:border-box} body{margin:0;background:#ececea;color:#121212;font-family:Arial,sans-serif;font-size:13px;line-height:1.45}
        .page{width:min(900px,calc(100% - 28px));margin:28px auto;background:#fff;border-top:7px solid #ff6b00;box-shadow:0 16px 45px rgba(0,0,0,.12)}
        header,.section,footer{padding:26px 34px}.brand{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #e8e8e8}.brand h1{margin:0;font-size:22px}.brand p{margin:4px 0;color:#666}.title{text-align:right}.title strong{color:#ff6b00;text-transform:uppercase;font-size:11px;letter-spacing:.08em}
        h2{font-size:16px;margin:0 0 14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{border:1px solid #e2e2e2;padding:11px}.field span{display:block;color:#777;font-size:10px;text-transform:uppercase;margin-bottom:4px}.field strong{word-break:break-word}
        .status{border-left:5px solid #16a34a;background:#ecfdf5;padding:14px 16px;margin-bottom:18px}.status strong{display:block;color:#166534;font-size:15px}.status span{color:#166534}.status.replaced{border-left-color:#d97706;background:#fffbeb}.status.replaced strong,.status.replaced span{color:#92400e}
        table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:9px;text-align:left}th{background:#f5f5f3;font-size:10px;text-transform:uppercase}td:last-child,th:last-child{text-align:right}
        .proof{background:#121212;color:#fff}.proof .grid{grid-template-columns:repeat(2,1fr)}.proof .field{border-color:#3c3c3c}.proof .field span{color:#aaa}.hash{font-family:Consolas,monospace;font-size:10px;word-break:break-all}
        footer{border-top:1px solid #e8e8e8;color:#666;font-size:11px;display:flex;justify-content:space-between;gap:24px}.actions{position:fixed;right:20px;bottom:20px}.actions button{border:0;border-radius:6px;background:#ff6b00;color:#fff;font-weight:700;padding:12px 18px;cursor:pointer}
        @media(max-width:650px){.page{width:100%;margin:0;box-shadow:none}.brand,.grid,footer{grid-template-columns:1fr;display:grid}.title{text-align:left}.proof .grid{grid-template-columns:1fr}header,.section,footer{padding:20px}.actions{right:12px;bottom:12px}}
        @media print{body{background:#fff}.page{width:100%;margin:0;box-shadow:none}.actions{display:none}@page{size:A4;margin:10mm}}
      </style>
    </head>
    <body>
      <article class="page">
        <header class="brand">
          <div><h1>${escapeHtml(company.tradeName)}</h1><p>${escapeHtml(company.document || '')}</p><p>${escapeHtml(companyAddress)}</p></div>
          <div class="title"><strong>Comprovante de aceite eletrônico</strong><h1>Orçamento ${escapeHtml(code)}</h1><p>${escapeHtml(approvedTitle)}</p><p>${escapeHtml(certificateCode)}</p></div>
        </header>
        <section class="section">
          <div class="status${request.invalidatedAt ? ' replaced' : ''}"><strong>${request.invalidatedAt ? 'Aceite histórico preservado' : 'Proposta aprovada'}</strong><span>Resposta registrada em ${escapeHtml(formatDateTime(request.approvedAt))}${request.invalidatedAt ? `. Esta versão foi substituída em ${escapeHtml(formatDateTime(request.invalidatedAt))}.` : ''}</span></div>
          <h2>Identificação</h2>
          <div class="grid">
            <div class="field"><span>Cliente do orçamento</span><strong>${escapeHtml(approvedClient.name)}</strong></div>
            <div class="field"><span>CPF/CNPJ do cadastro</span><strong>${escapeHtml(approvedClient.document || 'Não informado')}</strong></div>
            <div class="field"><span>Responsável pelo aceite</span><strong>${escapeHtml(request.responseName || approvedClient.name)}</strong></div>
            <div class="field"><span>CPF/CNPJ informado no aceite</span><strong>${escapeHtml(request.responseDocument || 'Não informado')}</strong></div>
            <div class="field"><span>Endereço do cliente</span><strong>${escapeHtml(clientAddress || 'Não informado')}</strong></div>
            <div class="field"><span>Validade da proposta</span><strong>${escapeHtml(formatDateOnly(approvedValidity))}</strong></div>
          </div>
        </section>
        <section class="section">
          <h2>Itens aprovados</h2>
          <table><thead><tr><th>Item</th><th>Ambiente e móvel</th><th>Qtd.</th><th>Valor</th></tr></thead><tbody>${items}</tbody><tfoot><tr><th colspan="3">Total aprovado</th><th>${escapeHtml(formatCurrency(approvedTotal))}</th></tr></tfoot></table>
        </section>
        <section class="section proof">
          <h2>Registro técnico</h2>
          <div class="grid">
            <div class="field"><span>Data e hora do aceite</span><strong>${escapeHtml(formatDateTime(request.acceptedTermsAt || request.approvedAt))}</strong></div>
            <div class="field"><span>Revisão aprovada</span><strong>${escapeHtml(request.revisionVersion || 1)}</strong></div>
            <div class="field"><span>Identificador da conexão</span><strong class="hash">${escapeHtml(request.responseIpHash?.slice(0, 24) || 'Não disponível')}</strong></div>
            <div class="field"><span>Identificador do conteúdo aprovado</span><strong class="hash">${escapeHtml(snapshotHash)}</strong></div>
          </div>
        </section>
        <footer><span>Este documento registra o aceite eletrônico da proposta e preserva a identificação do conteúdo apresentado.</span><span>${escapeHtml(company.email || '')} | ${escapeHtml(company.phone || '')}</span></footer>
      </article>
      <div class="actions"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
    </body>
  </html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
