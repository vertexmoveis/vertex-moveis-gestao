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
        <section className="bg-white p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="mt-0.5 text-[#FF6B00]" />
            <div>
              <h2 className="text-base font-extrabold">Assistência e garantia</h2>
              <p className="mt-1 text-xs text-[#777]">{warrantyLabel || 'Acompanhe seus pedidos de assistência.'}</p>
            </div>
          </div>

          {tickets.length > 0 ? (
            <div className="mt-5 divide-y divide-[#ECECEC] border border-[#E8E8E8]">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{ticket.title}</p>
                    <span className="text-xs font-semibold text-[#B84A00]">{WARRANTY_STATUS_LABELS[ticket.status] || ticket.status}</span>
                  </div>
                  {ticket.resolution ? <p className="mt-2 text-xs leading-5 text-[#666]">Solução: {ticket.resolution}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          {canOpenWarranty ? (
            <div className="mt-5 border-t border-[#ECECEC] pt-5">
              <h3 className="flex items-center gap-2 text-sm font-extrabold"><Wrench size={16} /> Abrir novo pedido</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-[240px_minmax(0,1fr)]">
                <Select
                  label="Assunto"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as PublicWarrantyCategory)}
                  options={PUBLIC_WARRANTY_CATEGORIES.map((value) => ({ value, label: PUBLIC_WARRANTY_CATEGORY_LABELS[value] }))}
                />
                <Textarea label="Descreva o que aconteceu" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>
              <div className="mt-3 border border-dashed border-[#D9D9D9] p-3">
                <button type="button" onClick={() => photoInputRef.current?.click()} className="inline-flex items-center gap-2 text-sm font-semibold text-[#555]">
                  <Camera size={16} /> Adicionar fotos ({photos.length}/3)
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => setPhotos(Array.from(event.target.files || []).filter((file) => file.size <= 8 * 1024 * 1024).slice(0, 3))}
                />
                <p className="mt-1 text-xs text-[#888]">Até 3 fotos, com no máximo 8 MB cada.</p>
              </div>
              <Button type="button" className="mt-3 w-full sm:w-auto" onClick={() => void sendWarranty()} disabled={busy === 'warranty' || description.trim().length < 10}>
                {busy === 'warranty' ? <Loader2 size={15} className="animate-spin" /> : <Wrench size={15} />} Enviar pedido de assistência
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {canRate ? (
        <section className="bg-white p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <Star size={20} className="mt-0.5 text-[#FF6B00]" />
            <div><h2 className="text-base font-extrabold">Como foi sua experiência?</h2><p className="mt-1 text-xs text-[#777]">Sua resposta ajuda a Vertex a melhorar.</p></div>
          </div>
          <div className="mt-5 flex gap-2" role="radiogroup" aria-label="Nota do atendimento">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" aria-label={`Nota ${value}`} onClick={() => setRating(value)} className={`grid h-11 w-11 place-items-center border ${value <= rating ? 'border-[#FF6B00] bg-[#FFF3E9] text-[#FF6B00]' : 'border-[#D9D9D9] text-[#AAA]'}`}>
                <Star size={20} fill={value <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <Textarea label="Comentário (opcional)" rows={3} value={ratingComment} onChange={(event) => setRatingComment(event.target.value)} className="mt-4" />
          <Button type="button" className="mt-3" disabled={rating < 1 || busy === 'rating'} onClick={() => void sendRating()}>
            {busy === 'rating' ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />} Enviar avaliação
          </Button>
        </section>
      ) : null}

      {message ? <p className="border border-[#FFD7BA] bg-[#FFF7F1] px-4 py-3 text-sm font-semibold text-[#9A3E00]">{message}</p> : null}
    </div>
  )
}
