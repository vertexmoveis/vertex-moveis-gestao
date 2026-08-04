'use client'

import { upload } from '@vercel/blob/client'
import Image from 'next/image'
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { QUOTE_IMAGE_ACCEPT, QUOTE_IMAGE_MAX_SIZE, sanitizeQuoteImageName } from '@/lib/quote-images'
import type { QuoteData } from '@/types/quotes'

type QuoteImage = NonNullable<QuoteData['environmentImages']>[number]

export function QuoteEnvironmentImages({
  quoteId,
  groupId,
  environments,
  images,
  disabled,
  onChange,
}: {
  quoteId: string
  groupId: string
  environments: string[]
  images: QuoteImage[]
  disabled?: boolean
  onChange: (images: QuoteImage[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const options = useMemo(() => [...new Set(environments.filter(Boolean))], [environments])
  const [environmentName, setEnvironmentName] = useState(options[0] || 'Ambiente')
  const [caption, setCaption] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > QUOTE_IMAGE_MAX_SIZE) {
      setError('A imagem ultrapassa o limite de 8 MB.')
      return
    }
    setError('')
    setProgress(0)
    try {
      const blob = await upload(`quotes/${groupId}/${sanitizeQuoteImageName(file.name)}`, file, {
        access: 'private',
        contentType: file.type,
        handleUploadUrl: `/api/quotes/${quoteId}/images/upload`,
        clientPayload: JSON.stringify({ quoteId, environmentName, name: file.name, caption }),
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      })
      const response = await fetch(`/api/quotes/${quoteId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentName, name: file.name, caption, type: blob.contentType || file.type, url: blob.url, size: file.size }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.id) throw new Error(data?.error || 'Não foi possível registrar a imagem.')
      onChange([data as QuoteImage, ...images.filter((image) => image.id !== data.id)])
      setCaption('')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível enviar a imagem.')
    } finally {
      setProgress(null)
    }
  }

  const remove = async (image: QuoteImage) => {
    if (!window.confirm(`Remover a imagem "${image.name}"?`)) return
    setDeletingId(image.id)
    setError('')
    const response = await fetch(`/api/quotes/${quoteId}/images/${image.id}`, { method: 'DELETE' })
    const data = await response.json().catch(() => null)
    setDeletingId(null)
    if (!response.ok) {
      setError(data?.error || 'Não foi possível remover a imagem.')
      return
    }
    onChange(images.filter((item) => item.id !== image.id))
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#E8E8E8] bg-white shadow-sm">
      <div className="border-b border-[#F0F0F0] px-5 py-4">
        <div className="flex items-center gap-2">
          <ImagePlus size={17} className="text-[#FF6B00]" />
          <div>
            <h2 className="font-semibold text-[#121212]">Imagens dos ambientes</h2>
            <p className="text-xs text-[#777]">Fotos e projetos visuais incluídos no orçamento do cliente</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-5">
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
        {!disabled ? (
          <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
            <Select label="Ambiente" value={environmentName} onChange={(event) => setEnvironmentName(event.target.value)} options={options.map((value) => ({ value, label: value }))} />
            <Input label="Legenda (opcional)" value={caption} maxLength={240} onChange={(event) => setCaption(event.target.value)} placeholder="Ex.: Vista da parede principal" />
            <Button type="button" onClick={() => inputRef.current?.click()} loading={progress !== null}>
              <Upload size={15} /> {progress === null ? 'Adicionar imagem' : `${progress}%`}
            </Button>
            <input ref={inputRef} type="file" accept={QUOTE_IMAGE_ACCEPT} className="sr-only" onChange={(event) => void handleUpload(event)} />
          </div>
        ) : null}

        {images.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {images.map((image) => (
              <article key={image.id} className="overflow-hidden rounded-lg border border-[#E8E8E8]">
                {['TYPE_CHECKED', 'CLEAN'].includes(image.securityStatus) ? (
                  <a href={`/api/quotes/${quoteId}/images/${image.id}`} target="_blank" rel="noreferrer" className="relative block aspect-[16/10] bg-[#F4F4F4]">
                    <Image src={`/api/quotes/${quoteId}/images/${image.id}`} alt={image.caption || image.name} fill unoptimized className="object-cover" />
                  </a>
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center bg-amber-50 text-xs text-amber-800">Verificação pendente</div>
                )}
                <div className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-[#FF6B00]">{image.environmentName}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#121212]">{image.caption || image.name}</p>
                  </div>
                  {!disabled ? <button type="button" title="Remover imagem" onClick={() => void remove(image)} disabled={deletingId === image.id} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50">{deletingId === image.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}</button> : null}
                </div>
              </article>
            ))}
          </div>
        ) : <p className="py-5 text-center text-sm text-[#888]">Nenhuma imagem adicionada ao orçamento.</p>}
      </div>
    </section>
  )
}
