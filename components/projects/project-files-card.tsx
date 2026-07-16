'use client'

import { upload } from '@vercel/blob/client'
import Image from 'next/image'
import { ExternalLink, FileImage, FileText, FolderOpen, Loader2, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import {
  PROJECT_FILE_ACCEPT,
  PROJECT_FILE_CATEGORIES,
  PROJECT_FILE_CATEGORY_LABELS,
  PROJECT_FILE_MAX_SIZE,
  sanitizeProjectFileName,
  type ProjectFileCategory,
} from '@/lib/project-files'
import { formatDate } from '@/lib/utils'

export type ProjectFile = {
  id: string
  name: string
  type: string
  category: ProjectFileCategory
  size: number | null
  createdAt: string
}

function formatFileSize(size: number | null) {
  if (size === null || size === undefined) return 'Tamanho não informado'
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

function supportsPreview(type: string) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(type)
}

export function ProjectFilesCard({
  projectId,
  files,
  onFilesChange,
}: {
  projectId: string
  files: ProjectFile[]
  onFilesChange: (files: ProjectFile[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<ProjectFileCategory>('MEASUREMENT')
  const [progress, setProgress] = useState<number | null>(null)
  const [uploadingName, setUploadingName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ''
    if (selectedFiles.length === 0) return

    setError('')
    let nextFiles = files
    for (const file of selectedFiles) {
      if (file.size > PROJECT_FILE_MAX_SIZE) {
        setError(`"${file.name}" ultrapassa o limite de 25 MB.`)
        break
      }

      setUploadingName(file.name)
      setProgress(0)
      try {
        const blob = await upload(
          `projects/${projectId}/${sanitizeProjectFileName(file.name)}`,
          file,
          {
            access: 'private',
            contentType: file.type,
            handleUploadUrl: `/api/projects/${projectId}/files/upload`,
            clientPayload: JSON.stringify({ projectId, category, name: file.name }),
            multipart: file.size > 10 * 1024 * 1024,
            onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
          }
        )

        const response = await fetch(`/api/projects/${projectId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            type: blob.contentType || file.type,
            category,
            url: blob.url,
            size: file.size,
          }),
        })
        const recorded = await response.json().catch(() => null)
        if (!response.ok || !recorded?.id) {
          throw new Error(recorded?.error || 'O arquivo foi enviado, mas não pôde ser registrado no projeto.')
        }
        nextFiles = [recorded as ProjectFile, ...nextFiles.filter((item) => item.id !== recorded.id)]
        onFilesChange(nextFiles)
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível enviar o arquivo.')
        break
      }
    }
    setProgress(null)
    setUploadingName('')
  }

  const removeFile = async (file: ProjectFile) => {
    if (!window.confirm(`Remover "${file.name}" do projeto?`)) return
    setDeletingId(file.id)
    setError('')
    const response = await fetch(`/api/projects/${projectId}/files/${file.id}`, { method: 'DELETE' })
    const data = await response.json().catch(() => null)
    setDeletingId(null)
    if (!response.ok) {
      setError(data?.error || 'Não foi possível remover o arquivo.')
      return
    }
    onFilesChange(files.filter((item) => item.id !== file.id))
  }

  return (
    <Card id="arquivos" className="scroll-mt-28">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#121212]">Fotos e arquivos</h3>
            <p className="mt-1 text-xs text-[#9E9E9E]">Medição, projeto técnico, produção, instalação e entrega</p>
          </div>
          <div className="flex min-w-0 gap-2">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as ProjectFileCategory)}
              className="h-8 min-w-0 rounded-lg border border-[#D9D9D9] bg-white px-2 text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              aria-label="Categoria do arquivo"
            >
              {PROJECT_FILE_CATEGORIES.map((value) => <option key={value} value={value}>{PROJECT_FILE_CATEGORY_LABELS[value]}</option>)}
            </select>
            <Button type="button" size="sm" onClick={() => inputRef.current?.click()} loading={progress !== null} title="Adicionar fotos ou documentos">
              <Upload size={14} />
              Adicionar
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={PROJECT_FILE_ACCEPT}
              multiple
              className="sr-only"
              onChange={(event) => void handleUpload(event)}
            />
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
        {progress !== null ? (
          <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-xs text-orange-800">
              <span className="truncate">Enviando {uploadingName}</span>
              <span className="shrink-0 font-semibold">{progress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-orange-100">
              <div className="h-full rounded-full bg-[#FF6B00] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-7 text-center text-[#9E9E9E]">
            <FolderOpen size={28} className="mb-2 opacity-40" />
            <p className="text-sm">Nenhuma foto ou documento adicionado.</p>
            <p className="mt-1 text-xs">Envie imagens ou PDF de até 25 MB.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {files.map((file) => {
              const fileUrl = `/api/projects/${projectId}/files/${file.id}`
              const image = supportsPreview(file.type)
              return (
                <div key={file.id} className="overflow-hidden rounded-lg border border-[#E8E8E8] bg-white">
                  {image ? (
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] bg-[#F5F5F5]">
                      <Image src={fileUrl} alt={file.name} fill sizes="(min-width: 1280px) 260px, (min-width: 640px) 45vw, 90vw" unoptimized className="object-cover" />
                    </a>
                  ) : (
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="flex aspect-[4/3] items-center justify-center bg-[#FAFAFA] text-[#FF6B00]">
                      {file.type === 'application/pdf' ? <FileText size={36} /> : <FileImage size={36} />}
                    </a>
                  )}
                  <div className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#121212]" title={file.name}>{file.name}</p>
                        <p className="mt-0.5 text-[10px] text-[#9E9E9E]">{PROJECT_FILE_CATEGORY_LABELS[file.category] || 'Outros arquivos'}</p>
                      </div>
                      <button
                        type="button"
                        title="Remover arquivo"
                        onClick={() => void removeFile(file)}
                        disabled={deletingId === file.id}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === file.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#9E9E9E]">
                      <span>{formatFileSize(file.size)}</span>
                      <span>{formatDate(file.createdAt)}</span>
                    </div>
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF6B00] hover:underline">
                      Abrir <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
