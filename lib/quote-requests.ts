import { z } from 'zod'

export const REQUEST_STATUSES = ['RECEIVED', 'MISSING_INFO', 'IN_PROGRESS', 'READY', 'CANCELLED'] as const
export const REQUEST_LABELS: Record<typeof REQUEST_STATUSES[number], string> = {
  RECEIVED: 'Recebida', MISSING_INFO: 'Falta informação', IN_PROGRESS: 'Em elaboração', READY: 'Proposta pronta', CANCELLED: 'Cancelada',
}
const text = (max: number) => z.string().trim().max(max)
const optionalText = (max: number) => text(max).optional().transform(value => value || null)
const safeUrl = z.string().trim().max(2000).refine(value => {
  if (!value) return true
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}, 'Use um link completo com HTTPS.').optional().transform(value => value || null)
export const quoteRequestSchema = z.object({
  clientId: text(100).min(1, 'Selecione o cliente.'),
  assignedToId: text(100).min(1, 'Selecione o responsável.'),
  title: text(160).min(3, 'Informe o título.'),
  briefing: text(6000).min(10, 'Descreva o pedido e o resumo da reunião.'),
  environments: text(1000).min(2, 'Informe os ambientes.'),
  commercialOwner: text(160).min(2, 'Informe o responsável comercial.'),
  opportunityUrl: safeUrl,
  externalOpportunityId: optionalText(160),
  referenceUrl: safeUrl,
  desiredDeliveryDate: z.union([z.string().date(), z.literal('')]).optional(),
  dueDate: z.string().date('Informe a data de retorno do orçamento.'),
  nextAction: optionalText(1000),
}).strict()
export const requestProgressSchema = z.object({
  title: text(160).min(3).optional(),
  briefing: text(6000).min(10).optional(),
  environments: text(1000).min(2).optional(),
  commercialOwner: text(160).min(2).optional(),
  opportunityUrl: safeUrl.optional(),
  referenceUrl: safeUrl.optional(),
  status: z.enum(REQUEST_STATUSES),
  missingInformation: optionalText(2000),
  nextAction: optionalText(1000),
  dueDate: z.string().date().optional(),
  updatedAt: z.string().datetime(),
}).strict().refine(value => value.status !== 'MISSING_INFO' || Boolean(value.missingInformation), {
  message: 'Descreva as informações que faltam.', path: ['missingInformation'],
}).refine(value => value.status !== 'CANCELLED' || Boolean(value.nextAction), {
  message: 'Registre o motivo do cancelamento.', path: ['nextAction'],
})
export function requestScope(user: { id: string; role: string }) {
  return user.role === 'ADMIN' ? {} : { OR: [{ assignedToId: user.id }, { createdById: user.id }] }
}
