'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'

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
  const [activeVideoIndex, setActiveVideoIndex] = useState(0)
  const activeVideo = videos[activeVideoIndex]
  const hasMultipleVideos = videos.length > 1

  function showPreviousVideo() {
    setActiveVideoIndex((current) => (current - 1 + videos.length) % videos.length)
  }

  function showNextVideo() {
    setActiveVideoIndex((current) => (current + 1) % videos.length)
  }

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
          <div className="mx-auto grid max-w-4xl grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2 sm:grid-cols-[48px_minmax(0,1fr)_48px] sm:gap-4">
            <button
              type="button"
              onClick={showPreviousVideo}
              disabled={!hasMultipleVideos}
              aria-label="Ver vídeo anterior"
              title="Vídeo anterior"
              className={`flex h-10 w-10 items-center justify-center rounded-full border border-[#D8D8D8] bg-white text-[#222] shadow-sm transition-colors hover:border-[#FF6B00] hover:text-[#FF6B00] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD5B8] sm:h-12 sm:w-12 ${hasMultipleVideos ? '' : 'invisible'}`}
            >
              <ChevronLeft size={24} />
            </button>

            {activeVideo ? (
              <figure key={activeVideo.id} className="min-w-0">
                <video
                  src={activeVideo.src}
                  controls
                  playsInline
                  preload="none"
                  className="aspect-video w-full rounded-lg bg-black object-contain shadow-sm"
                >
                  Seu navegador não consegue reproduzir este vídeo.
                </video>
                <figcaption className="mt-3 flex items-start justify-between gap-4 text-sm">
                  <span className="font-semibold text-[#333]">{activeVideo.caption || 'Trabalho realizado pela Vertex'}</span>
                  <span className="shrink-0 text-xs font-medium text-[#777]">{activeVideoIndex + 1} de {videos.length}</span>
                </figcaption>
              </figure>
            ) : null}

            <button
              type="button"
              onClick={showNextVideo}
              disabled={!hasMultipleVideos}
              aria-label="Ver próximo vídeo"
              title="Próximo vídeo"
              className={`flex h-10 w-10 items-center justify-center rounded-full border border-[#D8D8D8] bg-white text-[#222] shadow-sm transition-colors hover:border-[#FF6B00] hover:text-[#FF6B00] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD5B8] sm:h-12 sm:w-12 ${hasMultipleVideos ? '' : 'invisible'}`}
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {hasMultipleVideos ? (
            <div className="mt-4 flex justify-center gap-2" aria-label="Selecionar vídeo">
              {videos.map((video, index) => (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => setActiveVideoIndex(index)}
                  aria-label={`Ver vídeo ${index + 1}`}
                  aria-current={index === activeVideoIndex ? 'true' : undefined}
                  className={`h-2.5 rounded-full transition-[width,background-color] ${index === activeVideoIndex ? 'w-7 bg-[#FF6B00]' : 'w-2.5 bg-[#D6D6D6] hover:bg-[#999]'}`}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
