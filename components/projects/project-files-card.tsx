'use client'

import { upload } from '@vercel/blob/client'
import Image from 'next/image'
import { Check, ExternalLink, FileImage, FileText, FolderOpen, Loader2, Pencil, RefreshCw, Search, ShieldAlert, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import {
  PROJECT_FILE_ACCEPT,
  PROJECT_FILE_CATEGORIES,
  PROJECT_FILE_CATEGORY_LABELS,
  PROJECT_FILE_MAX_SIZE,
  projectFileDisplayName,
  projectFileExtension,
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
  securityStatus: 'PENDING' | 'TYPE_CHECKED' | 'CLEAN' | 'REJECTED' | 'ERROR'
  securityDetails: string | null
  securityCheckedAt: string | null
  expiresAt: string | null
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

type FileKindFilter = 'ALL' | 'IMAGE' | 'VIDEO' | 'PDF'

function fileKind(type: string): Exclude<FileKindFilter, 'ALL'> {
  if (type === 'application/pdf') return 'PDF'
  if (type.startsWith('video/')) return 'VIDEO'
  return 'IMAGE'
}

function fileKindLabel(file: ProjectFile) {
  const extension = projectFileExtension(file.name).replace('.', '').toUpperCase()
  if (extension) return extension
  if (fileKind(file.type) === 'PDF') return 'PDF'
  if (fileKind(file.type) === 'VIDEO') return 'Vídeo'
  return 'Imagem'
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
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState<ProjectFileCategory>('OTHER')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ProjectFileCategory>('ALL')
  const [kindFilter, setKindFilter] = useState<FileKindFilter>('ALL')
  const [error, setError] = useState('')

  const filteredGroups = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
    const filtered = files.filter((file) => {
      if (categoryFilter !== 'ALL' && file.category !== categoryFilter) return false
      if (kindFilter !== 'ALL' && fileKind(file.type) !== kindFilter) return false
      return !normalizedSearch || file.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
    })

    return PROJECT_FILE_CATEGORIES.map((groupCategory) => ({
      category: groupCategory,
      files: filtered
        .filter((file) => file.category === groupCategory)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    })).filter((group) => group.files.length > 0)
  }, [categoryFilter, files, kindFilter, search])

  const filteredCount = filteredGroups.reduce((total, group) => total + group.files.length, 0)

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
      const abortController = new AbortController()
      const uploadTimeout = window.setTimeout(() => abortController.abort(), 3 * 60 * 1000)
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
            abortSignal: abortController.signal,
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
        if (recorded?.id) {
          nextFiles = [recorded as ProjectFile, ...nextFiles.filter((item) => item.id !== recorded.id)]
          onFilesChange(nextFiles)
        }
        if (!response.ok || !recorded?.id) {
          throw new Error(recorded?.error || 'O arquivo foi enviado, mas não pôde ser registrado no projeto.')
        }
      } catch (uploadError) {
        setError(
          uploadError instanceof DOMException && uploadError.name === 'AbortError'
            ? 'O envio demorou mais de 3 minutos e foi interrompido. Confira sua conexão e tente novamente.'
            : uploadError instanceof Error ? uploadError.message : 'Não foi possível enviar o arquivo.'
        )
        break
      } finally {
        window.clearTimeout(uploadTimeout)
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

  const scanFile = async (file: ProjectFile) => {
    setScanningId(file.id)
    setError('')
    const response = await fetch(`/api/projects/${projectId}/files/${file.id}/scan`, { method: 'POST' })
    const updated = await response.json().catch(() => null)
    setScanningId(null)
    if (updated?.securityStatus === 'REJECTED') {
      onFilesChange(files.filter((item) => item.id !== file.id))
      setError(updated.securityDetails || 'O arquivo foi rejeitado e removido.')
      return
    }
    if (updated?.id) {
      onFilesChange(files.map((item) => item.id === file.id ? updated as ProjectFile : item))
    }
    if (!response.ok) {
      setError(updated?.securityDetails || updated?.error || 'Não foi possível verificar o arquivo.')
    }
  }

  const startEditing = (file: ProjectFile) => {
    setEditingId(file.id)
    setEditName(projectFileDisplayName(file.name))
    setEditCategory(file.category)
    setError('')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditName('')
  }

  const saveFile = async (file: ProjectFile) => {
    if (!editName.trim()) {
      setError('Informe um nome para o arquivo.')
      return
    }

    setSavingId(file.id)
    setError('')
    const response = await fetch(`/api/projects/${projectId}/files/${file.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, category: editCategory }),
    })
    const updated = await response.json().catch(() => null)
    setSavingId(null)
    if (!response.ok || !updated?.id) {
      setError(updated?.error || 'Não foi possível salvar o nome do arquivo.')
      return
    }

    onFilesChange(files.map((item) => item.id === file.id ? updated as ProjectFile : item))
    cancelEditing()
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
            <label className="flex min-w-0 items-center gap-2 text-xs text-[#6B6B6B]">
              <span className="hidden lg:inline">Salvar em</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as ProjectFileCategory)}
                className="h-8 min-w-0 rounded-lg border border-[#D9D9D9] bg-white px-2 text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                aria-label="Etapa dos novos arquivos"
              >
                {PROJECT_FILE_CATEGORIES.map((value) => <option key={value} value={value}>{PROJECT_FILE_CATEGORY_LABELS[value]}</option>)}
              </select>
            </label>
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
              <span className="shrink-0 font-semibold">{progress === 0 ? 'Preparando...' : `${progress}%`}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-orange-100">
              <div className="h-full rounded-full bg-[#FF6B00] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        {files.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
              <span className="sr-only">Buscar arquivos</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome"
                className="h-9 w-full rounded-lg border border-[#D9D9D9] bg-white pl-9 pr-3 text-xs text-[#121212] outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as 'ALL' | ProjectFileCategory)}
              className="h-9 rounded-lg border border-[#D9D9D9] bg-white px-3 text-xs text-[#121212] outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-orange-100"
              aria-label="Filtrar por etapa"
            >
              <option value="ALL">Todas as etapas</option>
              {PROJECT_FILE_CATEGORIES.map((value) => <option key={value} value={value}>{PROJECT_FILE_CATEGORY_LABELS[value]}</option>)}
            </select>
            <select
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value as FileKindFilter)}
              className="h-9 rounded-lg border border-[#D9D9D9] bg-white px-3 text-xs text-[#121212] outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-orange-100"
              aria-label="Filtrar por tipo"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="IMAGE">Fotos</option>
              <option value="VIDEO">Vídeos</option>
              <option value="PDF">PDFs</option>
            </select>
            <span className="shrink-0 px-1 text-[11px] text-[#7A7A7A]">{filteredCount} de {files.length}</span>
          </div>
        ) : null}

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-7 text-center text-[#9E9E9E]">
            <FolderOpen size={28} className="mb-2 opacity-40" />
            <p className="text-sm">Nenhuma foto ou documento adicionado.</p>
            <p className="mt-1 text-xs">Envie imagens ou PDF de até 25 MB.</p>
          </div>
        ) : filteredCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-7 text-center text-[#9E9E9E]">
            <Search size={24} className="mb-2 opacity-40" />
            <p className="text-sm">Nenhum arquivo encontrado.</p>
            <button
              type="button"
              onClick={() => { setSearch(''); setCategoryFilter('ALL'); setKindFilter('ALL') }}
              className="mt-2 text-xs font-semibold text-[#FF6B00] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredGroups.map((group) => (
              <section key={group.category} aria-labelledby={`arquivos-${group.category}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 id={`arquivos-${group.category}`} className="text-xs font-semibold text-[#4A4A4A]">
                    {PROJECT_FILE_CATEGORY_LABELS[group.category]}
                  </h4>
                  <span className="text-[10px] text-[#9E9E9E]">
                    {group.files.length} {group.files.length === 1 ? 'arquivo' : 'arquivos'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.files.map((file) => {
                    const fileUrl = `/api/projects/${projectId}/files/${file.id}`
                    const released = file.securityStatus === 'CLEAN' || file.securityStatus === 'TYPE_CHECKED'
                    const image = released && supportsPreview(file.type)
                    return (
                      <div key={file.id} className="overflow-hidden rounded-lg border border-[#E8E8E8] bg-white">
                        {image ? (
                          <a href={fileUrl} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] bg-[#F5F5F5]">
                            <Image src={fileUrl} alt={file.name} fill sizes="(min-width: 1280px) 260px, (min-width: 640px) 45vw, 90vw" unoptimized className="object-cover" />
                          </a>
                        ) : released ? (
                          <a href={fileUrl} target="_blank" rel="noreferrer" className="flex aspect-[4/3] items-center justify-center bg-[#FAFAFA] text-[#FF6B00]">
                            {file.type === 'application/pdf' ? <FileText size={36} /> : <FileImage size={36} />}
                          </a>
                        ) : (
                          <div className="flex aspect-[4/3] items-center justify-center bg-[#FAFAFA] text-amber-600">
                            <ShieldAlert size={36} />
                          </div>
                        )}
                        <div className="space-y-2 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#121212]" title={projectFileDisplayName(file.name)}>
                                {projectFileDisplayName(file.name)}
                              </p>
                              <p className="mt-0.5 text-[10px] text-[#9E9E9E]">
                                {fileKindLabel(file)} · {PROJECT_FILE_CATEGORY_LABELS[file.category] || 'Outros arquivos'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {!released ? (
                                <button
                                  type="button"
                                  title="Verificar arquivo novamente"
                                  onClick={() => void scanFile(file)}
                                  disabled={scanningId === file.id}
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-amber-600 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50"
                                >
                                  <RefreshCw size={14} className={scanningId === file.id ? 'animate-spin' : ''} />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                title="Renomear e organizar"
                                aria-label={`Renomear ${projectFileDisplayName(file.name)}`}
                                onClick={() => startEditing(file)}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#6B6B6B] transition-colors hover:bg-[#F5F5F5] hover:text-[#121212] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                title="Remover arquivo"
                                onClick={() => void removeFile(file)}
                                disabled={deletingId === file.id}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                              >
                                {deletingId === file.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                          </div>
                          {editingId === file.id ? (
                            <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50/50 p-2">
                              <label className="block text-[10px] font-medium text-[#4A4A4A]">
                                Nome
                                <div className="mt-1 flex items-center rounded-lg border border-[#D9D9D9] bg-white focus-within:border-[#FF6B00] focus-within:ring-2 focus-within:ring-orange-100">
                                  <input
                                    value={editName}
                                    onChange={(event) => setEditName(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') void saveFile(file)
                                      if (event.key === 'Escape') cancelEditing()
                                    }}
                                    autoFocus
                                    maxLength={170}
                                    className="h-8 min-w-0 flex-1 bg-transparent px-2 text-xs text-[#121212] outline-none"
                                  />
                                  <span className="shrink-0 pr-2 text-[10px] text-[#9E9E9E]">{projectFileExtension(file.name)}</span>
                                </div>
                              </label>
                              <label className="block text-[10px] font-medium text-[#4A4A4A]">
                                Etapa
                                <select
                                  value={editCategory}
                                  onChange={(event) => setEditCategory(event.target.value as ProjectFileCategory)}
                                  className="mt-1 h-8 w-full rounded-lg border border-[#D9D9D9] bg-white px-2 text-xs text-[#121212] outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-orange-100"
                                >
                                  {PROJECT_FILE_CATEGORIES.map((value) => <option key={value} value={value}>{PROJECT_FILE_CATEGORY_LABELS[value]}</option>)}
                                </select>
                              </label>
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={cancelEditing}
                                  disabled={savingId === file.id}
                                  className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] text-[#6B6B6B] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9D9D9]"
                                >
                                  <X size={13} /> Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void saveFile(file)}
                                  disabled={savingId === file.id || !editName.trim()}
                                  className="flex h-8 items-center gap-1 rounded-lg bg-[#FF6B00] px-2 text-[11px] font-semibold text-white hover:bg-[#E05A00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] disabled:opacity-50"
                                >
                                  {savingId === file.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Salvar
                                </button>
                              </div>
                            </div>
                          ) : null}
                          <div className="flex items-center gap-1.5 text-[10px]">
                            {released ? <ShieldCheck size={12} className="text-emerald-600" /> : <ShieldAlert size={12} className="text-amber-600" />}
                            <span className={released ? 'text-emerald-700' : 'text-amber-700'}>
                              {file.securityStatus === 'CLEAN'
                                ? 'Verificado contra ameaças'
                                : file.securityStatus === 'TYPE_CHECKED'
                                  ? 'Formato conferido'
                                  : file.securityStatus === 'ERROR'
                                    ? 'Verificação pendente'
                                    : 'Verificando arquivo'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[#9E9E9E]">
                            <span>{formatFileSize(file.size)}</span>
                            <span>{formatDate(file.createdAt)}</span>
                          </div>
                          {released ? (
                            <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF6B00] hover:underline">
                              Abrir <ExternalLink size={12} />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
