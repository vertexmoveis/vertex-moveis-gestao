'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'

type PrivacyRequest = {
  id: string
  type: 'EXPORT' | 'CORRECTION' | 'ANONYMIZE' | 'DELETE'
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED'
  notes: string
  createdAt: string
  createdBy: { name: string }
}

const TYPE_LABELS = { EXPORT: 'Exportação', CORRECTION: 'Correção', ANONYMIZE: 'Anonimização', DELETE: 'Exclusão' } as const
const STATUS_LABELS = { OPEN: 'Aberta', IN_PROGRESS: 'Em análise', COMPLETED: 'Concluída', REJECTED: 'Recusada' } as const

export function ClientPrivacyCard({ clientId }: { clientId: string }) {
  const [requests, setRequests] = useState<PrivacyRequest[]>([])
  const [type, setType] = useState<PrivacyRequest['type']>('CORRECTION')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const response = await fetch(`/api/clients/${clientId}/privacy`, { cache: 'no-store' })
    const payload = await response.json().catch(() => [])
    if (response.ok) setRequests(payload)
  }, [clientId])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const create = async () => {
    if (notes.trim().length < 3) return setMessage('Explique brevemente a solicitação.')
    setBusy(true)
    setMessage('')
    const response = await fetch(`/api/clients/${clientId}/privacy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, notes }),
    })
    const payload = await response.json().catch(() => null)
    setBusy(false)
    if (!response.ok) return setMessage(payload?.error || 'Não foi possível registrar a solicitação.')
    setNotes('')
    setMessage('Solicitação registrada para análise.')
    await load()
  }

  return (
    <Card>
      <CardHeader><h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-[#777]"><ShieldCheck size={15} className="text-[#FF6B00]" /> Privacidade e dados</h3></CardHeader>
      <CardBody className="space-y-3">
        <a href={`/api/clients/${clientId}/privacy?export=1`} className="inline-flex h-9 w-full items-center justify-center gap-2 border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F7F7F7]"><Download size={14} /> Baixar dados do cliente</a>
        <select value={type} onChange={(event) => setType(event.target.value as PrivacyRequest['type'])} className="h-10 w-full border border-[#D9D9D9] bg-white px-3 text-sm">
          <option value="CORRECTION">Correção de dados</option>
          <option value="EXPORT">Exportação de dados</option>
          <option value="ANONYMIZE">Anonimizar cadastro</option>
          <option value="DELETE">Solicitar exclusão</option>
        </select>
        <Textarea label="Motivo" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        <Button type="button" size="sm" className="w-full" loading={busy} onClick={() => void create()}>Registrar solicitação</Button>
        {message ? <p role="status" className="text-xs text-[#666]">{message}</p> : null}
        {requests.length > 0 ? <div className="divide-y divide-[#EEE] border-t border-[#EEE] pt-1">{requests.slice(0, 5).map((request) => <div key={request.id} className="py-2"><div className="flex items-center justify-between gap-2 text-xs"><strong>{TYPE_LABELS[request.type]}</strong><span className="text-[#FF6B00]">{STATUS_LABELS[request.status]}</span></div><p className="mt-1 text-[10px] text-[#888]">{formatDate(request.createdAt)} · {request.createdBy.name}</p></div>)}</div> : null}
      </CardBody>
    </Card>
  )
}
