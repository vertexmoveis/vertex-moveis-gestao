'use client'

import { upload } from '@vercel/blob/client'
import { ArrowDown, ArrowUp, Film, ImageIcon, Loader2, Save, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import {
  COMPANY_PRESENTATION_ENVIRONMENTS,
  type CompanyPresentationImageData,
} from '@/lib/company-presentation'
import {
  COMPANY_PRESENTATION_MEDIA_PREFIX,
  COMPANY_PRESENTATION_POSTER_PREFIX,
  COMPANY_PRESENTATION_VIDEO_ACCEPT,
  COMPANY_PRESENTATION_VIDEO_MAX_SIZE,
  presentationVideoContentType,
} from '@/lib/company-presentation-images'
import type { CompanyProfileData } from '@/lib/company-profile'
import { sanitizeQuoteImageName } from '@/lib/quote-images'

type PresentationProfile = Pick<CompanyProfileData, 'presentationEnabled'>

function captureVideoPoster(source: File | string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const objectUrl = typeof source === 'string' ? source : URL.createObjectURL(source)
    const shouldRevokeUrl = typeof source !== 'string'
    const video = document.createElement('video')
    let finished = false
    const finish = (value: Blob | null) => {
      if (finished) return
      finished = true
      if (shouldRevokeUrl) URL.revokeObjectURL(objectUrl)
      video.removeAttribute('src')
      resolve(value)
    }
    const timeout = window.setTimeout(() => finish(null), 15_000)
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, Math.max(0, video.duration * 0.08))
    }
    video.onseeked = () => {
      window.clearTimeout(timeout)
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, 1))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.84)
    }
    video.onerror = () => {
      window.clearTimeout(timeout)
      finish(null)
    }
    video.src = objectUrl
  })
}

export function CompanyPresentationSettings({
  initialProfile,
  initialImages,
}: {
  initialProfile: PresentationProfile
  initialImages: CompanyPresentationImageData[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [presentationEnabled, setPresentationEnabled] = useState(initialProfile.presentationEnabled)
  const [videos, setVideos] = useState(() => initialImages.filter((item) => item.mediaKind === 'VIDEO'))
  const [environmentName, setEnvironmentName] = useState<string>('Todos os ambientes')
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [posterGeneratingId, setPosterGeneratingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [videoError, setVideoError] = useState('')

  const save = async () => {
    setSaving(true)
    setFeedback('')
    try {
      const response = await fetch('/api/settings/company/presentation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentationEnabled }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Não foi possível salvar a apresentação.')
      setPresentationEnabled(Boolean(data?.presentationEnabled))
      setFeedback('Apresentação atualizada para os próximos acessos.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar a apresentação.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > COMPANY_PRESENTATION_VIDEO_MAX_SIZE) {
      setVideoError(`O vídeo ultrapassa o limite de ${COMPANY_PRESENTATION_VIDEO_MAX_SIZE / 1024 / 1024} MB.`)
      return
    }

    setVideoError('')
    setProgress(0)
    try {
      const posterPromise = captureVideoPoster(file)
      const contentType = presentationVideoContentType(file.name, file.type)
      const blob = await upload(`${COMPANY_PRESENTATION_MEDIA_PREFIX}${sanitizeQuoteImageName(file.name)}`, file, {
        access: 'private',
        contentType,
        handleUploadUrl: '/api/settings/company/presentation/images/upload',
        clientPayload: JSON.stringify({ environmentName, name: file.name, caption }),
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      })
      const response = await fetch('/api/settings/company/presentation/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environmentName,
          name: file.name,
          caption,
          type: blob.contentType || contentType,
          url: blob.url,
          size: file.size,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.id) throw new Error(data?.error || 'Não foi possível registrar o vídeo.')
      let savedVideo = data as CompanyPresentationImageData
      const poster = await posterPromise
      if (poster) {
        try {
          const posterUpload = await upload(`${COMPANY_PRESENTATION_POSTER_PREFIX}${sanitizeQuoteImageName(file.name)}.jpg`, poster, {
            access: 'private',
            contentType: 'image/jpeg',
            handleUploadUrl: '/api/settings/company/presentation/images/upload',
            clientPayload: JSON.stringify({ assetKind: 'POSTER', environmentName, name: `${file.name}.jpg`, caption }),
          })
          const posterResponse = await fetch(`/api/settings/company/presentation/images/${data.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asset: 'poster', url: posterUpload.url, type: 'image/jpeg', size: poster.size }),
          })
          if (posterResponse.ok) {
            savedVideo = { ...savedVideo, hasPoster: true, posterType: 'image/jpeg', posterSize: poster.size }
          }
        } catch {
          setVideoError('O vídeo 4K foi salvo, mas não foi possível criar a capa automática.')
        }
      }
      setVideos((current) => [...current.filter((video) => video.id !== data.id), savedVideo]
        .sort((left, right) => left.position - right.position || left.createdAt.localeCompare(right.createdAt)))
      setCaption('')
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : 'Não foi possível enviar o vídeo.')
    } finally {
      setProgress(null)
    }
  }

  const remove = async (video: CompanyPresentationImageData) => {
    if (!window.confirm(`Remover "${video.caption || video.name}" da apresentação?`)) return
    setDeletingId(video.id)
    setVideoError('')
    const response = await fetch(`/api/settings/company/presentation/images/${video.id}`, { method: 'DELETE' })
    const data = await response.json().catch(() => null)
    setDeletingId(null)
    if (!response.ok) {
      setVideoError(data?.error || 'Não foi possível remover o vídeo.')
      return
    }
    setVideos((current) => current.filter((item) => item.id !== video.id))
  }

  const move = async (video: CompanyPresentationImageData, direction: 'up' | 'down') => {
    const currentIndex = videos.findIndex((item) => item.id === video.id)
    const targetIndex = currentIndex + (direction === 'up' ? -1 : 1)
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= videos.length) return

    setMovingId(video.id)
    setVideoError('')
    const previous = videos
    const optimistic = [...videos]
    ;[optimistic[currentIndex], optimistic[targetIndex]] = [optimistic[targetIndex], optimistic[currentIndex]]
    setVideos(optimistic)

    const response = await fetch(`/api/settings/company/presentation/images/${video.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    })
    const data = await response.json().catch(() => null)
    setMovingId(null)
    if (!response.ok) {
      setVideos(previous)
      setVideoError(data?.error || 'Não foi possível alterar a ordem dos vídeos.')
      return
    }
    if (Array.isArray(data?.orderedIds)) {
      const rank = new Map<string, number>(data.orderedIds.map((id: string, index: number) => [id, index]))
      setVideos((current) => current.map((item) => rank.has(item.id) ? { ...item, position: rank.get(item.id)! } : item)
        .sort((left, right) => left.position - right.position || left.createdAt.localeCompare(right.createdAt)))
    }
  }

  const generatePoster = async (video: CompanyPresentationImageData) => {
    setPosterGeneratingId(video.id)
    setVideoError('')
    try {
      const poster = await captureVideoPoster(`/api/settings/company/presentation/images/${video.id}`)
      if (!poster) throw new Error('Não foi possível capturar uma imagem deste vídeo.')
      const posterUpload = await upload(
        `${COMPANY_PRESENTATION_POSTER_PREFIX}${sanitizeQuoteImageName(video.name)}.jpg`,
        poster,
        {
          access: 'private',
          contentType: 'image/jpeg',
          handleUploadUrl: '/api/settings/company/presentation/images/upload',
          clientPayload: JSON.stringify({
            assetKind: 'POSTER',
            environmentName: video.environmentName,
            name: `${video.name}.jpg`,
            caption: video.caption,
          }),
        },
      )
      const response = await fetch(`/api/settings/company/presentation/images/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset: 'poster', url: posterUpload.url, type: 'image/jpeg', size: poster.size }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Não foi possível salvar a capa do vídeo.')
      setVideos((current) => current.map((item) => item.id === video.id
        ? { ...item, hasPoster: true, posterType: 'image/jpeg', posterSize: poster.size }
        : item))
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : 'Não foi possível gerar a capa do vídeo.')
    } finally {
      setPosterGeneratingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Film size={17} className="text-[#FF6B00]" />
            <div>
              <h2 className="text-sm font-semibold text-[#121212]">Vídeos para apresentar a Vertex</h2>
              <p className="mt-1 text-xs text-[#777]">Estes vídeos aparecem antes do PDF no link enviado ao cliente.</p>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[#333]">
            <input
              type="checkbox"
              checked={presentationEnabled}
              onChange={(event) => setPresentationEnabled(event.target.checked)}
              className="h-4 w-4 accent-[#FF6B00]"
            />
            Exibir vídeos
          </label>
        </div>
      </CardHeader>

      <CardBody className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
          <Select
            label="Ambiente"
            value={environmentName}
            onChange={(event) => setEnvironmentName(event.target.value)}
            options={COMPANY_PRESENTATION_ENVIRONMENTS.map((value) => ({ value, label: value }))}
          />
          <Input
            label="Título do vídeo"
            value={caption}
            maxLength={240}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Ex.: Cozinha planejada entregue em Cotia"
          />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} loading={progress !== null}>
            <Film size={15} />
            {progress === null ? 'Adicionar vídeo' : `${progress}%`}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={COMPANY_PRESENTATION_VIDEO_ACCEPT}
            className="sr-only"
            onChange={(event) => void handleUpload(event)}
          />
        </div>

        <div className="rounded-lg bg-[#F7F7F7] px-4 py-3 text-xs text-[#666]">
          Aceita MP4 ou WebM em 4K de até 300 MB. O original mantém toda a qualidade; uma capa leve acelera a abertura.
        </div>
        {videoError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{videoError}</p> : null}

        {videos.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video, index) => (
              <article key={video.id} className="overflow-hidden rounded-lg border border-[#E8E8E8] bg-white">
                {['TYPE_CHECKED', 'CLEAN'].includes(video.securityStatus) ? (
                  <video
                    src={`/api/settings/company/presentation/images/${video.id}`}
                    poster={video.hasPoster ? `/api/settings/company/presentation/images/${video.id}?asset=poster` : undefined}
                    controls
                    preload="metadata"
                    onLoadedMetadata={(event) => {
                      const element = event.currentTarget
                      if (element.duration > 0 && element.currentTime === 0) element.currentTime = Math.min(0.5, element.duration / 10)
                    }}
                    className="aspect-video w-full bg-black object-contain"
                  >
                    Seu navegador não consegue reproduzir este vídeo.
                  </video>
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-amber-50 text-xs text-amber-800">
                    <Loader2 size={15} className="mr-2 animate-spin" /> Verificação pendente
                  </div>
                )}

                <div className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-[#FF6B00]">Vídeo {index + 1} · {video.environmentName}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#121212]">{video.caption || video.name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!video.hasPoster ? (
                      <button
                        type="button"
                        title="Gerar capa do vídeo"
                        aria-label="Gerar capa do vídeo"
                        onClick={() => void generatePoster(video)}
                        disabled={posterGeneratingId !== null}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#555] hover:bg-[#F3F3F3] disabled:opacity-30"
                      >
                        {posterGeneratingId === video.id ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
                      </button>
                    ) : null}
                    <button type="button" title="Mover vídeo para antes" aria-label="Mover vídeo para antes" onClick={() => void move(video, 'up')} disabled={index === 0 || movingId !== null} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#555] hover:bg-[#F3F3F3] disabled:opacity-30">
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" title="Mover vídeo para depois" aria-label="Mover vídeo para depois" onClick={() => void move(video, 'down')} disabled={index === videos.length - 1 || movingId !== null} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#555] hover:bg-[#F3F3F3] disabled:opacity-30">
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      title="Remover vídeo"
                      aria-label="Remover vídeo"
                      onClick={() => void remove(video)}
                      disabled={deletingId === video.id}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === video.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[#888]">Nenhum vídeo cadastrado para a apresentação.</p>
        )}

        <div className="flex flex-col gap-3 border-t border-[#ECECEC] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-sm ${feedback.startsWith('Apresentação') ? 'text-emerald-700' : 'text-red-700'}`}>{feedback}</p>
          <Button type="button" loading={saving} onClick={() => void save()}>
            <Save size={16} /> Salvar apresentação
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
