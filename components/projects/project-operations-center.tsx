'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Boxes, CheckCircle2, Clock3, FileSignature, Gauge, PackageCheck, Play, Printer, RotateCcw, Save, Scissors, ShieldCheck, SquarePen, StopCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/utils'

type Piece = { id: string; environment: string | null; label: string; material: string; finish: string | null; widthMm: number; heightMm: number; quantity: number; grain: boolean; status: string }
type TimeEntry = { id: string; phase: string; startedAt: string; endedAt: string | null; minutes: number; user: { id: string; name: string } }
type Quality = { id: string | null; key: string; label: string; status: string; notes: string | null; checkedAt: string | null; checkedBy: { id: string; name: string } | null }
type ChangeOrder = { id: string; title: string; description: string; amountDelta: number; daysDelta: number; status: string; createdAt: string }
type Reservation = { id: string; materialId: string; quantity: number; status: string; material: { id: string; name: string; unit: string; stockQuantity: number } }
type ReservationOption = { materialId: string | null; materialName: string; finish: string | null; unit: string; estimatedQuantity: number; material: { id: string; name: string; unit: string; stockQuantity: number } | null }
type DeliveryProof = { id: string; confirmedBy: string; checklist: Record<string, boolean>; notes: string | null; deliveredAt: string }
type Commission = { id: string; percent: number; amount: number; status: string; user: { id: string; name: string } }

type OperationsData = {
  pieces: Piece[]
  sheetEstimate: { pieceAreaM2: number; adjustedAreaM2: number; sheetAreaM2: number; estimatedSheets: number }
  timeEntries: TimeEntry[]
  quality: Quality[]
  changes: ChangeOrder[]
  proofs: DeliveryProof[]
  reservations: Reservation[]
  reservationOptions: ReservationOption[]
  commission: Commission | null
  productionWeight: number
}

const PHASES = [
  ['MEASUREMENT', 'Medição'],
  ['DESIGN', 'Projeto técnico'],
  ['PRODUCTION', 'Produção'],
  ['INSTALLATION', 'Instalação'],
] as const

const TABS = [
  ['OVERVIEW', 'Controle', Gauge],
  ['CUT', 'Corte e etiquetas', Scissors],
  ['QUALITY', 'Qualidade', ShieldCheck],
  ['CHANGES', 'Alterações', SquarePen],
  ['DELIVERY', 'Entrega', PackageCheck],
] as const

const PIECE_STATUS = {
  PLANNED: 'Planejada', CUT: 'Cortada', LABELED: 'Etiquetada', ASSEMBLED: 'Montada',
} as Record<string, string>

const CHANGE_STATUS = {
  DRAFT: 'Rascunho', SENT: 'Enviada', APPROVED: 'Aprovada', REJECTED: 'Recusada',
} as Record<string, string>

function hoursLabel(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0 ? `${hours}h ${rest}min` : `${rest}min`
}

export function ProjectOperationsCenter({
  projectId,
  manager,
  canManageFinancial,
}: {
  projectId: string
  manager: { id: string; name: string } | null
  canManageFinancial: boolean
}) {
  const [data, setData] = useState<OperationsData | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('OVERVIEW')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('PRODUCTION')
  const [weight, setWeight] = useState('1')
  const [commissionPercent, setCommissionPercent] = useState('0')
  const [piece, setPiece] = useState({ label: '', environment: '', material: 'MDF', finish: '', widthMm: '', heightMm: '', quantity: '1', grain: false })
  const [change, setChange] = useState({ title: '', description: '', amountDelta: '0', daysDelta: '0' })

  const load = useCallback(async () => {
    setError('')
    const response = await fetch(`/api/projects/${projectId}/operations`, { cache: 'no-store' })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result) {
      setError(result?.error || 'Não foi possível carregar o controle operacional.')
      setLoading(false)
      return
    }
    setData(result)
    setWeight(String(result.productionWeight || 1))
    setCommissionPercent(String(result.commission?.percent || 0))
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const execute = async (key: string, payload: Record<string, unknown>) => {
    setSaving(key)
    setError('')
    const response = await fetch(`/api/projects/${projectId}/operations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => null)
    setSaving('')
    if (!response.ok) {
      setError(result?.error || 'Não foi possível salvar a operação.')
      return false
    }
    await load()
    return true
  }

  const totalMinutes = useMemo(() => data?.timeEntries.reduce((total, entry) => total + entry.minutes, 0) || 0, [data])
  const activeEntry = data?.timeEntries.find((entry) => !entry.endedAt) || null
  const passedQuality = data?.quality.filter((item) => item.status === 'PASSED').length || 0
  const qualityComplete = data?.quality.length ? Math.round((passedQuality / data.quality.length) * 100) : 0
  const reservationByMaterial = new Map(data?.reservations.map((item) => [item.materialId, item]) || [])

  if (loading) return <Card><CardBody><div className="h-48 animate-pulse bg-[#F5F5F5]" /></CardBody></Card>
  if (!data) return <Card><CardBody><p className="text-sm text-red-600">{error}</p></CardBody></Card>

  return (
    <Card id="operacao" className="scroll-mt-28">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#121212]">Centro operacional</h3>
            <p className="mt-1 text-xs text-[#777]">Corte, tempo, estoque, qualidade, alterações e entrega</p>
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
            {TABS.map(([value, label, Icon]) => (
              <button key={value} type="button" onClick={() => setTab(value)} className={`inline-flex h-9 shrink-0 items-center gap-1.5 border px-3 text-xs font-semibold ${tab === value ? 'border-[#FF6B00] bg-[#FFF4EC] text-[#C65300]' : 'border-[#E5E5E5] bg-white text-[#555]'}`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {error ? <div role="alert" className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        {tab === 'OVERVIEW' ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="border border-[#E8E8E8] bg-[#FAFAFA] p-3"><p className="text-[10px] uppercase text-[#888]">Carga</p><p className="mt-1 text-xl font-bold">{data.productionWeight.toLocaleString('pt-BR')} pontos</p></div>
              <div className="border border-[#E8E8E8] bg-[#FAFAFA] p-3"><p className="text-[10px] uppercase text-[#888]">Horas apontadas</p><p className="mt-1 text-xl font-bold">{hoursLabel(totalMinutes)}</p></div>
              <div className="border border-[#E8E8E8] bg-[#FAFAFA] p-3"><p className="text-[10px] uppercase text-[#888]">Chapas estimadas</p><p className="mt-1 text-xl font-bold">{data.sheetEstimate.estimatedSheets}</p></div>
              <div className="border border-[#E8E8E8] bg-[#FAFAFA] p-3"><p className="text-[10px] uppercase text-[#888]">Qualidade</p><p className="mt-1 text-xl font-bold">{qualityComplete}%</p></div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="border border-[#E5E5E5] p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} className="text-[#FF6B00]" /> Apontamento de horas</h4>
                {activeEntry ? (
                  <div className="mt-3 flex items-center justify-between gap-3 bg-emerald-50 p-3">
                    <div><p className="text-sm font-semibold text-emerald-800">Em andamento</p><p className="text-xs text-emerald-700">{PHASES.find(([value]) => value === activeEntry.phase)?.[1]} · desde {new Date(activeEntry.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div>
                    <Button type="button" size="sm" variant="outline" loading={saving === 'time'} onClick={() => void execute('time', { action: 'TIME_STOP', entryId: activeEntry.id })}><StopCircle size={14} /> Parar</Button>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <select value={phase} onChange={(event) => setPhase(event.target.value)} className="h-10 min-w-0 flex-1 border border-[#D9D9D9] bg-white px-3 text-sm">
                      {PHASES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <Button type="button" loading={saving === 'time'} onClick={() => void execute('time', { action: 'TIME_START', phase })}><Play size={14} /> Iniciar</Button>
                  </div>
                )}
                <div className="mt-3 max-h-36 divide-y divide-[#EEE] overflow-y-auto">
                  {data.timeEntries.filter((entry) => entry.endedAt).slice(0, 8).map((entry) => <div key={entry.id} className="flex justify-between py-2 text-xs"><span>{entry.user.name} · {PHASES.find(([value]) => value === entry.phase)?.[1]}</span><strong>{hoursLabel(entry.minutes)}</strong></div>)}
              </div>
              </section>

              <section className="border border-[#E5E5E5] p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold"><Gauge size={16} className="text-[#FF6B00]" /> Peso na capacidade</h4>
                <p className="mt-1 text-xs text-[#777]">Projetos grandes consomem mais capacidade semanal.</p>
                <div className="mt-3 flex gap-2"><Input label="Pontos" type="number" min="0.25" max="10" step="0.25" value={weight} onChange={(event) => setWeight(event.target.value)} /><Button type="button" className="mt-6" loading={saving === 'weight'} onClick={() => void execute('weight', { action: 'PRODUCTION_WEIGHT_SET', weight })}><Save size={14} /> Salvar</Button></div>
                {canManageFinancial && manager ? (
                  <div className="mt-4 border-t border-[#EEE] pt-4">
                    <p className="text-xs font-semibold">Comissão de {manager.name}</p>
                    <div className="mt-2 flex gap-2"><Input label="Percentual" type="number" min="0" max="100" step="0.1" value={commissionPercent} onChange={(event) => setCommissionPercent(event.target.value)} /><Button type="button" className="mt-6" variant="outline" loading={saving === 'commission'} onClick={() => void execute('commission', { action: 'COMMISSION_SET', userId: manager.id, percent: commissionPercent })}><Save size={14} /></Button></div>
                    {data.commission ? <p className="mt-2 text-xs text-[#666]">{formatCurrency(data.commission.amount)} · {data.commission.status === 'AVAILABLE' ? 'liberada após recebimento' : 'aguardando recebimento'}</p> : null}
                  </div>
                ) : null}
              </section>
            </div>

            <section className="border border-[#E5E5E5] p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold"><Boxes size={16} className="text-[#FF6B00]" /> Reserva de estoque</h4>
              <div className="mt-3 divide-y divide-[#EEE]">
                {data.reservationOptions.length === 0 ? <p className="py-3 text-sm text-[#888]">Nenhum material do catálogo vinculado a este projeto.</p> : data.reservationOptions.map((option) => {
                  if (!option.materialId || !option.material) return null
                  const current = reservationByMaterial.get(option.materialId)
                  const shortage = Math.max((current?.quantity || option.estimatedQuantity) - option.material.stockQuantity, 0)
                  return <div key={`${option.materialId}-${option.finish || ''}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{option.materialName}{option.finish ? ` · ${option.finish}` : ''}</p><p className="text-xs text-[#777]">Previsto: {option.estimatedQuantity} {option.unit} · estoque: {option.material.stockQuantity} {option.material.unit}{shortage > 0 ? ` · faltam ${shortage.toLocaleString('pt-BR')}` : ''}</p></div><Button type="button" size="sm" variant={current ? 'outline' : 'primary'} loading={saving === `reserve-${option.materialId}`} onClick={() => void execute(`reserve-${option.materialId}`, { action: 'RESERVATION_SET', materialId: option.materialId, quantity: current ? 0 : option.estimatedQuantity })}>{current ? <RotateCcw size={14} /> : <Boxes size={14} />}{current ? 'Liberar' : 'Reservar'}</Button></div>
                })}
              </div>
            </section>
          </div>
        ) : null}

        {tab === 'CUT' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 bg-[#FAFAFA] p-3 sm:grid-cols-4"><div><p className="text-[10px] uppercase text-[#888]">Área das peças</p><strong>{data.sheetEstimate.pieceAreaM2} m²</strong></div><div><p className="text-[10px] uppercase text-[#888]">Com perda</p><strong>{data.sheetEstimate.adjustedAreaM2} m²</strong></div><div><p className="text-[10px] uppercase text-[#888]">Chapas estimadas</p><strong>{data.sheetEstimate.estimatedSheets}</strong></div><div className="flex items-end justify-end"><a href={`/api/projects/${projectId}/operations/labels`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 border border-[#D9D9D9] bg-white px-3 text-xs font-semibold"><Printer size={14} /> Etiquetas</a></div></div>
            <div className="grid gap-2 border border-[#E5E5E5] p-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input label="Peça ou módulo" value={piece.label} onChange={(event) => setPiece((current) => ({ ...current, label: event.target.value }))} />
              <Input label="Ambiente" value={piece.environment} onChange={(event) => setPiece((current) => ({ ...current, environment: event.target.value }))} />
              <Input label="Material" value={piece.material} onChange={(event) => setPiece((current) => ({ ...current, material: event.target.value }))} />
              <Input label="Acabamento" value={piece.finish} onChange={(event) => setPiece((current) => ({ ...current, finish: event.target.value }))} />
              <Input label="Largura (mm)" type="number" value={piece.widthMm} onChange={(event) => setPiece((current) => ({ ...current, widthMm: event.target.value }))} />
              <Input label="Altura (mm)" type="number" value={piece.heightMm} onChange={(event) => setPiece((current) => ({ ...current, heightMm: event.target.value }))} />
              <Input label="Quantidade" type="number" value={piece.quantity} onChange={(event) => setPiece((current) => ({ ...current, quantity: event.target.value }))} />
              <div className="flex items-end gap-2"><label className="flex h-10 items-center gap-2 border border-[#D9D9D9] px-3 text-xs"><input type="checkbox" checked={piece.grain} onChange={(event) => setPiece((current) => ({ ...current, grain: event.target.checked }))} /> Veio da madeira</label><Button type="button" loading={saving === 'piece'} onClick={async () => { const ok = await execute('piece', { action: 'PIECE_CREATE', ...piece }); if (ok) setPiece({ label: '', environment: '', material: 'MDF', finish: '', widthMm: '', heightMm: '', quantity: '1', grain: false }) }}>Adicionar</Button></div>
            </div>
            <div className="overflow-x-auto border border-[#E5E5E5]"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-[#F5F5F5] text-[#666]"><tr><th className="p-2">Peça</th><th>Medida</th><th>Material</th><th>Situação</th><th className="pr-2 text-right">Ações</th></tr></thead><tbody className="divide-y divide-[#EEE]">{data.pieces.map((item) => <tr key={item.id}><td className="p-2"><strong className="block text-sm">{item.label}</strong><span>{item.environment || 'Sem ambiente'} · {item.quantity}x</span></td><td>{item.widthMm} × {item.heightMm} mm</td><td>{item.material}{item.finish ? ` · ${item.finish}` : ''}</td><td><select value={item.status} onChange={(event) => void execute(`piece-${item.id}`, { action: 'PIECE_STATUS', pieceId: item.id, status: event.target.value })} className="h-8 border border-[#DDD] bg-white px-2">{Object.entries(PIECE_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="pr-2 text-right"><button type="button" title="Excluir peça" onClick={() => void execute(`piece-${item.id}`, { action: 'PIECE_DELETE', pieceId: item.id })} className="p-2 text-red-500"><Trash2 size={14} /></button></td></tr>)}{data.pieces.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-[#888]">Adicione as peças para calcular chapas e imprimir etiquetas.</td></tr> : null}</tbody></table></div>
          </div>
        ) : null}

        {tab === 'QUALITY' ? <div className="space-y-2">{data.quality.map((item) => <div key={item.key} className={`flex flex-col gap-3 border p-3 sm:flex-row sm:items-center sm:justify-between ${item.status === 'ISSUE' ? 'border-red-200 bg-red-50' : item.status === 'PASSED' ? 'border-emerald-200 bg-emerald-50' : 'border-[#E5E5E5]'}`}><div className="flex items-start gap-2">{item.status === 'ISSUE' ? <AlertTriangle size={17} className="mt-0.5 text-red-600" /> : <CheckCircle2 size={17} className={`mt-0.5 ${item.status === 'PASSED' ? 'text-emerald-600' : 'text-[#BBB]'}`} />}<div><p className="text-sm font-semibold">{item.label}</p>{item.checkedBy ? <p className="text-xs text-[#777]">Conferido por {item.checkedBy.name}{item.checkedAt ? ` em ${formatDate(item.checkedAt)}` : ''}</p> : null}</div></div><div className="flex gap-1"><Button type="button" size="sm" variant="outline" onClick={() => void execute(`quality-${item.key}`, { action: 'QUALITY_SET', key: item.key, status: 'ISSUE' })}>Com problema</Button><Button type="button" size="sm" onClick={() => void execute(`quality-${item.key}`, { action: 'QUALITY_SET', key: item.key, status: 'PASSED' })}>Aprovado</Button></div></div>)}</div> : null}

        {tab === 'CHANGES' ? <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]"><section className="space-y-3 border border-[#E5E5E5] p-4"><h4 className="text-sm font-semibold">Nova alteração do cliente</h4><Input label="Título" value={change.title} onChange={(event) => setChange((current) => ({ ...current, title: event.target.value }))} /><Textarea label="O que mudou" rows={4} value={change.description} onChange={(event) => setChange((current) => ({ ...current, description: event.target.value }))} /><div className="grid grid-cols-2 gap-2"><Input label="Ajuste de valor" type="number" step="0.01" value={change.amountDelta} onChange={(event) => setChange((current) => ({ ...current, amountDelta: event.target.value }))} /><Input label="Dias úteis extras" type="number" value={change.daysDelta} onChange={(event) => setChange((current) => ({ ...current, daysDelta: event.target.value }))} /></div><Button type="button" className="w-full" loading={saving === 'change'} onClick={async () => { const ok = await execute('change', { action: 'CHANGE_CREATE', ...change }); if (ok) setChange({ title: '', description: '', amountDelta: '0', daysDelta: '0' }) }}><FileSignature size={14} /> Registrar alteração</Button></section><section className="divide-y divide-[#EEE] border border-[#E5E5E5]">{data.changes.map((item) => <div key={item.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-[#666]">{item.description}</p></div><span className="text-xs font-semibold text-[#FF6B00]">{CHANGE_STATUS[item.status]}</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span>{formatCurrency(item.amountDelta)} · {item.daysDelta} dia(s) útil(eis)</span>{item.status !== 'APPROVED' && item.status !== 'REJECTED' ? <div className="flex gap-1"><Button type="button" size="sm" variant="outline" onClick={() => void execute(`change-${item.id}`, { action: 'CHANGE_STATUS', changeId: item.id, status: 'SENT' })}>Enviada</Button><Button type="button" size="sm" onClick={() => void execute(`change-${item.id}`, { action: 'CHANGE_STATUS', changeId: item.id, status: 'APPROVED' })}>Aprovar</Button></div> : null}</div></div>)}{data.changes.length === 0 ? <p className="p-8 text-center text-sm text-[#888]">Nenhuma alteração registrada.</p> : null}</section></div> : null}

        {tab === 'DELIVERY' ? <div className="space-y-3">{data.proofs.map((proof) => <div key={proof.id} className="border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><PackageCheck size={17} /> Entrega confirmada por {proof.confirmedBy}</div><p className="mt-1 text-xs text-emerald-700">{formatDate(proof.deliveredAt)} · {Object.values(proof.checklist).filter(Boolean).length} itens conferidos</p>{proof.notes ? <p className="mt-2 text-sm text-[#555]">{proof.notes}</p> : null}</div>)}{data.proofs.length === 0 ? <div className="border border-[#E5E5E5] p-8 text-center"><PackageCheck className="mx-auto text-[#BBB]" size={26} /><p className="mt-2 text-sm text-[#777]">O comprovante será criado ao finalizar uma instalação.</p></div> : null}</div> : null}
      </CardBody>
    </Card>
  )
}
