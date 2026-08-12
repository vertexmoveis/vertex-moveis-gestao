import { roundCurrency } from '@/lib/payments'

export const DELIVERY_CHECKS = [
  { key: 'ITEMS', label: 'Todos os módulos foram entregues' },
  { key: 'INSTALLATION', label: 'Portas, gavetas e ferragens foram testadas' },
  { key: 'CLEANING', label: 'Ambiente foi entregue limpo' },
  { key: 'CLIENT', label: 'Cliente conferiu o serviço' },
] as const

type WorkloadItem = { difficulty?: string | null }

export function calculateProductionWeight(environmentCount: number, items: WorkloadItem[]) {
  const difficultyWeight = items.reduce((total, item) => {
    if (item.difficulty === 'VERY_DIFFICULT') return total + 0.3
    if (item.difficulty === 'DIFFICULT') return total + 0.15
    return total
  }, 0)
  const raw = 0.5 + Math.max(environmentCount, 1) * 0.35 + items.length * 0.08 + difficultyWeight
  return Math.min(Math.max(Math.round(raw * 4) / 4, 1), 10)
}

export function availableStock(stock: number, reserved: number) {
  return Math.max(roundCurrency(stock - reserved), 0)
}
