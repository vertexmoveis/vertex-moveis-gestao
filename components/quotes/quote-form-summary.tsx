'use client'

import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

type QuoteFormSummaryProps = {
  subtotal: number
  discount: number
  costTotal: number
  profit: number
  total: number
  draftSavedAt: number | null
  isEditing: boolean
  saving: boolean
  onCancel: () => void
}

export function QuoteFormSummary({
  subtotal,
  discount,
  costTotal,
  profit,
  total,
  draftSavedAt,
  isEditing,
  saving,
  onCancel,
}: QuoteFormSummaryProps) {
  return (
    <div className="border-t border-[#E8E8E8] bg-white pt-4">
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] p-4 text-[#121212] sm:grid-cols-5">
        <div><p className="text-xs text-[#777]">Subtotal</p><p className="text-base font-semibold">{formatCurrency(subtotal)}</p></div>
        <div><p className="text-xs text-[#777]">Descontos</p><p className="text-base font-semibold">{formatCurrency(discount)}</p></div>
        <div><p className="text-xs text-[#777]">Custo</p><p className="text-base font-semibold">{formatCurrency(costTotal)}</p></div>
        <div><p className="text-xs text-[#777]">Lucro previsto</p><p className="text-base font-semibold text-emerald-700">{formatCurrency(profit)}</p></div>
        <div><p className="text-xs text-[#777]">Total</p><p className="text-lg font-bold text-[#E65C00]">{formatCurrency(total)}</p></div>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[#777]">
          {draftSavedAt
            ? `Rascunho salvo neste computador às ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(draftSavedAt))}.`
            : 'O rascunho será salvo automaticamente neste computador.'}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" loading={saving}>{isEditing ? 'Salvar Orçamento' : 'Criar Orçamento'}</Button>
        </div>
      </div>
    </div>
  )
}
