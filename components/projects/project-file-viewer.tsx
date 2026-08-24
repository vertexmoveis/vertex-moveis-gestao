'use client'

import Image from 'next/image'
import { Download, FileWarning, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isHeicProjectFile } from '@/lib/project-files'

export function ProjectFileViewer({
  name,
  type,
  sourceUrl,
  released,
}: {
  name: string
  type: string
  sourceUrl: string
  released: boolean
}) {
  const [previewFailed, setPreviewFailed] = useState(false)
  const [convertedUrl, setConvertedUrl] = useState('')
  const [conversionError, setConversionError] = useState('')
  const downloadUrl = `${sourceUrl}?download=1`
  const isHeic = isHeicProjectFile(type, name)

  useEffect(() => {
    if (!released || !isHeic) return

    const controller = new AbortController()
    let objectUrl = ''

    async function prepareHeicPreview() {
      setConversionError('')
      try {
        const response = await fetch(sourceUrl, { signal: controller.signal })
        if (!response.ok) throw new Error('Não foi possível carregar o arquivo.')

        const original = await response.blob()
        const { heicTo } = await import('heic-to/csp')
        const jpeg = await heicTo({ blob: original, type: 'image/jpeg', quality: 0.88 })
        if (controller.signal.aborted) return

        objectUrl = URL.createObjectURL(jpeg)
        setConvertedUrl(objectUrl)
      } catch (error) {
        if (controller.signal.aborted) return
        setConversionError(error instanceof Error ? error.message : 'Não foi possível converter esta foto.')
      }
    }

    void prepareHeicPreview()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [isHeic, released, sourceUrl])

  if (!released) {
    return (
      <ViewerMessage
        title="Arquivo aguardando verificação"
        description="Assim que a verificação de segurança terminar, a visualização será liberada."
      />
    )
  }

  if (type === 'application/pdf') {
    return (
      <iframe
        src={sourceUrl}
        title={`Visualização de ${name}`}
        className="h-[calc(100dvh-270px)] min-h-[520px] w-full bg-[#F2F2F2]"
      />
    )
  }

  if (isHeic) {
    if (conversionError) {
      return (
        <ViewerMessage
          title="Não foi possível preparar a foto"
          description={`${conversionError} O arquivo original continua disponível para download.`}
          downloadUrl={downloadUrl}
        />
      )
    }

    if (!convertedUrl) {
      return (
        <ViewerMessage
          title="Preparando a foto"
          description="Convertendo o arquivo HEIC para exibição no navegador…"
          loading
        />
      )
    }

    return (
      <div className="relative h-[calc(100dvh-270px)] min-h-[520px] w-full bg-[#F2F2F2]">
        <Image
          src={convertedUrl}
          alt={name}
          fill
          sizes="100vw"
          unoptimized
          priority
          className="object-contain p-4"
          onError={() => setConversionError('A prévia convertida não pôde ser exibida.')}
        />
      </div>
    )
  }

  if (type.startsWith('image/') && !previewFailed) {
    return (
      <div className="relative h-[calc(100dvh-270px)] min-h-[520px] w-full bg-[#F2F2F2]">
        <Image
          src={sourceUrl}
          alt={name}
          fill
          sizes="100vw"
          unoptimized
          priority
          className="object-contain p-4"
          onError={() => setPreviewFailed(true)}
        />
      </div>
    )
  }

  return (
    <ViewerMessage
      title="A prévia não está disponível neste navegador"
      description="O arquivo está preservado e pode ser aberto no aplicativo de fotos do computador."
      downloadUrl={downloadUrl}
    />
  )
}

function ViewerMessage({
  title,
  description,
  downloadUrl,
  loading = false,
}: {
  title: string
  description: string
  downloadUrl?: string
  loading?: boolean
}) {
  return (
    <div className="flex h-[calc(100dvh-270px)] min-h-[520px] flex-col items-center justify-center bg-[#F7F7F7] px-6 text-center">
      {loading
        ? <Loader2 size={40} className="mb-4 animate-spin text-[#FF6B00]" />
        : <FileWarning size={40} className="mb-4 text-[#FF6B00]" />}
      <h2 className="text-lg font-semibold text-[#121212]">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-[#6B6B6B]">{description}</p>
      {downloadUrl ? (
        <a
          href={downloadUrl}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#FF6B00] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#E05A00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2"
        >
          <Download size={16} /> Baixar arquivo
        </a>
      ) : null}
    </div>
  )
}
