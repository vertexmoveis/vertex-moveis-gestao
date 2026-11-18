'use client'

import { upload } from '@vercel/blob/client'
import { useRef, useState } from 'react'
import { Camera, Loader2, ShieldCheck, Star, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, Textarea } from '@/components/ui/input'
import {
  PUBLIC_WARRANTY_CATEGORIES,
  PUBLIC_WARRANTY_CATEGORY_LABELS,
  type PublicWarrantyCategory,
} from '@/lib/project-portal-support'
import { WARRANTY_STATUS_LABELS, type WarrantyStatus } from '@/lib/warranty'
import { sanitizeProjectFileName } from '@/lib/project-files'

type PublicTicket = {
  id: string
  title: string
  status: WarrantyStatus
  openedAt: string
  resolution: string | null
}

export function PublicProjectSupport({
  token,
  canOpenWarranty,
  warrantyLabel,
  tickets,
  canRate,
  satisfactionRating,
}: {
  token: string
  canOpenWarranty: boolean
  warrantyLabel: string | null
  tickets: PublicTicket[]
  canRate: boolean
  satisfactionRating: number | null
}) {
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<PublicWarrantyCategory>('DOOR_DRAWER')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [rating, setRating] = useState(satisfactionRating || 0)
  const [ratingComment, setRatingComment] = useState('')

  const sendWarranty = async () => {
    setBusy('warranty')
    setMessage('')
    const response = await fetch(`/api/public/project-portals/${token}/warranty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, description }),
    })
    const payload = await response.json().catch(() => ({}))
    if (response.ok && payload.ticketId && photos.length > 0) {
      for (const photo of photos) {
        const blob = await upload(
          `projects/${payload.projectId}/warranty/${payload.ticketId}/${sanitizeProjectFileName(photo.name)}`,
          photo,
          {
            access: 'private',
            contentType: photo.type,
            handleUploadUrl: `/api/public/project-portals/${token}/warranty/files/upload`,
            clientPayload: JSON.stringify({ ticketId: payload.ticketId, name: photo.name }),
          },
        )
        const fileResponse = await fetch(`/api/public/project-portals/${token}/warranty/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId: payload.ticketId, name: photo.name, type: blob.contentType || photo.type, url: blob.url, size: photo.size }),
        })
        if (!fileResponse.ok) {
          const filePayload = await fileResponse.json().catch(() => ({}))
          setMessage(`O pedido foi recebido, mas uma foto não foi anexada: ${filePayload.error || 'tente novamente.'}`)
          setBusy('')
          return
        }
      }
    }
    setBusy('')
    setMessage(payload.message || payload.error || 'Não foi possível enviar o pedido.')
    if (response.ok) {
      setDescription('')
      setPhotos([])
      window.setTimeout(() => window.location.reload(), 900)
    }
  }

  const sendRating = async () => {
    setBusy('rating')
    setMessage('')
    const response = await fetch(`/api/public/project-portals/${token}/satisfaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment: ratingComment || undefined }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusy('')
    setMessage(payload.message || payload.error || 'Não foi possível enviar a avaliação.')
    if (response.ok) window.setTimeout(() => window.location.reload(), 900)
  }

  return (
    <div className="space-y-5">
      {(canOpenWarranty || tickets.length > 0) ? (
        <section className="rounded-3xl border border-[#E8E5E0] bg-white p-5 shadow-[0_4px_24px_rgba(25,27,24,0.025)] sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFF1E6] text-[#B84A00]"><ShieldCheck size={21} aria-hidden="true" /></span>
            <div className="min-w-0 pt-0.5">
              <h2 className="text-lg font-bold tracking-tight text-[#191B18]">Assistência e garantia</h2>
              <p className="mt-1 text-sm leading-6 text-[#6C7067]">{warrantyLabel || 'Acompanhe seus pedidos de assistência.'}</p>
            </div>
          </div>

          {tickets.length > 0 ? (
            <div className="mt-6 space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-2xl border border-[#E8E5E0] bg-[#FAF9F6] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 break-words text-sm font-semibold leading-6 text-[#191B18]">{ticket.title}</p>
                    <span className="max-w-full rounded-full bg-[#FFF1E6] px-3 py-1 text-xs font-semibold leading-5 text-[#9A3E00]">{WARRANTY_STATUS_LABELS[ticket.status] || ticket.status}</span>
                  </div>
                  {ticket.resolution ? <p className="mt-3 break-words border-t border-[#E8E5E0] pt-3 text-sm leading-6 text-[#6C7067]">Solução: {ticket.resolution}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          {canOpenWarranty ? (
            <div className="mt-6 rounded-2xl bg-[#FAF9F6] p-4 sm:p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-[#191B18]"><Wrench size={17} aria-hidden="true" /> Abrir novo pedido</h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                <Select
                  label="Assunto"
                  value={category}
                  className="min-h-12 rounded-xl border-[#E2DED7] text-base focus:ring-[#C75200] sm:text-sm"
                  onChange={(event) => setCategory(event.target.value as PublicWarrantyCategory)}
                  options={PUBLIC_WARRANTY_CATEGORIES.map((value) => ({ value, label: PUBLIC_WARRANTY_CATEGORY_LABELS[value] }))}
                />
                <Textarea label="Descreva o que aconteceu" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className="rounded-xl border-[#E2DED7] text-base focus:ring-[#C75200] sm:text-sm" />
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-[#D5CFC5] bg-white px-4 py-3">
                <button type="button" onClick={() => photoInputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-[#484D43] outline-none transition-colors hover:text-[#B84A00] focus-visible:ring-2 focus-visible:ring-[#C75200] focus-visible:ring-offset-2">
                  <Camera size={18} aria-hidden="true" /> Adicionar fotos ({photos.length}/3)
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => setPhotos(Array.from(event.target.files || []).filter((file) => file.size <= 8 * 1024 * 1024).slice(0, 3))}
                />
                <p className="text-xs leading-5 text-[#6C7067]">Até 3 fotos, com no máximo 8 MB cada.</p>
              </div>
              <Button type="button" className="mt-4 h-auto min-h-12 w-full whitespace-normal rounded-xl px-5 py-3 text-center font-semibold text-[#1C211B] hover:bg-[#F57821] active:bg-[#EE6A0C] focus-visible:ring-[#C75200] sm:w-auto" onClick={() => void sendWarranty()} disabled={busy === 'warranty' || description.trim().length < 10}>
                {busy === 'warranty' ? <Loader2 size={17} className="shrink-0 animate-spin" aria-hidden="true" /> : <Wrench size={17} className="shrink-0" aria-hidden="true" />} Enviar pedido de assistência
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {canRate ? (
        <section className="rounded-3xl border border-[#E8E5E0] bg-white p-5 shadow-[0_4px_24px_rgba(25,27,24,0.025)] sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFF1E6] text-[#B84A00]"><Star size={21} aria-hidden="true" /></span>
            <div className="min-w-0 pt-0.5"><h2 className="text-lg font-bold tracking-tight text-[#191B18]">Como foi sua experiência?</h2><p className="mt-1 text-sm leading-6 text-[#6C7067]">Sua resposta ajuda a Vertex a melhorar.</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-1 sm:gap-2" role="radiogroup" aria-label="Nota do atendimento">
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value} className={`grid h-11 w-11 cursor-pointer place-items-center rounded-xl border transition-colors focus-within:ring-2 focus-within:ring-[#C75200] focus-within:ring-offset-2 ${value <= rating ? 'border-[#FF6B00] bg-[#FFF1E6] text-[#C75200]' : 'border-[#E2DED7] text-[#858A7F] hover:border-[#FF6B00]'}`}>
                <input type="radio" name="public-satisfaction-rating" value={value} checked={rating === value} aria-label={`Nota ${value}`} onChange={() => setRating(value)} className="sr-only" />
                <Star size={21} fill={value <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
              </label>
            ))}
          </div>
          <div className="mt-5"><Textarea label="Comentário (opcional)" rows={3} value={ratingComment} onChange={(event) => setRatingComment(event.target.value)} className="rounded-xl border-[#E2DED7] text-base focus:ring-[#C75200] sm:text-sm" /></div>
          <Button type="button" className="mt-4 h-auto min-h-12 w-full rounded-xl px-5 py-3 font-semibold text-[#1C211B] hover:bg-[#F57821] active:bg-[#EE6A0C] focus-visible:ring-[#C75200] sm:w-auto" disabled={rating < 1 || busy === 'rating'} onClick={() => void sendRating()}>
            {busy === 'rating' ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Star size={17} aria-hidden="true" />} Enviar avaliação
          </Button>
        </section>
      ) : null}

      {message ? <p role="status" aria-live="polite" className="rounded-2xl border border-[#FFD7BA] bg-[#FFF7F1] px-5 py-4 text-sm font-medium leading-6 text-[#9A3E00]">{message}</p> : null}
    </div>
  )
}
