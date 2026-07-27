import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import {
  normalizeWhatsAppNumber,
  verifyWhatsAppWebhookSignature,
} from '@/lib/whatsapp-cloud'

test('normaliza celulares brasileiros e rejeita numeros incompletos', () => {
  assert.equal(normalizeWhatsAppNumber('(11) 99999-1234'), '5511999991234')
  assert.equal(normalizeWhatsAppNumber('+55 11 99999-1234'), '5511999991234')
  assert.equal(normalizeWhatsAppNumber('0011 99999-1234'), '5511999991234')
  assert.equal(normalizeWhatsAppNumber('1234'), null)
})

test('valida a assinatura HMAC do webhook oficial', () => {
  const previous = process.env.WHATSAPP_APP_SECRET
  const secret = 'segredo-de-teste'
  const body = '{"entry":[]}'
  process.env.WHATSAPP_APP_SECRET = secret
  const digest = createHmac('sha256', secret).update(body).digest('hex')

  assert.equal(verifyWhatsAppWebhookSignature(body, `sha256=${digest}`), true)
  assert.equal(verifyWhatsAppWebhookSignature(`${body}alterado`, `sha256=${digest}`), false)
  assert.equal(verifyWhatsAppWebhookSignature(body, null), false)

  if (previous === undefined) delete process.env.WHATSAPP_APP_SECRET
  else process.env.WHATSAPP_APP_SECRET = previous
})
