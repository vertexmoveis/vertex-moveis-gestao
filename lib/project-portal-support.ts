export const PUBLIC_WARRANTY_CATEGORIES = [
  'DOOR_DRAWER',
  'HARDWARE',
  'FINISH',
  'INSTALLATION',
  'OTHER',
] as const

export type PublicWarrantyCategory = (typeof PUBLIC_WARRANTY_CATEGORIES)[number]

export const PUBLIC_WARRANTY_CATEGORY_LABELS: Record<PublicWarrantyCategory, string> = {
  DOOR_DRAWER: 'Porta ou gaveta',
  HARDWARE: 'Ferragem ou acessório',
  FINISH: 'Acabamento',
  INSTALLATION: 'Instalação',
  OTHER: 'Outro assunto',
}

export function warrantyDeadline(input: {
  actualEndDate: Date | null
  warrantyEndsAt: Date | null
}) {
  if (input.warrantyEndsAt) return input.warrantyEndsAt
  if (!input.actualEndDate) return null
  const deadline = new Date(input.actualEndDate)
  deadline.setUTCFullYear(deadline.getUTCFullYear() + 1)
  return deadline
}

export function canOpenPublicWarranty(input: {
  actualEndDate: Date | null
  warrantyEndsAt: Date | null
}, now = new Date()) {
  const deadline = warrantyDeadline(input)
  return Boolean(input.actualEndDate && deadline && deadline.getTime() >= now.getTime())
}
