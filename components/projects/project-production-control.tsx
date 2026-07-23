'use client'

import { useState } from 'react'
import { CalendarClock, Loader2, LockKeyhole, Save, UnlockKeyhole } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'

type ProductionControl = {
  productionBlockedAt: string | null
  productionBlockReason: string | null
  stageDeadlineDate: string | null
}

export function ProjectProductionControl({
  projectId,
  value,
  onChange,
}: {
  projectId: string
  value: ProductionControl
  onChange: (value: ProductionControl) => void
}) {
  const [blocked, setBlocked] = useState(Boolean(value.productionBlockedAt))
  const [reason, setReason] = useState(value.productionBlockReason || '')
  const [deadline, setDeadline] = useState(value.stageDeadlineDate?.split('T')[0] || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const save = async () => {
    setSaving(true)
    setMessage('')
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productionBlocked: blocked,
        productionBlockReason: blocked ? reason : null,
        stageDeadlineDate: deadline || null,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) {
      setMessage(payload.error || 'Não foi possível salvar o controle da produção.')
      return
    }
    onChange({
      productionBlockedAt: payload.productionBlockedAt,
      productionBlockReason: payload.productionBlockReason,
      stageDeadlineDate: payload.stageDeadlineDate,
    })
    setMessage('Controle atualizado.')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {blocked ? <LockKeyhole size={16} className="text-red-600" /> : <UnlockKeyhole size={16} className="text-emerald-600" />}
          <div>
            <h3 className="text-sm font-semibold text-[#121212]">Controle da etapa</h3>
            <p className="mt-1 text-xs text-[#777]">Prazo e impedimentos da produção</p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <label className="flex cursor-pointer items-center gap-3 border border-[#E8E8E8] px-3 py-3">
          <input
            type="checkbox"
            checked={blocked}
            onChange={(event) => setBlocked(event.target.checked)}
            className="h-4 w-4 accent-[#FF6B00]"
          />
          <span className="text-sm font-semibold text-[#121212]">Produção bloqueada</span>
        </label>
        {blocked ? (
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ex.: aguardando confirmação da cor pelo cliente"
            className="w-full resize-none border border-red-200 px-3 py-2 text-sm outline-none focus:border-red-400"
          />
        ) : null}
        <label className="block">
          <span className="mb-1 flex items-center gap-2 text-xs font-semibold text-[#555]"><CalendarClock size={14} /> Prazo desta etapa</span>
          <input
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="h-10 w-full border border-[#D9D9D9] px-3 text-sm outline-none focus:border-[#FF6B00]"
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || (blocked && !reason.trim())}
          className="inline-flex h-9 items-center gap-2 bg-[#FF6B00] px-3 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar controle
        </button>
        {message ? <p className={`text-xs ${message === 'Controle atualizado.' ? 'text-emerald-700' : 'text-red-700'}`}>{message}</p> : null}
      </CardBody>
    </Card>
  )
}
