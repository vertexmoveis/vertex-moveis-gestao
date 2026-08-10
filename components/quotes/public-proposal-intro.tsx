'use client'

import Image from 'next/image'
import { Play } from 'lucide-react'

type PresentationImage = {
  id: string
  src: string
  alt: string
  caption: string
}

type BeforeAfterPair = {
  title: string
  before: PresentationImage
  after: PresentationImage
}

export function PublicProposalIntro({
  images,
  beforeAfterPairs,
  videos,
}: {
  images: PresentationImage[]
  beforeAfterPairs: BeforeAfterPair[]
  videos: PresentationImage[]
}) {
  return (
    <div className="bg-white">
      {(images.length || beforeAfterPairs.length || videos.length) ? (
        <header className="border-b border-[#ECE9E5] px-5 py-6 sm:px-10 sm:py-8">
          <p className="text-xs font-bold uppercase text-[#FF6B00]">Vertex Móveis</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#121212] sm:text-3xl">Conheça nosso trabalho</h1>
        </header>
      ) : null}

      {images.length ? (
        <section aria-label="Trabalhos da Vertex Móveis" className="border-b border-[#ECE9E5] bg-white px-4 py-4 sm:px-8">
          <div className="grid grid-flow-col auto-cols-[78%] gap-3 overflow-x-auto pb-1 sm:grid-flow-row sm:grid-cols-3 sm:auto-cols-auto sm:overflow-visible">
            {images.map((image) => (
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

      {beforeAfterPairs.length ? (
        <section className="border-b border-[#ECE9E5] bg-[#FAFAF9] px-5 py-8 sm:px-10 sm:py-10">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#FF6B00]">Transformações reais</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#121212] sm:text-2xl">Antes e depois</h2>
          </div>
          <div className="space-y-6">
            {beforeAfterPairs.map((pair) => (
              <article key={pair.title}>
                <h3 className="mb-3 text-sm font-bold text-[#333]">{pair.title}</h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  {([['Antes', pair.before], ['Depois', pair.after]] as const).map(([label, image]) => (
                    <figure key={`${pair.title}-${label}`} className="min-w-0">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#EAEAEA]">
                        <Image src={image.src} alt={image.alt} fill unoptimized sizes="(max-width: 640px) 50vw, 430px" className="object-cover" />
                        <span className={`absolute left-2 top-2 rounded-md px-2.5 py-1 text-[11px] font-bold ${label === 'Depois' ? 'bg-[#FF6B00] text-white' : 'bg-black/75 text-white'}`}>
                          {label}
                        </span>
                      </div>
                      {image.caption ? <figcaption className="mt-2 text-xs text-[#666]">{image.caption}</figcaption> : null}
                    </figure>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {videos.length ? (
        <section className="border-b border-[#ECE9E5] bg-white px-5 py-8 sm:px-10 sm:py-10">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF0E5] text-[#FF6B00]"><Play size={18} fill="currentColor" /></span>
            <div>
              <h2 className="text-xl font-extrabold text-[#121212] sm:text-2xl">Vídeos da Vertex</h2>
            </div>
          </div>
          <div className={`grid gap-4 ${videos.length > 1 ? 'md:grid-cols-2' : ''}`}>
            {videos.map((video) => (
              <figure key={video.id} className="min-w-0">
                <video
                  src={video.src}
                  controls
                  playsInline
                  preload="none"
                  className="aspect-video w-full rounded-lg bg-black object-contain"
                >
                  Seu navegador não consegue reproduzir este vídeo.
                </video>
                {video.caption ? <figcaption className="mt-2 text-sm font-semibold text-[#333]">{video.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
