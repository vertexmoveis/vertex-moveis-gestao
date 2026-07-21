'use client'

import { Plus, Save, Trash2, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'

type ExpenseCategory = 'LABOR' | 'FREIGHT' | 'INSTALLATION' | 'CONSUMABLES' | 'REWORK' | 'OTHER'

type ProjectExpense = {
  id: string
  category: ExpenseCategory
  description: string
  amount: number
  incurredAt: string
  supplier: string | null
  notes: string | null
}

const categories: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'LABOR', label: 'Mão de obra' },
  { value: 'FREIGHT', label: 'Frete' },
  { value: 'INSTALLATION', label: 'Instalação' },
  { value: 'CONSUMABLES', label: 'Consumíveis' },
  { value: 'REWORK', label: 'Retrabalho' },
  { value: 'OTHER', label: 'Outros' },
]

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function ProjectExpensesCard({ projectId, onExpensesChange }: { projectId: string; onExpensesChange?: (total: number) => void }) {
  const [expenses, setExpenses] = useState<ProjectExpense[]>([])
  const [draft, setDraft] = useState({ category: 'LABOR' as ExpenseCategory, description: '', amount: '', incurredAt: today(), supplier: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const total = useMemo(() => expenses.reduce((sum, expense) => sum + Math.max(Number(expense.amount) || 0, 0), 0), [expenses])

  useEffect(() => {
    let active = true
    fetch(`/api/projects/${projectId}/expenses`)
      .then(async (response) => {
        const data = await response.json().catch(() => [])
        if (!active) return
        if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar as despesas.')
        setExpenses(Array.isArray(data) ? data : [])
      })
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as despesas.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [projectId])

  useEffect(() => {
    onExpensesChange?.(total)
  }, [onExpensesChange, total])

  const addExpense = async () => {
    setSavingId('new')
    setError('')
    const response = await fetch(`/api/projects/${projectId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...draft,
        amount: Number(draft.amount.replace(',', '.')),
        supplier: draft.supplier || null,
        notes: draft.notes || null,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setSavingId('')
    if (!response.ok) return setError(data?.error || 'Não foi possível registrar a despesa.')
    setExpenses((current) => [data, ...current])
    setDraft({ category: 'LABOR', description: '', amount: '', incurredAt: today(), supplier: '', notes: '' })
  }

  const updateExpense = <K extends keyof ProjectExpense>(id: string, field: K, value: ProjectExpense[K]) => {
    setExpenses((current) => current.map((expense) => expense.id === id ? { ...expense, [field]: value } : expense))
  }

  const saveExpense = async (expense: ProjectExpense) => {
    setSavingId(expense.id)
    setError('')
    const response = await fetch(`/api/projects/${projectId}/expenses/${expense.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        incurredAt: expense.incurredAt.slice(0, 10),
        supplier: expense.supplier,
        notes: expense.notes,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setSavingId('')
    if (!response.ok) return setError(data?.error || 'Não foi possível atualizar a despesa.')
    setExpenses((current) => current.map((item) => item.id === expense.id ? data : item))
  }

  const removeExpense = async (expense: ProjectExpense) => {
    if (!window.confirm(`Excluir a despesa "${expense.description}"?`)) return
    setSavingId(expense.id)
    setError('')
    const response = await fetch(`/api/projects/${projectId}/expenses/${expense.id}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    setSavingId('')
    if (!response.ok) return setError(data?.error || 'Não foi possível excluir a despesa.')
    setExpenses((current) => current.filter((item) => item.id !== expense.id))
  }

  return (
    <Card id="despesas" className="scroll-mt-28">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <WalletCards size={17} className="mt-0.5 text-[#FF6B00]" />
            <div><h3 className="text-sm font-semibold text-[#121212]">Custos reais adicionais</h3><p className="mt-1 text-xs text-[#9E9E9E]">Mão de obra, frete, instalação e retrabalho</p></div>
          </div>
          <p className="text-sm font-bold text-[#121212]">{formatCurrency(total)}</p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
        <div className="border-l-4 border-[#FF6B00] bg-[#FAFAFA] p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-[#444]">Categoria
              <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as ExpenseCategory }))} className="mt-1 h-9 w-full rounded-lg border border-[#D9D9D9] bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-[#FF6B00]">
                {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
            </label>
            <Input label="Descrição" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
            <Input label="Valor (R$)" type="number" min={0.01} step="0.01" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} />
            <Input label="Data" type="date" value={draft.incurredAt} onChange={(event) => setDraft((current) => ({ ...current, incurredAt: event.target.value }))} />
            <Input label="Fornecedor ou profissional" value={draft.supplier} onChange={(event) => setDraft((current) => ({ ...current, supplier: event.target.value }))} />
            <Input label="Observação" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
          </div>
          <div className="mt-3 flex justify-end"><Button type="button" size="sm" loading={savingId === 'new'} disabled={!draft.description || !(Number(draft.amount) > 0)} onClick={() => void addExpense()}><Plus size={14} /> Registrar despesa</Button></div>
        </div>

        {loading ? <div className="h-24 animate-pulse rounded-lg bg-[#F5F5F5]" /> : expenses.length === 0 ? (
          <p className="py-5 text-center text-sm text-[#9E9E9E]">Nenhuma despesa adicional registrada.</p>
        ) : (
          <div className="divide-y divide-[#ECECEC] border border-[#E8E8E8]">
            {expenses.map((expense) => (
              <div key={expense.id} className="space-y-3 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-[#444]">Categoria
                    <select value={expense.category} onChange={(event) => updateExpense(expense.id, 'category', event.target.value as ExpenseCategory)} className="mt-1 h-9 w-full rounded-lg border border-[#D9D9D9] bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-[#FF6B00]">
                      {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                    </select>
                  </label>
                  <Input label="Descrição" value={expense.description} onChange={(event) => updateExpense(expense.id, 'description', event.target.value)} />
                  <Input label="Valor (R$)" type="number" min={0.01} step="0.01" value={expense.amount} onChange={(event) => updateExpense(expense.id, 'amount', Number(event.target.value))} />
                  <Input label="Data" type="date" value={expense.incurredAt.slice(0, 10)} onChange={(event) => updateExpense(expense.id, 'incurredAt', event.target.value)} />
                  <Input label="Fornecedor ou profissional" value={expense.supplier || ''} onChange={(event) => updateExpense(expense.id, 'supplier', event.target.value || null)} />
                  <Input label="Observação" value={expense.notes || ''} onChange={(event) => updateExpense(expense.id, 'notes', event.target.value || null)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" loading={savingId === expense.id} onClick={() => void saveExpense(expense)}><Save size={14} /> Salvar</Button>
                  <Button type="button" size="sm" variant="ghost" disabled={savingId === expense.id} onClick={() => void removeExpense(expense)} title="Excluir despesa"><Trash2 size={14} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
