import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyWhatsAppWebhookSignature } from '@/lib/whatsapp-cloud'

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: Array<{
          id?: string
          status?: string
          timestamp?: string
          errors?: Array<{ title?: string; message?: string; error_data?: { details?: string } }>
        }>
      }
    }>
  }>
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  const configuredToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim()

  if (mode !== 'subscribe' || !configuredToken || token !== configuredToken || !challenge) {
    return NextResponse.json({ error: 'Webhook não autorizado.' }, { status: 403 })
  }
  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifyWhatsAppWebhookSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
  }

  let payload: WhatsAppWebhookPayload
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Conteúdo inválido.' }, { status: 400 })
  }

  const statuses = (payload.entry || []).flatMap((entry) => (
    (entry.changes || []).flatMap((change) => change.value?.statuses || [])
  ))
  let updated = 0

  for (const status of statuses) {
    if (!status.id || !status.status) continue
    const occurredAt = status.timestamp && Number.isFinite(Number(status.timestamp))
      ? new Date(Number(status.timestamp) * 1000)
      : new Date()
    const error = status.errors?.[0]
    const errorMessage = error?.error_data?.details || error?.message || error?.title || null
    const normalizedStatus = status.status.toUpperCase()
    const data = normalizedStatus === 'DELIVERED'
      ? { status: normalizedStatus, deliveredAt: occurredAt }
      : normalizedStatus === 'READ'
        ? { status: normalizedStatus, readAt: occurredAt, deliveredAt: occurredAt }
        : normalizedStatus === 'FAILED'
          ? { status: normalizedStatus, failedAt: occurredAt, error: errorMessage?.slice(0, 800) || 'Falha informada pelo WhatsApp.' }
          : { status: normalizedStatus }

    const result = await prisma.whatsAppMessage.updateMany({
      where: { providerMessageId: status.id },
      data,
    })
    updated += result.count
  }

  return NextResponse.json({ success: true, updated })
}
