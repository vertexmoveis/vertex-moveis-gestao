'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, Loader2, Send, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { dateOnlyKey, formatDateOnly } from '@/lib/date-only'
import { formatCurrency } from '@/lib/utils'
import type { PurchaseMaterial } from './purchases-board'

type PurchaseOrder = {
  id: string
  supplier: string
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'
  expectedAt: string | null
  notes: string | null
  createdAt: string
  items: Array<{
    id: string
    quantity: number
    receivedQuantity: number
    unitCost: number
    material: { id: string; name: string; unit: string }
    project: { id: string; name: string; client: { name: string } } | null
  }>
}

const STATUS = {
  DRAFT: 'Rascunho',
  SENT: 'Enviado ao fornecedor',
  PARTIAL: 'Recebido parcialmente',
  RECEIVED: 'Recebido',
  CANCELLED: 'Cancelado',
} as const

export function PurchaseOrdersPanel({ materials }: { materials: PurchaseMaterial[] }) {
  const candidates = useMemo(() => materials.filter((item) => item.materialId && item.status !== 'RECEIVED'), [materials])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [supplier, setSupplier] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    const response = await fetch('/api/purchase-orders', { cache: 'no-store' })
    const payload = await response.json().catch(() => [])
    setLoading(false)
    if (!response.ok) return setMessage(payload.error || 'Não foi possível carregar os pedidos.')
    setOrders(payload)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const create = async () => {
    const chosen = candidates.filter((item) => selected.includes(item.id))
    if (supplier.trim().length < 2 || chosen.length === 0) {
      setMessage('Informe o fornecedor e selecione ao menos um material.')
      return
    }
    setBusy('create')
    setMessage('')
    const response = await fetch('/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplier,
        expectedAt: expectedAt || null,
        notes: notes || null,
        items: chosen.map((item) => ({
          materialId: item.materialId,
          projectId: item.projectId,
          quantity: Math.max(item.estimatedQuantity - item.purchasedQuantity - item.reservedQuantity, 0.01),
          unitCost: item.estimatedQuantity > 0 ? item.estimatedCost / item.estimatedQuantity : 0,
        })),
      }),
    })
    const payload = await response.json().catch(() => null)
    setBusy('')
    if (!response.ok) return setMessage(payload?.error || 'Não foi possível criar o pedido.')
    setSupplier('')
    setExpectedAt('')
    setNotes('')
    setSelected([])
    setMessage('Pedido criado. Agora você pode marcar como enviado ao fornecedor.')
    await load()
  }

  const updateStatus = async (orderId: string, status: PurchaseOrder['status']) => {
    setBusy(orderId)
    setMessage('')
    const response = await fetch(`/api/purchase-orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const payload = await response.json().catch(() => null)
    setBusy('')
    if (!response.ok) return setMessage(payload?.error || 'Não foi possível atualizar o pedido.')
    await load()
  }

  if (loading) return <div className="flex min-h-64 items-center justify-center border border-[#E8E8E8] bg-white"><Loader2 size={22} className="animate-spin text-[#FF6B00]" /></div>

  return (
    <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
      <section className="border border-[#E8E8E8] bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><ClipboardList size={16} className="text-[#FF6B00]" /> Novo pedido de compra</h2>
        <div className="mt-4 space-y-3">
          <Input label="Fornecedor" value={supplier} onChange={(event) => setSupplier(event.target.value)} />
          <Input label="Previsão de entrega" type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} />
          <Textarea label="Observação" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <div className="mt-4 max-h-72 divide-y divide-[#EEE] overflow-y-auto border border-[#E8E8E8]">
          {candidates.map((item) => (
            <label key={item.id} className="flex cursor-pointer items-start gap-2 p-3 hover:bg-[#FAFAFA]">
              <input type="checkbox" className="mt-1" checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
              <span className="min-w-0"><strong className="block truncate text-xs">{item.materialName}{item.finish ? ` · ${item.finish}` : ''}</strong><span className="block text-[11px] text-[#777]">{item.project.name} · {item.project.client.name}</span></span>
            </label>
          ))}
          {candidates.length === 0 ? <p className="p-5 text-center text-xs text-[#888]">Não há material de catálogo aguardando compra.</p> : null}
        </div>
        <Button type="button" className="mt-3 w-full" loading={busy === 'create'} onClick={() => void create()}>Criar pedido</Button>
        {message ? <p role="status" className="mt-3 text-xs text-[#666]">{message}</p> : null}
      </section>

      <section className="space-y-3">
        {orders.map((order) => {
          const total = order.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
          return (
            <div key={order.id} className="border border-[#E8E8E8] bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-sm font-semibold">{order.supplier}</p><p className="mt-1 text-xs text-[#777]">{STATUS[order.status]} · criado em {formatDateOnly(dateOnlyKey(new Date(order.createdAt)))}</p>{order.expectedAt ? <p className="text-xs text-[#777]">Entrega prevista: {formatDateOnly(dateOnlyKey(new Date(order.expectedAt)))}</p> : null}</div>
                <strong className="text-sm text-[#FF6B00]">{formatCurrency(total)}</strong>
              </div>
              <div className="mt-3 divide-y divide-[#EEE] border-y border-[#EEE]">
                {order.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-xs"><span>{item.material.name}{item.project ? ` · ${item.project.name}` : ''}</span><strong>{item.quantity.toLocaleString('pt-BR')} {item.material.unit}</strong></div>)}
              </div>
              {order.notes ? <p className="mt-2 text-xs text-[#666]">{order.notes}</p> : null}
              {order.status !== 'RECEIVED' && order.status !== 'CANCELLED' ? <div className="mt-3 flex flex-wrap justify-end gap-2">{order.status === 'DRAFT' ? <Button type="button" size="sm" variant="outline" loading={busy === order.id} onClick={() => void updateStatus(order.id, 'SENT')}><Send size={13} /> Marcar enviado</Button> : null}<Button type="button" size="sm" variant="outline" loading={busy === order.id} onClick={() => void updateStatus(order.id, 'CANCELLED')}><XCircle size={13} /> Cancelar</Button><Button type="button" size="sm" loading={busy === order.id} onClick={() => void updateStatus(order.id, 'RECEIVED')}><CheckCircle2 size={13} /> Receber tudo</Button></div> : null}
            </div>
          )
        })}
        {orders.length === 0 ? <div className="border border-dashed border-[#D9D9D9] bg-white p-12 text-center text-sm text-[#777]">Nenhum pedido de compra criado.</div> : null}
      </section>
    </div>
  )
}
