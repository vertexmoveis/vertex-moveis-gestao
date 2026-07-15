import Image from 'next/image'
import { notFound } from 'next/navigation'
import { PublicApprovalActions } from '@/components/quotes/public-approval-actions'
import { prisma } from '@/lib/db'
import { formatDateOnly } from '@/lib/date-only'
import {
  getQuotePaymentSummary,
  quoteCentimetersToMillimeters,
  quoteDisplayCode,
} from '@/lib/quotes'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function responseMessage(request: { approvedAt: Date | null; rejectedAt: Date | null; expiresAt: Date | null }) {
  if (request.approvedAt) return 'Este orçamento já foi aprovado. A Vertex Móveis entrará em contato para os próximos passos.'
  if (request.rejectedAt) return 'Este orçamento recebeu um pedido de ajuste. A Vertex Móveis entrará em contato.'
  if (request.expiresAt && request.expiresAt < new Date()) return 'Este link de aprovação expirou. Peça uma nova proposta à Vertex Móveis.'
  return null
}

export default async function PublicQuoteApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const request = await prisma.quoteApprovalRequest.findUnique({
    where: { token },
    include: {
      quote: {
        include: {
          client: { select: { name: true } },
          items: { orderBy: { position: 'asc' } },
        },
      },
    },
  })

  if (!request) notFound()

  const quote = request.quote
  const groupedItems = quote.items.reduce<Record<string, typeof quote.items>>((groups, item) => {
    const environment = item.environment || 'Ambiente'
    groups[environment] = groups[environment] || []
    groups[environment].push(item)
    return groups
  }, {})
  const totalItems = quote.items.reduce((total, item) => total + item.quantity, 0)
  const message = responseMessage(request)
  const paymentSummary = getQuotePaymentSummary(quote)

  return (
    <main className="min-h-screen bg-[#F4F3F0] px-4 py-6 sm:px-6 sm:py-10">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-[#E5E2DD] bg-white shadow-[0_20px_60px_rgba(18,18,18,0.10)]">
        <div className="h-2 bg-[#FF6B00]" />
        <header className="flex flex-col gap-6 border-b border-[#ECE9E5] px-6 py-7 sm:flex-row sm:items-start sm:justify-between sm:px-10 sm:py-9">
          <div className="flex items-center gap-3">
            <Image src="/vertex-symbol.png" alt="Vertex Móveis" width={56} height={40} className="h-10 w-auto" priority />
            <div>
              <p className="text-lg font-extrabold text-[#121212]">Vertex Móveis</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#777]">Móveis planejados</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF6B00]">Proposta comercial</p>
            <h1 className="mt-2 text-xl font-extrabold text-[#121212] sm:text-2xl">{quote.title}</h1>
            <p className="mt-2 text-xs text-[#777]">Código {quoteDisplayCode(quote)}</p>
            {quote.validUntil ? <p className="mt-1 text-xs text-[#777]">Válida até {formatDateOnly(quote.validUntil)}</p> : null}
          </div>
        </header>

        <section className="px-6 pb-7 pt-8 sm:px-10 sm:pt-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF6B00]">Preparado para</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[#121212] sm:text-3xl">{quote.client.name}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5E5E5E]">
            Esta proposta reúne os móveis planejados conforme as medidas e os acabamentos combinados. Confira os itens e responda abaixo.
          </p>
        </section>

        <section className="mx-6 grid border border-[#ECE9E5] sm:mx-10 sm:grid-cols-3">
          <div className="border-b border-[#ECE9E5] px-5 py-4 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#8B8B8B]">Ambientes</p>
            <p className="mt-1 text-xl font-extrabold text-[#121212]">{Object.keys(groupedItems).length}</p>
          </div>
          <div className="border-b border-[#ECE9E5] px-5 py-4 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#8B8B8B]">Móveis</p>
            <p className="mt-1 text-xl font-extrabold text-[#121212]">{totalItems}</p>
          </div>
          <div className="bg-[#121212] px-5 py-4 text-white">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">Investimento total</p>
            <p className="mt-1 text-xl font-extrabold text-[#FF9A52]">{formatCurrency(quote.total)}</p>
          </div>
        </section>

        <section className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-[#121212]">Composição do orçamento</h2>
            <p className="text-xs text-[#777]">Medidas em largura x altura</p>
          </div>
          <div className="space-y-4">
            {Object.entries(groupedItems).map(([environment, items]) => (
              <section key={environment} className="overflow-hidden rounded-lg border border-[#E8E8E8]">
                <div className="flex items-center justify-between gap-4 border-b border-[#E8E8E8] bg-[#FAFAF8] px-4 py-3">
                  <h3 className="font-bold text-[#121212]">{environment}</h3>
                  <p className="text-xs text-[#777]">{items.reduce((total, item) => total + item.quantity, 0)} {items.reduce((total, item) => total + item.quantity, 0) === 1 ? 'móvel' : 'móveis'}</p>
                </div>
                <div className="divide-y divide-[#EFEFEF]">
                  {items.map((item) => (
                    <div key={item.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1.5fr)_auto_auto] sm:items-center">
                      <div>
                        <p className="font-semibold text-[#121212]">{item.description}</p>
                        <p className="mt-1 text-xs text-[#777]">
                          {item.material || 'MDF'}{item.finish ? ` · ${item.finish}` : ''}{item.quantity > 1 ? ` · Quantidade ${item.quantity}` : ''}
                        </p>
                        {item.notes ? <p className="mt-1 text-xs leading-5 text-[#777]">{item.notes}</p> : null}
                      </div>
                      <p className="text-xs font-medium text-[#555] sm:text-right">
                        {quoteCentimetersToMillimeters(item.width)} x {quoteCentimetersToMillimeters(item.height)} mm
                      </p>
                      <p className="font-bold text-[#121212] sm:min-w-28 sm:text-right">{formatCurrency(item.total)}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="grid gap-6 border-t border-[#ECE9E5] px-6 py-8 sm:grid-cols-[1.1fr_0.9fr] sm:px-10">
          <div>
            <h2 className="text-base font-bold text-[#121212]">Informações da proposta</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#5E5E5E]">
              {quote.customerNotes || 'A produção será iniciada após a aprovação e a confirmação do pagamento combinado.'}
            </p>
            <ul className="mt-4 space-y-2 text-xs leading-5 text-[#666]">
              <li>As medidas finais serão conferidas antes do início da fabricação.</li>
              <li>Alterações de medidas, materiais ou acabamentos podem exigir revisão de valor.</li>
              <li>Forma de pagamento: {paymentSummary}.</li>
            </ul>
          </div>
          <div className="overflow-hidden rounded-lg border border-[#E8E8E8]">
            <p className="bg-[#FAFAF8] px-4 py-3 text-sm font-bold text-[#121212]">Resumo do investimento</p>
            <div className="space-y-3 px-4 py-4 text-sm">
              <div className="flex justify-between gap-4 text-[#5E5E5E]"><span>Pagamento</span><strong className="text-right text-[#121212]">{paymentSummary}</strong></div>
              {quote.manualDiscount > 0 ? <div className="flex justify-between gap-4 text-[#5E5E5E]"><span>Desconto comercial</span><strong className="text-[#121212]">- {formatCurrency(quote.manualDiscount)}</strong></div> : null}
              {quote.paymentDiscount > 0 ? <div className="flex justify-between gap-4 text-[#5E5E5E]"><span>Desconto Pix</span><strong className="text-[#121212]">- {formatCurrency(quote.paymentDiscount)}</strong></div> : null}
              <div className="flex items-center justify-between gap-4 border-t border-[#E8E8E8] pt-3"><span className="font-bold text-[#121212]">Total</span><strong className="text-xl text-[#FF6B00]">{formatCurrency(quote.total)}</strong></div>
            </div>
          </div>
        </section>

        <section className="border-t border-[#ECE9E5] bg-[#FFF8F2] px-6 py-7 sm:px-10">
          <h2 className="text-base font-bold text-[#121212]">Sua resposta</h2>
          <p className="mt-1 text-sm text-[#666]">Ao aprovar, a Vertex Móveis será avisada para confirmar os próximos passos.</p>
          <div className="mt-4">
            {message ? (
              <p className="rounded-lg border border-[#E8E8E8] bg-white px-4 py-3 text-sm text-[#444]">{message}</p>
            ) : (
              <PublicApprovalActions token={token} />
            )}
          </div>
        </section>

        <footer className="flex flex-col gap-1 border-t border-[#ECE9E5] px-6 py-5 text-xs text-[#777] sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p>Vertex Móveis · Rua Saturno, 6 · Cotia, SP · 06702-170</p>
          <p>Proposta {quoteDisplayCode(quote)}</p>
        </footer>
      </article>
    </main>
  )
}
