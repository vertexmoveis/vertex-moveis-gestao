'use client'

import Image from 'next/image'
import { ArrowDown, CheckCircle2, MessageCircle } from 'lucide-react'
import { trackPublicQuotePdf } from '@/lib/public-quote-engagement'

type PresentationImage = {
  id: string
  src: string
  alt: string
  caption: string
}

export function PublicProposalIntro({
  token,
  companyName,
  clientName,
  quoteTitle,
  heading,
  text,
  highlights,
  images,
  whatsappUrl,
}: {
  token: string
  companyName: string
  clientName: string
  quoteTitle: string
  heading: string
  text: string
  highlights: string[]
  images: PresentationImage[]
  whatsappUrl: string
}) {
  const primaryImage = images[0]
  const supportingImages = images.slice(1)

  return (
    <div className="bg-white">
      <section className={`relative overflow-hidden ${primaryImage ? 'min-h-[440px] bg-[#171717] text-white' : 'min-h-[360px] bg-[#171717] text-white'}`}>
        {primaryImage ? (
          <Image
            src={primaryImage.src}
            alt={primaryImage.alt}
            fill
            priority
            unoptimized
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-black/55" />

        <div className="relative z-10 flex min-h-[inherit] flex-col px-5 py-6 sm:px-10 sm:py-8">
          <header className="flex items-center justify-between gap-4 border-b border-white/25 pb-5">
            <div className="flex items-center gap-3">
              <Image src="/vertex-symbol.png" alt="" width={52} height={38} className="h-9 w-auto" priority />
              <div>
                <p className="font-extrabold">{companyName}</p>
                <p className="text-xs text-white/70">Móveis planejados</p>
              </div>
            </div>
            <p className="max-w-[45%] text-right text-xs font-semibold text-white/75">Proposta para {quoteTitle}</p>
          </header>

          <div className="my-auto max-w-3xl py-10 sm:py-12">
            <p className="text-xs font-bold uppercase text-[#FF9A52]">Preparado especialmente para {clientName}</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">{heading}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/85 sm:text-base sm:leading-7">{text}</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="#orcamento"
                onClick={() => trackPublicQuotePdf(token)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#FF6B00] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#E85F00] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFB780]"
              >
                Ver meu orçamento <ArrowDown size={18} />
              </a>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/60 bg-black/20 px-6 text-sm font-bold text-white transition-colors hover:bg-black/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                >
                  <MessageCircle size={18} /> Falar com a Vertex
                </a>
              ) : null}
            </div>
          </div>

          <ul className="grid gap-2 border-t border-white/25 pt-5 text-xs font-semibold text-white/90 sm:grid-cols-3 sm:text-sm">
            {highlights.map((highlight) => (
              <li key={highlight} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-[#FF8A38]" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {supportingImages.length ? (
        <section aria-label="Trabalhos da Vertex Móveis" className="border-b border-[#ECE9E5] bg-white px-4 py-4 sm:px-8">
          <div className="grid grid-flow-col auto-cols-[78%] gap-3 overflow-x-auto pb-1 sm:grid-flow-row sm:grid-cols-3 sm:auto-cols-auto sm:overflow-visible">
            {supportingImages.map((image) => (
              <figure key={image.id} className="min-w-0">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#ECECEC]">
                  <Image src={image.src} alt={image.alt} fill unoptimized sizes="(max-width: 640px) 50vw, 320px" className="object-cover" />
                </div>
                {image.caption ? <figcaption className="mt-2 truncate text-xs text-[#666]">{image.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
