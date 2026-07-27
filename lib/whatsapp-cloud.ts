import { createHmac, timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const WHATSAPP_MESSAGE_KINDS = [
  'QUOTE_REMINDER',
  'PAYMENT_REMINDER',
  'INSTALLATION_REMINDER',
  'POST_SALE',
] as const

export type WhatsAppMessageKind = (typeof WHATSAPP_MESSAGE_KINDS)[number]

const templateEnvironment: Record<WhatsAppMessageKind, string> = {
  QUOTE_REMINDER: 'WHATSAPP_TEMPLATE_QUOTE_REMINDER',
  PAYMENT_REMINDER: 'WHATSAPP_TEMPLATE_PAYMENT_REMINDER',
  INSTALLATION_REMINDER: 'WHATSAPP_TEMPLATE_INSTALLATION_REMINDER',
  POST_SALE: 'WHATSAPP_TEMPLATE_POST_SALE',
}

type DispatchInput = {
  dedupeKey: string
  kind: WhatsAppMessageKind
  phone: string | null | undefined
  clientName?: string | null
  quoteId?: string | null
  projectId?: string | null
  paymentId?: string | null
  bodyParameters: string[]
}

type MetaResponse = {
  messages?: Array<{ id?: string }>
  error?: {
    message?: string
    error_data?: { details?: string }
  }
}

export function normalizeWhatsAppNumber(value: string | null | undefined) {
  let digits = (value || '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  if (!digits.startsWith('55') || (digits.length !== 12 && digits.length !== 13)) return null
  return digits
}

function templateName(kind: WhatsAppMessageKind) {
  return process.env[templateEnvironment[kind]]?.trim() || ''
}

export function getWhatsAppIntegrationStatus() {
  const providerConfigured = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim()
    && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  )
  const webhookConfigured = Boolean(
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim()
    && process.env.WHATSAPP_APP_SECRET?.trim()
  )
  const templates = Object.fromEntries(WHATSAPP_MESSAGE_KINDS.map((kind) => [
    kind,
    Boolean(templateName(kind)),
  ])) as Record<WhatsAppMessageKind, boolean>

  return {
    providerConfigured,
    webhookConfigured,
    templates,
    ready: providerConfigured && webhookConfigured && Object.values(templates).every(Boolean),
  }
}

async function sendTemplateMessage(input: {
  to: string
  name: string
  parameters: string[]
}) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim()
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  if (!accessToken || !phoneNumberId) throw new Error('Integração oficial do WhatsApp não configurada.')

  const configuredVersion = process.env.WHATSAPP_GRAPH_VERSION?.trim() || 'v25.0'
  const graphVersion = /^v\d+\.\d+$/.test(configuredVersion) ? configuredVersion : 'v25.0'
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to,
      type: 'template',
      template: {
        name: input.name,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'pt_BR' },
        components: input.parameters.length > 0
          ? [{
              type: 'body',
              parameters: input.parameters.map((text) => ({ type: 'text', text: text.slice(0, 1024) })),
            }]
          : undefined,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const payload = await response.json().catch(() => ({})) as MetaResponse
  if (!response.ok) {
    throw new Error(
      payload.error?.error_data?.details
      || payload.error?.message
      || `O WhatsApp respondeu com status ${response.status}.`,
    )
  }
  const providerMessageId = payload.messages?.[0]?.id
  if (!providerMessageId) throw new Error('O WhatsApp não confirmou o identificador da mensagem.')
  return providerMessageId
}

export async function dispatchWhatsAppTemplate(input: DispatchInput) {
  const integration = getWhatsAppIntegrationStatus()
  if (!integration.providerConfigured) return { status: 'skipped' as const, reason: 'provider_not_configured' }

  const name = templateName(input.kind)
  if (!name) return { status: 'skipped' as const, reason: 'template_not_configured' }

  const recipient = normalizeWhatsAppNumber(input.phone)
  if (!recipient) return { status: 'skipped' as const, reason: 'invalid_phone' }

  let message
  try {
    message = await prisma.whatsAppMessage.create({
      data: {
        dedupeKey: input.dedupeKey,
        kind: input.kind,
        recipient,
        clientName: input.clientName || null,
        quoteId: input.quoteId || null,
        projectId: input.projectId || null,
        paymentId: input.paymentId || null,
        templateName: name,
        status: 'PENDING',
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { status: 'duplicate' as const }
    }
    throw error
  }

  try {
    const providerMessageId = await sendTemplateMessage({
      to: recipient,
      name,
      parameters: input.bodyParameters,
    })
    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: 'SENT',
        providerMessageId,
        sentAt: new Date(),
        error: null,
      },
    })
    return { status: 'sent' as const, providerMessageId }
  } catch (error) {
    const errorMessage = (error instanceof Error ? error.message : 'Falha ao enviar mensagem.').slice(0, 800)
    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: 'FAILED',
        error: errorMessage,
        failedAt: new Date(),
      },
    }).catch(() => undefined)
    return { status: 'failed' as const, error: errorMessage }
  }
}

export function verifyWhatsAppWebhookSignature(rawBody: string, signature: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim()
  if (!appSecret || !signature?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const received = signature.slice('sha256='.length)
  if (expected.length !== received.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}
