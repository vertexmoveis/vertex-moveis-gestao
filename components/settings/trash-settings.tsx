'use client'

import { useEffect, useState } from 'react'
import { Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'

type TrashItem = {
  id: string
  type: 'client' | 'project' | 'quote'
  name: string
  subtitle: string
  archivedAt: string
}

const typeLabels: Record<TrashItem['type'], string> = {
  client: 'Cliente',
  project: 'Projeto',
  quote: 'Orçamento',
}

function formatArchivedAt(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

export function TrashSettings() {
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/trash', { cache: 'no-store' })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => {
        if (!active) return
        if (response.ok) setItems(payload.items || [])
        else setError(payload.error || 'Não foi possível abrir a lixeira.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const restore = async (item: TrashItem) => {
    setBusyId(item.id)
    setError('')
    const response = await fetch(`/api/trash/${item.type}/${item.id}`, { method: 'PATCH' })
    if (response.ok) {
      setItems((current) => current.filter((entry) => entry.id !== item.id))
    } else {
      const payload = await response.json().catch(() => ({}))
      setError(payload.error || 'Não foi possível restaurar o registro.')
    }
    setBusyId(null)
  }

  const purge = async (item: TrashItem) => {
    if (!window.confirm(`Excluir "${item.name}" definitivamente? Essa ação não pode ser desfeita.`)) return
    setBusyId(item.id)
    setError('')
    const response = await fetch(`/api/trash/${item.type}/${item.id}`, { method: 'DELETE' })
    if (response.ok) {
      setItems((current) => current.filter((entry) => entry.id !== item.id))
    } else {
      const payload = await response.json().catch(() => ({}))
      setError(payload.error || 'Não foi possível excluir o registro definitivamente.')
    }
    setBusyId(null)
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-sm font-semibold text-[#121212]">Lixeira</h2>
          <p className="mt-1 text-xs text-[#777]">Restaure registros apagados ou remova-os definitivamente</p>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {error ? <p className="border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {loading ? (
          <div className="flex min-h-20 items-center justify-center text-[#777]">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-5 text-center text-sm text-[#888]">A lixeira está vazia.</p>
        ) : (
          <div className="divide-y divide-[#ECECEC] border border-[#E8E8E8]">
            {items.map((item) => (
              <div key={`${item.type}:${item.id}`} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#121212]">{item.name}</p>
                  <p className="mt-1 text-xs text-[#777]">{typeLabels[item.type]} · {item.subtitle} · {formatArchivedAt(item.archivedAt)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void restore(item)}
                    disabled={busyId === item.id}
                    className="inline-flex h-9 items-center gap-2 border border-[#D9D9D9] bg-white px-3 text-xs font-semibold text-[#121212] hover:bg-[#F5F5F5] disabled:opacity-50"
                  >
                    {busyId === item.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    Restaurar
                  </button>
                  <button
                    type="button"
                    onClick={() => void purge(item)}
                    disabled={busyId === item.id}
                    title="Excluir definitivamente"
                    className="inline-flex h-9 w-9 items-center justify-center border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
