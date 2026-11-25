import type { WorkshopStockItemInput } from '@/lib/workshop-stock'

export type WorkshopStockPreset = Pick<WorkshopStockItemInput, 'name' | 'unit' | 'itemType'> & {
  category: string
}

const hardwarePresets: WorkshopStockPreset[] = [
  'Corrediça invisível',
  'Dobradiça curva',
  'Puxador',
  'Parafuso para MDF',
  'Ferragem',
  'Dobradiça reta',
  'Dobradiça supercurva',
  'Amortecedor para porta',
  'Corrediça telescópica',
  'Cantoneira de fixação',
  'Cavilha',
  'Fecho magnético',
  'Pistão a gás',
  'Suporte de prateleira',
  'Trilho para porta de correr',
  'Pé nivelador',
].map((name) => ({ name, itemType: 'HARDWARE', unit: 'unidade', category: 'Ferragens' }))

export const workshopStockPresets: readonly WorkshopStockPreset[] = [
  { name: 'Chapa de MDF', itemType: 'MDF_SHEET', unit: 'chapa', category: 'MDF' },
  { name: 'Fita de borda', itemType: 'OTHER', unit: 'metro', category: 'Acabamento' },
  ...hardwarePresets,
  { name: 'Retalho de MDF', itemType: 'MDF_OFFCUT', unit: 'unidade', category: 'MDF' },
  { name: 'Perfil de alumínio', itemType: 'OTHER', unit: 'metro', category: 'Acabamento' },
  { name: 'Lixa', itemType: 'OTHER', unit: 'unidade', category: 'Consumíveis' },
  { name: 'Cola para madeira', itemType: 'OTHER', unit: 'unidade', category: 'Consumíveis' },
  { name: 'Bucha de fixação', itemType: 'HARDWARE', unit: 'unidade', category: 'Ferragens' },
]
