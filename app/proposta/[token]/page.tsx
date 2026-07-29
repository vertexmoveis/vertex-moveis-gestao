import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ExternalLink, FileText } from 'lucide-react'
import {
  PublicApprovalActions,
  type PublicApprovalOption,
} from '@/components/quotes/public-approval-actions'
import { prisma } from '@/lib/db'
import { formatDateOnly, isDateOnlyExpired } from '@/lib/date-only'
import {
  getQuotePaymentSummary,
  quoteDisplayCode,
} from '@/lib/quotes'
import { formatCurrency } from '@/lib/utils'
import {
  buildQuoteApprovalBundleSnapshot,
  buildQuoteApprovalOptionsSnapshot,
  buildQuoteApprovalSnapshot,
  parseQuoteApprovalQuotes,
  type QuoteApprovalData,
} from '@/lib/quote-approval'
import { isValidPublicToken } from '@/lib/public-access'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Orçamento | Vertex Móveis',
  robots: { index: false, follow: false },
}

function responseMessage(
  request: {
    approvedAt: Date | null
    rejectedAt: Date | null
    expiresAt: Date | null
    invalidatedAt: Date | null
  },
  selectedTitle?: string,
) {
  if (request.invalidatedAt) {
    return 'Estes orçamentos foram atualizados. Peça um novo link à Vertex Móveis para conferir os valores atuais.'
  }
  if (request.approvedAt) {
    return selectedTitle
      ? `A opção "${selectedTitle}" já foi aprovada. A Vertex Móveis entrará em contato para os próximos passos.`
      : 'Este orçamento já foi aprovado. A Vertex Móveis entrará em contato para os próximos passos.'
  }
  if (request.rejectedAt) {
    return 'Foi registrado um pedido de ajuste. A Vertex Móveis entrará em contato.'
  }
  if (isDateOnlyExpired(request.expiresAt)) {
    return 'Este link de aprovação expirou. Peça um novo orçamento à Vertex Móveis.'
  }
  return null
}

function UnavailableProposal({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F4F3F0] px-4 py-10">
      <section className="w-full max-w-lg overflow-hidden rounded-lg border border-[#E5E2DD] bg-white shadow-[0_20px_60px_rgba(18,18,18,0.10)]">
        <div className="h-2 bg-[#FF6B00]" />
        <div className="px-6 py-8 sm:px-10">
          <div className="flex items-center gap-3">
            <Image
              src="/vertex-symbol.png"
              alt="Vertex Móveis"
              width={48}
              height={34}
              className="h-9 w-auto"
              priority
            />
            <div>
              <p className="font-extrabold text-[#121212]">Vertex Móveis</p>
              <p className="text-xs text-[#777]">Orçamento em PDF</p>
            </div>
          </div>
          <h1 className="mt-8 text-xl font-extrabold text-[#121212]">Link indisponível</h1>
          <p className="mt-3 text-sm leading-6 text-[#5E5E5E]">{message}</p>
          <p className="mt-6 border-t border-[#ECE9E5] pt-5 text-xs leading-5 text-[#777]">
            Por segurança, os dados do cliente e os valores não são exibidos em links vencidos ou substituídos.
          </p>
        </div>
      </section>
    </main>
  )
}

function QuotePdfPreview({
  token,
  quote,
  optionNumber,
  comparison,
}: {
  token: string
  quote: QuoteApprovalData
  optionNumber: number
  comparison: boolean
}) {
  const pdfUrl = `/api/public/quote-approvals/${token}/document?quoteId=${encodeURIComponent(quote.id)}`

  return (
    <section className="border-t border-[#ECE9E5] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase text-[#FF6B00]">
            {comparison ? `Opção ${optionNumber}` : 'Orçamento simples'}
          </p>
          <h2 className="mt-1 text-lg font-extrabold text-[#121212]">
            {quote.variationName || quote.title}
          </h2>
          <p className="mt-1 text-xs text-[#777]">
            Orçamento {quoteDisplayCode(quote)} · {formatCurrency(quote.total)}
          </p>
        </div>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#D8D5D0] bg-white px-4 text-sm font-semibold text-[#121212] hover:border-[#FF6B00] hover:text-[#FF6B00]"
        >
          <FileText size={16} />
          Abrir PDF
          <ExternalLink size={14} />
        </a>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-[#D8D5D0] bg-[#E8E8E8] sm:block">
        <iframe
          src={`${pdfUrl}#view=FitH`}
          title={`Orçamento ${quoteDisplayCode(quote)} em PDF`}
          className="h-[72vh] min-h-[520px] w-full bg-white sm:h-[78vh] sm:min-h-[680px]"
          loading={optionNumber === 1 ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-[#777] sm:hidden">
        No celular, toque em “Abrir PDF” para conferir o documento completo.
      </p>
    </section>
  )
}

export default async function PublicQuoteApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!isValidPublicToken(token)) notFound()

  const quoteInclude = {
    client: {
      select: {
        name: true,
        document: true,
        phone: true,
        whatsapp: true,
        address: true,
        street: true,
        number: true,
        neighborhood: true,
        city: true,
        state: true,
        zipCode: true,
      },
    },
    items: { orderBy: { position: 'asc' as const } },
  }
  const request = await prisma.quoteApprovalRequest.findUnique({
    where: { token },
    include: {
      quote: { include: quoteInclude },
      comparisonQuote: { include: quoteInclude },
      options: {
        orderBy: { position: 'asc' },
        include: { quote: { include: quoteInclude } },
      },
    },
  })

  if (!request) notFound()
  if (request.invalidatedAt) {
    return <UnavailableProposal message="Este orçamento foi atualizado. Solicite um novo link à Vertex Móveis." />
  }
  if (request.rejectedAt) {
    return <UnavailableProposal message="Este orçamento já recebeu um pedido de ajuste. Solicite a versão atualizada à Vertex Móveis." />
  }
  if (isDateOnlyExpired(request.expiresAt) && !request.approvedAt) {
    return <UnavailableProposal message="Este orçamento expirou. Solicite um novo link à Vertex Móveis." />
  }

  const optionQuotes = request.options.map((option) => option.quote)
  const fallbackSnapshot = optionQuotes.length > 1
    ? buildQuoteApprovalOptionsSnapshot(optionQuotes)
    : request.comparisonQuote
      ? buildQuoteApprovalBundleSnapshot([request.quote, request.comparisonQuote])
      : buildQuoteApprovalSnapshot(request.quote)
  const quotes = parseQuoteApprovalQuotes(request.snapshot)
    || parseQuoteApprovalQuotes(fallbackSnapshot)
  if (!quotes?.length) notFound()

  const comparison = quotes.length > 1
  const selectedQuote = request.selectedQuoteId
    ? quotes.find((quote) => quote.id === request.selectedQuoteId)
    : undefined
  const message = responseMessage(
    request,
    selectedQuote?.variationName || selectedQuote?.title,
  )
  const clientName = quotes[0].client.name
  const approvalOptions: PublicApprovalOption[] = comparison
    ? quotes.map((quote) => ({
        id: quote.id,
        title: quote.variationName || quote.title,
        totalLabel: formatCurrency(quote.total),
        paymentLabel: getQuotePaymentSummary(quote),
      }))
    : []

  return (
    <main className="min-h-screen bg-[#F4F3F0] px-3 py-4 sm:px-6 sm:py-8">
      <article className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-[#E5E2DD] bg-white shadow-[0_20px_60px_rgba(18,18,18,0.10)]">
        <div className="h-2 bg-[#FF6B00]" />
        <header className="flex flex-col gap-6 border-b border-[#ECE9E5] px-6 py-7 sm:flex-row sm:items-start sm:justify-between sm:px-10 sm:py-9">
          <div className="flex items-center gap-3">
            <Image
              src="/vertex-symbol.png"
              alt="Vertex Móveis"
              width={56}
              height={40}
              className="h-10 w-auto"
              style={{ width: 'auto' }}
              priority
            />
            <div>
              <p className="text-lg font-extrabold text-[#121212]">Vertex Móveis</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase text-[#777]">Móveis planejados</p>
            </div>
          </div>
          <div className="sm:max-w-md sm:text-right">
            <p className="text-[11px] font-bold uppercase text-[#FF6B00]">
              {comparison ? 'Opções de orçamento' : 'Orçamento em PDF'}
            </p>
            <h1 className="mt-2 text-xl font-extrabold text-[#121212] sm:text-2xl">
              {comparison ? `${quotes.length} opções para o seu projeto` : quotes[0].title}
            </h1>
            <p className="mt-2 text-xs text-[#777]">
              {comparison
                ? `Orçamentos ${quotes.map(quoteDisplayCode).join(' · ')}`
                : `Código ${quoteDisplayCode(quotes[0])}`}
            </p>
          </div>
        </header>

        <section className="px-6 py-7 sm:px-10 sm:py-9">
          <p className="text-[11px] font-bold uppercase text-[#FF6B00]">Preparado para</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[#121212] sm:text-3xl">{clientName}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5E5E5E]">
            {comparison
              ? 'Confira cada orçamento em PDF, compare os valores e as condições, depois escolha a opção desejada para aprovar.'
              : 'Confira abaixo o orçamento simples em PDF. Depois, aprove ou solicite os ajustes necessários.'}
          </p>
        </section>

        {comparison ? (
          <section className="border-y border-[#ECE9E5] bg-[#FAFAF8] px-6 py-6 sm:px-10">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {quotes.map((quote, index) => (
                <div key={quote.id} className="rounded-lg border border-[#E2DED8] bg-white px-4 py-4">
                  <p className="text-[10px] font-bold uppercase text-[#FF6B00]">Opção {index + 1}</p>
                  <h2 className="mt-1 font-bold text-[#121212]">{quote.variationName || quote.title}</h2>
                  <p className="mt-3 text-2xl font-extrabold text-[#121212]">{formatCurrency(quote.total)}</p>
                  <p className="mt-1 text-xs leading-5 text-[#666]">{getQuotePaymentSummary(quote)}</p>
                  {quote.validUntil ? (
                    <p className="mt-2 text-xs text-[#777]">Válido até {formatDateOnly(quote.validUntil)}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {quotes.map((quote, index) => (
          <QuotePdfPreview
            key={quote.id}
            token={token}
            quote={quote}
            optionNumber={index + 1}
            comparison={comparison}
          />
        ))}

        <section className="border-t border-[#ECE9E5] bg-[#FFF8F2] px-6 py-7 sm:px-10">
          <h2 className="text-base font-bold text-[#121212]">
            {comparison ? 'Escolha e responda' : 'Sua resposta'}
          </h2>
          <p className="mt-1 text-sm text-[#666]">
            {comparison
              ? 'Selecione uma das opções. A Vertex Móveis receberá exatamente qual orçamento você aprovou.'
              : 'Ao aprovar, a Vertex Móveis será avisada para confirmar os próximos passos.'}
          </p>
          <div className="mt-4">
            {message ? (
              <div className="rounded-lg border border-[#E8E8E8] bg-white px-4 py-3 text-sm text-[#444]">
                <p>{message}</p>
                {request.approvedAt ? (
                  <a
                    href={`/api/public/quote-approvals/${token}/certificate`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-emerald-200 px-3 font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    Abrir comprovante de aprovação
                  </a>
                ) : null}
              </div>
            ) : (
              <PublicApprovalActions
                token={token}
                clientName={clientName}
                options={approvalOptions}
              />
            )}
          </div>
        </section>

        <footer className="flex flex-col gap-1 border-t border-[#ECE9E5] px-6 py-5 text-xs text-[#777] sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p>Vertex Móveis · Rua Saturno, 6 · Cotia, SP · 06702-170</p>
          <p>{comparison ? 'Orçamentos' : 'Orçamento'} {quotes.map(quoteDisplayCode).join(' · ')}</p>
        </footer>
      </article>
    </main>
  )
}
