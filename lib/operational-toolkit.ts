import { roundCurrency } from '@/lib/payments'

export const QUALITY_CHECKS = [
  { key: 'MEASURES', label: 'Medidas conferidas com o projeto técnico' },
  { key: 'FINISH', label: 'Acabamento, fitas e cores conferidos' },
  { key: 'HARDWARE', label: 'Ferragens, portas e gavetas testadas' },
  { key: 'CLEANING', label: 'Móveis limpos e protegidos para transporte' },
  { key: 'PHOTOS', label: 'Fotos finais registradas no projeto' },
] as const

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

export function estimateSheets(
  pieces: Array<{ widthMm: number; heightMm: number; quantity: number }>,
  sheetWidthMm = 2750,
  sheetHeightMm = 1850,
  wastePercent = 15,
) {
  const pieceAreaM2 = pieces.reduce(
    (total, piece) => total + (Math.max(piece.widthMm, 0) * Math.max(piece.heightMm, 0) * Math.max(piece.quantity, 0)) / 1_000_000,
    0,
  )
  const sheetAreaM2 = Math.max(sheetWidthMm * sheetHeightMm, 1) / 1_000_000
  const adjustedAreaM2 = pieceAreaM2 * (1 + Math.max(wastePercent, 0) / 100)
  return {
    pieceAreaM2: roundCurrency(pieceAreaM2),
    adjustedAreaM2: roundCurrency(adjustedAreaM2),
    sheetAreaM2: roundCurrency(sheetAreaM2),
    estimatedSheets: pieceAreaM2 > 0 ? Math.ceil(adjustedAreaM2 / sheetAreaM2) : 0,
  }
}

export function availableStock(stock: number, reserved: number) {
  return Math.max(roundCurrency(stock - reserved), 0)
}

export function calculateCommission(projectValue: number, percent: number) {
  return roundCurrency(Math.max(projectValue, 0) * Math.max(percent, 0) / 100)
}

export function minutesBetween(startedAt: Date, endedAt: Date) {
  return Math.max(Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000), 1)
}
