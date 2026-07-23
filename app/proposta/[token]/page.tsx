import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  PublicApprovalActions,
  type PublicApprovalOption,
} from '@/components/quotes/public-approval-actions'
import { prisma } from '@/lib/db'
import { addBusinessDays } from '@/lib/business-days'
import { formatDateOnly, isDateOnlyExpired } from '@/lib/date-only'
import {
  getQuoteInstallmentGridColumns,
  getQuotePaymentDetails,
  getQuotePaymentSummary,
  QUOTE_PRICE_PROFILE_LABELS,
  quoteCentimetersToMillimeters,
  quoteDisplayCode,
  safeQuotePriceProfile,
} from '@/lib/quotes'
import { formatCurrency } from '@/lib/utils'
import {
  buildQuoteApprovalBundleSnapshot,
  buildQuoteApprovalSnapshot,
  parseQuoteApprovalBundleSnapshot,
  parseQuoteApprovalSnapshot,
  type QuoteApprovalData,
} from '@/lib/quote-approval'

export const dynamic = 'force-dynamic'

const INSTALLMENT_GRID_CLASSES: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-5',
}

function responseMessage(
  request: { approvedAt: Date | null; rejectedAt: Date | null; expiresAt: Date | null; invalidatedAt: Date | null },
  selectedTitle?: string,
) {
  if (request.invalidatedAt) return 'Estas propostas foram atualizadas. Peça um novo link à Vertex Móveis para conferir os valores atuais.'
  if (request.approvedAt) {
    return selectedTitle
      ? `A opção "${selectedTitle}" já foi aprovada. A Vertex Móveis entrará em contato para os próximos passos.`
      : 'Este orçamento já foi aprovado. A Vertex Móveis entrará em contato para os próximos passos.'
  }
  if (request.rejectedAt) return 'Foi registrado um pedido de ajuste. A Vertex Móveis entrará em contato.'
  if (isDateOnlyExpired(request.expiresAt)) return 'Este link de aprovação expirou. Peça uma nova proposta à Vertex Móveis.'
  return null
}

function QuoteOptionDetails({
  quote,
  optionNumber,
  comparison,
}: {
  quote: QuoteApprovalData
  optionNumber: number
  comparison: boolean
}) {
  const groupedItems = quote.items.reduce<Record<string, typeof quote.items>>((groups, item) => {
    const environment = item.environmentName || item.environment || 'Ambiente'
    groups[environment] = groups[environment] || []
    groups[environment].push(item)
    return groups
  }, {})
  const totalItems = quote.items.reduce((total, item) => total + item.quantity, 0)
  const itemSubtotal = quote.items.reduce((total, item) => total + item.total, 0)
  const payment = getQuotePaymentDetails(quote)
  const deliveryForecast = addBusinessDays(quote.createdAt, quote.deliveryBusinessDays || 30)
  const installmentGridColumns = getQuoteInstallmentGridColumns(payment.installments.length)
  const installmentGridClass = INSTALLMENT_GRID_CLASSES[installmentGridColumns] || INSTALLMENT_GRID_CLASSES[4]

  return (
    <section className={comparison ? 'border-t-8 border-[#F4F3F0]' : ''}>
      {comparison ? (
        <div className="flex flex-col gap-3 border-b border-[#ECE9E5] bg-[#FAFAF8] px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div>
            <p className="text-[11px] font-bold uppercase text-[#FF6B00]">Opção {optionNumber}</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#121212]">{quote.title}</h2>
            <p className="mt-1 text-xs text-[#777]">Proposta {quoteDisplayCode(quote)}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-extrabold text-[#121212]">{formatCurrency(quote.total)}</p>
            <p className="mt-1 text-sm text-[#666]">{getQuotePaymentSummary(quote)}</p>
          </div>
        </div>
      ) : null}

      <div className="px-6 pt-7 sm:px-10">
        <div className="grid overflow-hidden rounded-lg border border-[#ECE9E5] sm:grid-cols-3">
          <div className="border-b border-[#ECE9E5] px-5 py-4 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-bold uppercase text-[#8B8B8B]">Ambientes</p>
            <p className="mt-1 text-xl font-extrabold text-[#121212]">{Object.keys(groupedItems).length}</p>
          </div>
          <div className="border-b border-[#ECE9E5] px-5 py-4 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-bold uppercase text-[#8B8B8B]">Móveis</p>
            <p className="mt-1 text-xl font-extrabold text-[#121212]">{totalItems}</p>
          </div>
          <div className="bg-[#121212] px-5 py-4 text-white">
            <p className="text-[10px] font-bold uppercase text-white/60">Investimento total</p>
            <p className="mt-1 text-xl font-extrabold text-[#FF9A52]">{formatCurrency(quote.total)}</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 sm:px-10 sm:py-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-[#121212]">Composição do orçamento</h2>
          <p className="text-xs text-[#777]">Medidas em largura x altura</p>
        </div>
        <div className="space-y-4">
          {Object.entries(groupedItems).map(([environment, items]) => (
            <section key={environment} className="overflow-hidden rounded-lg border border-[#E8E8E8]">
              <div className="flex items-center justify-between gap-4 border-b border-[#E8E8E8] bg-[#FAFAF8] px-4 py-3">
                <h3 className="font-bold text-[#121212]">{environment}</h3>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#121212]">{formatCurrency(items.reduce((total, item) => total + item.total, 0))}</p>
                  <p className="text-xs text-[#777]">
                    {items.reduce((total, item) => total + item.quantity, 0)} {items.reduce((total, item) => total + item.quantity, 0) === 1 ? 'móvel' : 'móveis'}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-[#EFEFEF]">
                {items.map((item) => (
                  <div key={item.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1.5fr)_auto_auto] sm:items-center">
                    <div>
                      <p className="font-semibold text-[#121212]">{item.description}</p>
                      <p className="mt-1 text-sm leading-5 text-[#777]">
                        {[item.material || 'MDF', item.priceProfile ? QUOTE_PRICE_PROFILE_LABELS[safeQuotePriceProfile(item.priceProfile)] : 'Externo não informado', item.finish || 'Interno não informado'].join(' · ')}
                        {item.quantity > 1 ? ` · Quantidade ${item.quantity}` : ''}
                      </p>
                      {item.notes ? <p className="mt-1 text-sm leading-5 text-[#777]">{item.notes}</p> : null}
                    </div>
                    <p className="text-sm font-medium text-[#555] sm:text-right">
                      {quoteCentimetersToMillimeters(item.width)} x {quoteCentimetersToMillimeters(item.height)} mm
                    </p>
                    <p className="font-bold text-[#121212] sm:min-w-28 sm:text-right">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="border-t border-[#ECE9E5] px-6 py-8 sm:px-10 sm:py-10">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-[#FF6B00]">Pagamento</p>
            <h2 className="mt-1 text-lg font-bold text-[#121212]">Condições de pagamento</h2>
          </div>
          <p className="text-sm font-semibold text-[#FF6B00]">{payment.methodLabel}</p>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#E8E8E8] border-t-4 border-t-[#FF6B00]">
          <div className="grid sm:grid-cols-4">
            {payment.method === 'CARD' ? (
              <>
                <div className="border-b border-[#E8E8E8] px-4 py-4 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-bold uppercase text-[#8B8B8B]">Entrada</p>
                  <p className="mt-1 font-bold text-[#121212]">{payment.downPayment > 0 ? formatCurrency(payment.downPayment) : 'Sem entrada'}</p>
                </div>
                <div className="border-b border-[#E8E8E8] px-4 py-4 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-bold uppercase text-[#8B8B8B]">Saldo parcelado</p>
                  <p className="mt-1 font-bold text-[#121212]">{formatCurrency(payment.financedAmount)}</p>
                </div>
                <div className="border-b border-[#E8E8E8] px-4 py-4 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-bold uppercase text-[#8B8B8B]">Parcelamento</p>
                  <p className="mt-1 font-bold text-[#121212]">{payment.installments.length > 0 ? `${payment.installments.length}x no cartão` : 'Sem saldo restante'}</p>
                </div>
              </>
            ) : payment.method === 'PIX' ? (
              <>
                <div className="border-b border-[#E8E8E8] px-4 py-4 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-bold uppercase text-[#8B8B8B]">Valor antes do Pix</p>
                  <p className="mt-1 font-bold text-[#121212]">{formatCurrency(payment.totalBeforePaymentDiscount)}</p>
                </div>
                <div className="border-b border-[#E8E8E8] px-4 py-4 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-bold uppercase text-[#8B8B8B]">Desconto Pix</p>
                  <p className="mt-1 font-bold text-emerald-700">- {formatCurrency(payment.paymentDiscount)}</p>
                </div>
                <div className="border-b border-[#E8E8E8] px-4 py-4 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-bold uppercase text-[#8B8B8B]">Pagamento</p>
                  <p className="mt-1 font-bold text-[#121212]">À vista</p>
                </div>
              </>
            ) : (
              <>
                <div className="border-b border-[#E8E8E8] px-4 py-4 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-bold uppercase text-[#8B8B8B]">Forma</p>
                  <p className="mt-1 font-bold text-[#121212]">A combinar</p>
                </div>
                <div className="border-b border-[#E8E8E8] px-4 py-4 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-bold uppercase text-[#8B8B8B]">Entrada</p>
                  <p className="mt-1 font-bold text-[#121212]">A combinar</p>
                </div>
                <div className="border-b border-[#E8E8E8] px-4 py-4 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-bold uppercase text-[#8B8B8B]">Parcelamento</p>
                  <p className="mt-1 font-bold text-[#121212]">A combinar</p>
                </div>
              </>
            )}
            <div className="bg-[#121212] px-4 py-4 text-white">
              <p className="text-[10px] font-bold uppercase text-white/60">Total da proposta</p>
              <p className="mt-1 text-lg font-extrabold text-[#FF9A52]">{formatCurrency(payment.total)}</p>
            </div>
          </div>

          {payment.method === 'CARD' && payment.installments.length > 0 ? (
            <div className="border-t border-[#E8E8E8] px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h3 className="text-sm font-bold text-[#121212]">Detalhamento das parcelas</h3>
                <span className="text-xs text-[#777]">{payment.installments.length} {payment.installments.length === 1 ? 'parcela' : 'parcelas'}</span>
              </div>
              <div className={`grid ${installmentGridClass} border-l border-t border-[#E8E8E8]`}>
                {payment.installments.map((installment) => (
                  <div key={installment.number} className="border-b border-r border-[#E8E8E8] px-3 py-2.5">
                    <p className="text-[10px] text-[#777]">Parcela {installment.number}</p>
                    <p className="mt-0.5 text-sm font-bold text-[#121212]">{formatCurrency(installment.amount)}</p>
                    {installment.dueDate ? <p className="mt-0.5 text-[10px] text-[#777]">Vencimento {formatDateOnly(installment.dueDate)}</p> : null}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-[#777]">
                {quote.firstInstallmentDate ? 'Os vencimentos seguem a data informada no orçamento.' : 'As datas de vencimento serão combinadas na contratação.'} A última parcela pode ter ajuste de centavos para fechar o valor total.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 border-t border-[#ECE9E5] px-6 py-8 sm:grid-cols-[1.1fr_0.9fr] sm:px-10">
        <div>
          <h2 className="text-base font-bold text-[#121212]">Informações da proposta</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#5E5E5E]">
            {quote.customerNotes || 'A produção será iniciada após a aprovação e a confirmação do pagamento combinado.'}
          </p>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-[#666]">
            <li>As medidas finais serão conferidas antes do início da fabricação.</li>
            <li>Alterações de medidas, materiais ou acabamentos podem exigir revisão de valor.</li>
            <li>As condições de pagamento estão detalhadas no quadro acima.</li>
            <li>Prazo previsto de entrega: {quote.deliveryBusinessDays || 30} dias úteis após a aprovação do projeto e a confirmação do pagamento{deliveryForecast ? `, com previsão estimada em ${formatDateOnly(deliveryForecast)}` : ''}.</li>
          </ul>
        </div>
        <div className="overflow-hidden rounded-lg border border-[#E8E8E8]">
          <p className="bg-[#FAFAF8] px-4 py-3 text-sm font-bold text-[#121212]">Resumo do investimento</p>
          <div className="space-y-3 px-4 py-4 text-sm">
            <div className="flex justify-between gap-4 text-[#5E5E5E]"><span>Móveis planejados</span><strong className="text-right text-[#121212]">{formatCurrency(itemSubtotal)}</strong></div>
            {quote.installationFee > 0 ? <div className="flex justify-between gap-4 text-[#5E5E5E]"><span>Instalação</span><strong className="text-[#121212]">{formatCurrency(quote.installationFee)}</strong></div> : null}
            {quote.manualDiscount > 0 ? <div className="flex justify-between gap-4 text-[#5E5E5E]"><span>Desconto comercial</span><strong className="text-[#121212]">- {formatCurrency(quote.manualDiscount)}</strong></div> : null}
            {quote.paymentDiscount > 0 ? <div className="flex justify-between gap-4 text-[#5E5E5E]"><span>Desconto Pix</span><strong className="text-[#121212]">- {formatCurrency(quote.paymentDiscount)}</strong></div> : null}
            <div className="flex items-center justify-between gap-4 border-t border-[#E8E8E8] pt-3"><span className="font-bold text-[#121212]">Total</span><strong className="text-xl text-[#FF6B00]">{formatCurrency(quote.total)}</strong></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default async function PublicQuoteApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const request = await prisma.quoteApprovalRequest.findUnique({
    where: { token },
    include: {
      quote: {
        include: {
          client: { select: { name: true, document: true, phone: true, whatsapp: true, address: true, street: true, number: true, neighborhood: true, city: true, state: true, zipCode: true } },
          items: { orderBy: { position: 'asc' } },
        },
      },
      comparisonQuote: {
        include: {
          client: { select: { name: true, document: true, phone: true, whatsapp: true, address: true, street: true, number: true, neighborhood: true, city: true, state: true, zipCode: true } },
          items: { orderBy: { position: 'asc' } },
        },
      },
    },
  })

  if (!request) notFound()

  const storedBundle = parseQuoteApprovalBundleSnapshot(request.snapshot)
  const currentBundle = request.comparisonQuote
    ? parseQuoteApprovalBundleSnapshot(buildQuoteApprovalBundleSnapshot([request.quote, request.comparisonQuote]))
    : null
  const storedSingle = parseQuoteApprovalSnapshot(request.snapshot)
  const currentSingle = parseQuoteApprovalSnapshot(buildQuoteApprovalSnapshot(request.quote))
  const quotes = storedBundle?.quotes
    || currentBundle?.quotes
    || [storedSingle?.quote || currentSingle!.quote]
  const comparison = quotes.length > 1
  const selectedQuote = request.selectedQuoteId
    ? quotes.find((quote) => quote.id === request.selectedQuoteId)
    : undefined
  const message = responseMessage(request, selectedQuote?.title)
  const clientName = quotes[0].client.name
  const approvalOptions: PublicApprovalOption[] = comparison
    ? quotes.map((quote) => ({
        id: quote.id,
        title: quote.title,
        totalLabel: formatCurrency(quote.total),
        paymentLabel: getQuotePaymentSummary(quote),
      }))
    : []

  return (
    <main className="min-h-screen bg-[#F4F3F0] px-4 py-6 sm:px-6 sm:py-10">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-[#E5E2DD] bg-white shadow-[0_20px_60px_rgba(18,18,18,0.10)]">
        <div className="h-2 bg-[#FF6B00]" />
        <header className="flex flex-col gap-6 border-b border-[#ECE9E5] px-6 py-7 sm:flex-row sm:items-start sm:justify-between sm:px-10 sm:py-9">
          <div className="flex items-center gap-3">
            <Image src="/vertex-symbol.png" alt="Vertex Móveis" width={56} height={40} className="h-10 w-auto" style={{ width: 'auto' }} priority />
            <div>
              <p className="text-lg font-extrabold text-[#121212]">Vertex Móveis</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase text-[#777]">Móveis planejados</p>
            </div>
          </div>
          <div className="sm:max-w-md sm:text-right">
            <p className="text-[11px] font-bold uppercase text-[#FF6B00]">{comparison ? 'Comparativo de propostas' : 'Proposta comercial'}</p>
            <h1 className="mt-2 text-xl font-extrabold text-[#121212] sm:text-2xl">
              {comparison ? 'Duas opções para o seu projeto' : quotes[0].title}
            </h1>
            <p className="mt-2 text-xs text-[#777]">
              {comparison
                ? `Propostas ${quotes.map(quoteDisplayCode).join(' e ')}`
                : `Código ${quoteDisplayCode(quotes[0])}`}
            </p>
          </div>
        </header>

        <section className="px-6 pb-7 pt-8 sm:px-10 sm:pt-10">
          <p className="text-[11px] font-bold uppercase text-[#FF6B00]">Preparado para</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[#121212] sm:text-3xl">{clientName}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5E5E5E]">
            {comparison
              ? 'Preparamos duas alternativas para você comparar com calma. Confira os móveis, acabamentos, valores e pagamento de cada uma; depois escolha a sua preferida ao final.'
              : 'Esta proposta reúne os móveis planejados conforme as medidas e os acabamentos combinados. Confira os itens e responda abaixo.'}
          </p>
        </section>

        {comparison ? (
          <section className="border-y border-[#ECE9E5] bg-[#FAFAF8] px-6 py-6 sm:px-10">
            <div className="grid gap-3 sm:grid-cols-2">
              {quotes.map((quote, index) => (
                <div key={quote.id} className="rounded-lg border border-[#E2DED8] bg-white px-4 py-4">
                  <p className="text-[10px] font-bold uppercase text-[#FF6B00]">Opção {index + 1}</p>
                  <h2 className="mt-1 font-bold text-[#121212]">{quote.title}</h2>
                  <p className="mt-3 text-2xl font-extrabold text-[#121212]">{formatCurrency(quote.total)}</p>
                  <p className="mt-1 text-xs leading-5 text-[#666]">{getQuotePaymentSummary(quote)}</p>
                  {quote.validUntil ? <p className="mt-2 text-xs text-[#777]">Válida até {formatDateOnly(quote.validUntil)}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {quotes.map((quote, index) => (
          <QuoteOptionDetails
            key={quote.id}
            quote={quote}
            optionNumber={index + 1}
            comparison={comparison}
          />
        ))}

        <section className="border-t border-[#ECE9E5] bg-[#FFF8F2] px-6 py-7 sm:px-10">
          <h2 className="text-base font-bold text-[#121212]">{comparison ? 'Escolha e responda' : 'Sua resposta'}</h2>
          <p className="mt-1 text-sm text-[#666]">
            {comparison
              ? 'Selecione uma das opções abaixo. A Vertex Móveis receberá exatamente qual proposta você aprovou.'
              : 'Ao aprovar, a Vertex Móveis será avisada para confirmar os próximos passos.'}
          </p>
          <div className="mt-4">
            {message ? (
              <div className="rounded-lg border border-[#E8E8E8] bg-white px-4 py-3 text-sm text-[#444]">
                <p>{message}</p>
                {request.approvedAt ? (
                  <a href={`/api/public/quote-approvals/${token}/certificate`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-emerald-200 px-3 font-semibold text-emerald-700 hover:bg-emerald-50">
                    Abrir comprovante de aprovação
                  </a>
                ) : null}
              </div>
            ) : (
              <PublicApprovalActions token={token} clientName={clientName} options={approvalOptions} />
            )}
          </div>
        </section>

        <footer className="flex flex-col gap-1 border-t border-[#ECE9E5] px-6 py-5 text-xs text-[#777] sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p>Vertex Móveis · Rua Saturno, 6 · Cotia, SP · 06702-170</p>
          <p>{comparison ? 'Comparativo' : 'Proposta'} {quotes.map(quoteDisplayCode).join(' · ')}</p>
        </footer>
      </article>
    </main>
  )
}
