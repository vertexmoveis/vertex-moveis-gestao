'use client'

import { upload } from '@vercel/blob/client'
import Image from 'next/image'
import { Film, ImagePlus, Loader2, Save, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import {
  COMPANY_PRESENTATION_ENVIRONMENTS,
  type CompanyPresentationImageData,
} from '@/lib/company-presentation'
import {
  COMPANY_PRESENTATION_IMAGE_ACCEPT,
  COMPANY_PRESENTATION_IMAGE_MAX_SIZE,
  COMPANY_PRESENTATION_IMAGE_PREFIX,
  COMPANY_PRESENTATION_VIDEO_ACCEPT,
  COMPANY_PRESENTATION_VIDEO_MAX_SIZE,
  presentationUploadContentType,
  type CompanyPresentationMediaKind,
} from '@/lib/company-presentation-images'
import type { CompanyProfileData } from '@/lib/company-profile'
import { sanitizeQuoteImageName } from '@/lib/quote-images'

type PresentationProfile = Pick<
  CompanyProfileData,
  | 'presentationEnabled'
  | 'presentationHeading'
  | 'presentationText'
  | 'presentationHighlight1'
  | 'presentationHighlight2'
  | 'presentationHighlight3'
>

function presentationProfileFields(profile: PresentationProfile): PresentationProfile {
  return {
    presentationEnabled: profile.presentationEnabled,
    presentationHeading: profile.presentationHeading,
    presentationText: profile.presentationText,
    presentationHighlight1: profile.presentationHighlight1,
    presentationHighlight2: profile.presentationHighlight2,
    presentationHighlight3: profile.presentationHighlight3,
  }
}

export function CompanyPresentationSettings({
  initialProfile,
  initialImages,
}: {
  initialProfile: PresentationProfile
  initialImages: CompanyPresentationImageData[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState(() => presentationProfileFields(initialProfile))
  const [images, setImages] = useState(initialImages)
  const [environmentName, setEnvironmentName] = useState<string>('Todos os ambientes')
  const [mediaKind, setMediaKind] = useState<CompanyPresentationMediaKind>('PORTFOLIO')
  const [pairKey, setPairKey] = useState('')
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [imageError, setImageError] = useState('')

  const update = <K extends keyof PresentationProfile>(field: K, value: PresentationProfile[K]) => {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  const save = async () => {
    setSaving(true)
    setFeedback('')
    try {
      const response = await fetch('/api/settings/company/presentation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presentationProfileFields(profile)),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Não foi possível salvar a apresentação.')
      setProfile(presentationProfileFields(data))
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
    const maxSize = mediaKind === 'VIDEO' ? COMPANY_PRESENTATION_VIDEO_MAX_SIZE : COMPANY_PRESENTATION_IMAGE_MAX_SIZE
    if (file.size > maxSize) {
      setImageError(mediaKind === 'VIDEO' ? 'O vídeo ultrapassa o limite de 50 MB.' : 'A imagem ultrapassa o limite de 8 MB.')
      return
    }
    if ((mediaKind === 'BEFORE' || mediaKind === 'AFTER') && !pairKey.trim()) {
      setImageError('Informe o nome da obra para montar o antes e depois.')
      return
    }

    setImageError('')
    setProgress(0)
    try {
      const contentType = presentationUploadContentType(file.name, file.type)
      const blob = await upload(`${COMPANY_PRESENTATION_IMAGE_PREFIX}${sanitizeQuoteImageName(file.name)}`, file, {
        access: 'private',
        contentType,
        handleUploadUrl: '/api/settings/company/presentation/images/upload',
        clientPayload: JSON.stringify({ environmentName, name: file.name, caption, mediaKind, pairKey: pairKey.trim() || null }),
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      })
      const response = await fetch('/api/settings/company/presentation/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environmentName,
          name: file.name,
          caption,
          mediaKind,
          pairKey: pairKey.trim() || null,
          type: blob.contentType || contentType,
          url: blob.url,
          size: file.size,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.id) throw new Error(data?.error || 'Não foi possível registrar a imagem.')
      setImages((current) => [data as CompanyPresentationImageData, ...current.filter((image) => image.id !== data.id)])
      setCaption('')
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.')
    } finally {
      setProgress(null)
    }
  }

  const remove = async (image: CompanyPresentationImageData) => {
    if (!window.confirm(`Remover "${image.caption || image.name}" da apresentação?`)) return
    setDeletingId(image.id)
    setImageError('')
    const response = await fetch(`/api/settings/company/presentation/images/${image.id}`, { method: 'DELETE' })
    const data = await response.json().catch(() => null)
    setDeletingId(null)
    if (!response.ok) {
      setImageError(data?.error || 'Não foi possível remover a imagem.')
      return
    }
    setImages((current) => current.filter((item) => item.id !== image.id))
  }

  const previewImage = images.find((image) => image.mediaKind === 'PORTFOLIO' && ['TYPE_CHECKED', 'CLEAN'].includes(image.securityStatus))
  const beforeAfterKeys = [...new Set(images.filter((image) => image.pairKey).map((image) => image.pairKey as string))]

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ImagePlus size={17} className="text-[#FF6B00]" />
            <div>
              <h2 className="text-sm font-semibold text-[#121212]">Apresentação para clientes</h2>
              <p className="mt-1 text-xs text-[#777]">Conteúdo exibido antes do PDF no link público do orçamento.</p>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[#333]">
            <input
              type="checkbox"
              checked={profile.presentationEnabled}
              onChange={(event) => update('presentationEnabled', event.target.checked)}
              className="h-4 w-4 accent-[#FF6B00]"
            />
            Exibir apresentação
          </label>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Título"
            maxLength={120}
            value={profile.presentationHeading}
            onChange={(event) => update('presentationHeading', event.target.value)}
          />
          <div className="md:row-span-2">
            <Textarea
              label="Texto de apresentação"
              maxLength={320}
              rows={5}
              value={profile.presentationText}
              onChange={(event) => update('presentationText', event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3 md:col-span-2">
            <Input label="Diferencial 1" maxLength={90} value={profile.presentationHighlight1} onChange={(event) => update('presentationHighlight1', event.target.value)} />
            <Input label="Diferencial 2" maxLength={90} value={profile.presentationHighlight2} onChange={(event) => update('presentationHighlight2', event.target.value)} />
            <Input label="Diferencial 3" maxLength={90} value={profile.presentationHighlight3} onChange={(event) => update('presentationHighlight3', event.target.value)} />
          </div>
        </div>

        <div className="relative min-h-56 overflow-hidden rounded-lg bg-[#171717] text-white">
          {previewImage ? (
            <Image
              src={`/api/settings/company/presentation/images/${previewImage.id}`}
              alt={previewImage.caption || previewImage.name}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 900px"
              className="object-cover opacity-55"
            />
          ) : null}
          <div className="relative z-10 max-w-2xl p-6 sm:p-8">
            <p className="text-xs font-bold uppercase text-[#FF8A38]">Vertex Móveis</p>
            <p className="mt-3 text-2xl font-extrabold">{profile.presentationHeading}</p>
            <p className="mt-3 text-sm leading-6 text-white/85">{profile.presentationText}</p>
          </div>
        </div>

        <div className="border-t border-[#ECECEC] pt-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[#121212]">Portfólio em fotos e vídeos</h3>
            <p className="mt-1 text-xs text-[#777]">Adicione fotos ou vídeos ao portfólio. Use “Antes” e “Depois” somente para comparar a mesma obra.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[190px_190px_1fr]">
            <Select
              label="Formato do portfólio"
              value={mediaKind}
              onChange={(event) => setMediaKind(event.target.value as CompanyPresentationMediaKind)}
              options={[
                { value: 'PORTFOLIO', label: 'Portfólio: foto' },
                { value: 'BEFORE', label: 'Foto: antes' },
                { value: 'AFTER', label: 'Foto: depois' },
                { value: 'VIDEO', label: 'Portfólio: vídeo' },
              ]}
            />
            <Select
              label="Ambiente"
              value={environmentName}
              onChange={(event) => setEnvironmentName(event.target.value)}
              options={COMPANY_PRESENTATION_ENVIRONMENTS.map((value) => ({ value, label: value }))}
            />
            <Input
              label={mediaKind === 'VIDEO' ? 'Título do vídeo' : 'Legenda (opcional)'}
              value={caption}
              maxLength={240}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Ex.: Cozinha planejada entregue em Cotia"
            />
          </div>
          {(mediaKind === 'BEFORE' || mediaKind === 'AFTER') ? (
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <Input
                label="Nome da obra para unir o par"
                value={pairKey}
                maxLength={120}
                onChange={(event) => setPairKey(event.target.value)}
                placeholder="Ex.: Cozinha da família Silva"
                list="presentation-pair-keys"
              />
              <datalist id="presentation-pair-keys">
                {beforeAfterKeys.map((key) => <option key={key} value={key} />)}
              </datalist>
              <p className="text-xs text-[#777] md:col-span-2">Use exatamente o mesmo nome na foto “Antes” e na foto “Depois”.</p>
            </div>
          ) : null}
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} loading={progress !== null}>
              {mediaKind === 'VIDEO' ? <Film size={15} /> : <Upload size={15} />}
              {progress === null
                ? mediaKind === 'VIDEO'
                  ? 'Adicionar vídeo ao portfólio'
                  : mediaKind === 'PORTFOLIO'
                    ? 'Adicionar foto ao portfólio'
                    : 'Adicionar foto'
                : `${progress}%`}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={mediaKind === 'VIDEO' ? COMPANY_PRESENTATION_VIDEO_ACCEPT : COMPANY_PRESENTATION_IMAGE_ACCEPT}
              className="sr-only"
              onChange={(event) => void handleUpload(event)}
            />
          </div>
          {imageError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{imageError}</p> : null}
        </div>

        {images.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <article key={image.id} className="overflow-hidden rounded-lg border border-[#E8E8E8] bg-white">
                {['TYPE_CHECKED', 'CLEAN'].includes(image.securityStatus) && image.mediaKind === 'VIDEO' ? (
                  <video
                    src={`/api/settings/company/presentation/images/${image.id}`}
                    controls
                    preload="none"
                    className="aspect-video w-full bg-black object-contain"
                  >
                    Seu navegador não consegue reproduzir este vídeo.
                  </video>
                ) : ['TYPE_CHECKED', 'CLEAN'].includes(image.securityStatus) ? (
                  <div className="relative aspect-[16/10] bg-[#F4F4F4]">
                    <Image src={`/api/settings/company/presentation/images/${image.id}`} alt={image.caption || image.name} fill unoptimized sizes="(max-width: 640px) 100vw, 360px" className="object-cover" />
                  </div>
                ) : (
                  <div className="flex aspect-[16/10] items-center justify-center bg-amber-50 text-xs text-amber-800">
                    <Loader2 size={15} className="mr-2 animate-spin" /> Verificação pendente
                  </div>
                )}
                <div className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-[#FF6B00]">
                      {{ PORTFOLIO: 'Portfólio · Foto', BEFORE: 'Antes', AFTER: 'Depois', VIDEO: 'Portfólio · Vídeo' }[image.mediaKind as CompanyPresentationMediaKind] || 'Portfólio'} · {image.environmentName}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#121212]">{image.caption || image.name}</p>
                    {image.pairKey ? <p className="mt-1 truncate text-xs text-[#777]">Obra: {image.pairKey}</p> : null}
                  </div>
                  <button
                    type="button"
                    title="Remover conteúdo"
                    onClick={() => void remove(image)}
                    disabled={deletingId === image.id}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === image.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-[#888]">Adicione fotos e vídeos reais para personalizar a apresentação dos clientes.</p>
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
