import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  PublicApprovalActions,
  type PublicApprovalOption,
} from '@/components/quotes/public-approval-actions'
import { PublicProposalIntro } from '@/components/quotes/public-proposal-intro'
import { PublicQuotePdfLink } from '@/components/quotes/public-quote-pdf-link'
import { PublicQuoteViewTracker } from '@/components/quotes/public-quote-view-tracker'
import {
  COMPANY_PROFILE_ID,
  withCompanyProfileDefaults,
} from '@/lib/company-profile'
import {
  buildBeforeAfterPairs,
  selectCompanyPresentationMedia,
} from '@/lib/company-presentation'
import { prisma } from '@/lib/db'
import { isDateOnlyExpired } from '@/lib/date-only'
import {
  getQuotePaymentSummary,
  quoteDisplayCode,
  quoteVariationDisplayName,
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
  const optionLabel = quoteVariationDisplayName(quote)

  return (
    <section id={optionNumber === 1 ? 'orcamento' : undefined} className={`scroll-mt-4 ${optionNumber > 1 ? 'border-t-[12px] border-[#F4F3F0]' : ''}`}>
      <div className="border-b border-[#ECE9E5] bg-white px-4 py-5 sm:px-8">
        <PublicQuotePdfLink
          token={token}
          href={pdfUrl}
          ariaLabel={comparison ? `Abrir orçamento em PDF: ${optionLabel}` : 'Abrir orçamento em PDF'}
          label={comparison ? `Abrir orçamento em PDF - ${optionLabel}` : 'Abrir orçamento em PDF'}
        />
      </div>

      <div className="hidden overflow-hidden bg-[#E8E8E8] sm:block">
        <iframe
          src={`${pdfUrl}#view=FitH`}
          title={`Orçamento ${quoteDisplayCode(quote)} em PDF`}
          className="h-[calc(100vh-4rem)] min-h-[680px] w-full bg-white"
          loading={optionNumber === 1 ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
        />
      </div>
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
  const [request, storedCompanyProfile, presentationImages] = await Promise.all([
    prisma.quoteApprovalRequest.findUnique({
      where: { token },
      include: {
        quote: { include: quoteInclude },
        comparisonQuote: { include: quoteInclude },
        options: {
          orderBy: { position: 'asc' },
          include: { quote: { include: quoteInclude } },
        },
      },
    }),
    prisma.companyProfile.findUnique({ where: { id: COMPANY_PROFILE_ID } }),
    prisma.companyPresentationImage.findMany({
      where: {
        companyId: COMPANY_PROFILE_ID,
        active: true,
        securityStatus: { in: ['TYPE_CHECKED', 'CLEAN'] },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      take: 60,
    }),
  ])

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
    selectedQuote ? quoteVariationDisplayName(selectedQuote) : undefined,
  )
  const clientName = quotes[0].client.name
  const company = withCompanyProfileDefaults(storedCompanyProfile)
  const quoteEnvironments = [...new Set(quotes.flatMap((quote) => quote.items.map((item) => item.environmentName || item.environment)).filter(Boolean))]
  const selectedPresentationImages = selectCompanyPresentationMedia(presentationImages, quoteEnvironments, 'PORTFOLIO', 4)
  const selectedBeforeAfterPairs = buildBeforeAfterPairs(presentationImages, quoteEnvironments, 3)
  const selectedPresentationVideos = selectCompanyPresentationMedia(
    presentationImages,
    quoteEnvironments,
    'VIDEO',
    presentationImages.length,
  )
  const lowestTotal = Math.min(...quotes.map((quote) => quote.total))
  const approvalOptions: PublicApprovalOption[] = comparison
    ? quotes.map((quote, index) => ({
        id: quote.id,
        title: quoteVariationDisplayName(quote),
        totalLabel: formatCurrency(quote.total),
        paymentLabel: getQuotePaymentSummary(quote),
        badge: index === 0 ? 'Opção principal' : quote.total === lowestTotal ? 'Menor investimento' : undefined,
        differenceLabel: quote.total > lowestTotal ? `${formatCurrency(quote.total - lowestTotal)} acima da opção de menor valor` : undefined,
      }))
    : []

  return (
    <main className="min-h-screen bg-[#F4F3F0] sm:px-6 sm:py-8">
      <PublicQuoteViewTracker token={token} />
      <article className="mx-auto max-w-5xl overflow-hidden bg-white sm:rounded-lg sm:border sm:border-[#E5E2DD] sm:shadow-[0_20px_60px_rgba(18,18,18,0.10)]">
        {company.presentationEnabled ? (
          <PublicProposalIntro
            images={selectedPresentationImages.map((image) => ({
              id: image.id,
              src: `/api/public/quote-approvals/${token}/presentation-images/${image.id}`,
              alt: image.caption || `${image.environmentName} produzido pela Vertex Móveis`,
              caption: image.caption || image.environmentName,
            }))}
            beforeAfterPairs={selectedBeforeAfterPairs.map((pair) => ({
              title: pair.title,
              before: {
                id: pair.before.id,
                src: `/api/public/quote-approvals/${token}/presentation-images/${pair.before.id}`,
                alt: pair.before.caption || `Antes de ${pair.title}`,
                caption: pair.before.caption || '',
              },
              after: {
                id: pair.after.id,
                src: `/api/public/quote-approvals/${token}/presentation-images/${pair.after.id}`,
                alt: pair.after.caption || `Depois de ${pair.title}`,
                caption: pair.after.caption || '',
              },
            }))}
            videos={selectedPresentationVideos.map((video) => ({
              id: video.id,
              src: `/api/public/quote-approvals/${token}/presentation-images/${video.id}`,
              alt: video.caption || video.name,
              caption: video.caption || video.environmentName,
            }))}
          />
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
      </article>
    </main>
  )
}
