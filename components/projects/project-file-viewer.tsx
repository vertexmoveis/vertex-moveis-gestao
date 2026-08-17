'use client'

import Image from 'next/image'
import { Download, FileWarning } from 'lucide-react'
import { useState } from 'react'

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
  const downloadUrl = `${sourceUrl}?download=1`

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
}: {
  title: string
  description: string
  downloadUrl?: string
}) {
  return (
    <div className="flex h-[calc(100dvh-270px)] min-h-[520px] flex-col items-center justify-center bg-[#F7F7F7] px-6 text-center">
      <FileWarning size={40} className="mb-4 text-[#FF6B00]" />
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
