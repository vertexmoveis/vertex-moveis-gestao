'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'

type PresentationVideo = {
  id: string
  src: string
  caption: string
}

export function PublicProposalIntro({ videos }: { videos: PresentationVideo[] }) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0)
  const activeVideo = videos[activeVideoIndex]
  const hasMultipleVideos = videos.length > 1

  if (!activeVideo) return null

  function showPreviousVideo() {
    setActiveVideoIndex((current) => (current - 1 + videos.length) % videos.length)
  }

  function showNextVideo() {
    setActiveVideoIndex((current) => (current + 1) % videos.length)
  }

  return (
    <section className="border-b border-[#ECE9E5] bg-white">
      <header className="border-b border-[#ECE9E5] px-5 py-6 sm:px-10 sm:py-8">
        <p className="text-xs font-bold uppercase text-[#FF6B00]">Vertex Móveis</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#121212] sm:text-3xl">Conheça nosso trabalho</h1>
        <p className="mt-2 text-sm text-[#666]">Veja alguns móveis planejados produzidos pela nossa equipe.</p>
      </header>

      <div className="px-5 py-8 sm:px-10 sm:py-10">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF0E5] text-[#FF6B00]">
            <Play size={18} fill="currentColor" />
          </span>
          <h2 className="text-xl font-extrabold text-[#121212] sm:text-2xl">Vídeos da Vertex</h2>
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

          <figure key={activeVideo.id} className="min-w-0">
            <video
              src={activeVideo.src}
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={(event) => {
                const video = event.currentTarget
                if (video.duration > 0 && video.currentTime === 0) video.currentTime = Math.min(0.5, video.duration / 10)
              }}
              className="aspect-video w-full rounded-lg bg-black object-contain shadow-sm"
            >
              Seu navegador não consegue reproduzir este vídeo.
            </video>
            <figcaption className="mt-3 flex items-start justify-between gap-4 text-sm">
              <span className="font-semibold text-[#333]">{activeVideo.caption || 'Trabalho realizado pela Vertex'}</span>
              <span className="shrink-0 text-xs font-medium text-[#777]">{activeVideoIndex + 1} de {videos.length}</span>
            </figcaption>
          </figure>

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
      </div>
    </section>
  )
}
