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
    <div className="z-30 -mx-2 border-t border-[#D8D8D8] bg-white px-2 pb-1 pt-3 md:sticky md:bottom-0 md:bg-white/95 md:backdrop-blur-sm">
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#121212] p-4 text-white md:grid-cols-5">
        <div><p className="text-xs text-white/50">Subtotal</p><p className="text-base font-semibold">{formatCurrency(subtotal)}</p></div>
        <div><p className="text-xs text-white/50">Descontos</p><p className="text-base font-semibold">{formatCurrency(discount)}</p></div>
        <div><p className="text-xs text-white/50">Custo</p><p className="text-base font-semibold">{formatCurrency(costTotal)}</p></div>
        <div><p className="text-xs text-white/50">Lucro previsto</p><p className="text-base font-semibold text-emerald-300">{formatCurrency(profit)}</p></div>
        <div><p className="text-xs text-white/50">Total</p><p className="text-lg font-bold text-[#FFB06B]">{formatCurrency(total)}</p></div>
      </div>

      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
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
