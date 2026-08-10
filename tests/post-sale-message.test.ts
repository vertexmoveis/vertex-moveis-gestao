import assert from 'node:assert/strict'
import test from 'node:test'
import { withCompanyProfileDefaults } from '../lib/company-profile'
import {
  buildPostSaleMessage,
  buildPostSaleWhatsAppHref,
  normalizeWhatsAppNumber,
  resolveGoogleReviewUrl,
} from '../lib/post-sale-message'

test('monta a mensagem de pós-venda com cliente, projeto e avaliação', () => {
  const message = buildPostSaleMessage({
    clientName: 'Maria da Silva',
    projectName: 'Cozinha Planejada',
    companyName: 'Vertex Móveis',
    googleReviewUrl: 'https://g.page/r/exemplo/review',
  })

  assert.match(message, /Olá, Maria!/) 
  assert.match(message, /Cozinha Planejada/)
  assert.match(message, /https:\/\/g\.page\/r\/exemplo\/review/)
})

test('normaliza telefone brasileiro e gera o link do WhatsApp', () => {
  assert.equal(normalizeWhatsAppNumber('(11) 99999-9999'), '5511999999999')
  assert.equal(normalizeWhatsAppNumber('+55 11 99999-9999'), '5511999999999')

  const href = buildPostSaleWhatsAppHref({
    phone: '(11) 99999-9999',
    clientName: 'Maria da Silva',
    projectName: 'Cozinha',
    companyName: 'Vertex Móveis',
    googleReviewUrl: 'https://g.page/r/exemplo/review',
  })
  assert.match(href, /^https:\/\/wa\.me\/5511999999999\?text=/)
})

test('usa a busca da empresa quando o link direto ainda não foi configurado', () => {
  const url = resolveGoogleReviewUrl(withCompanyProfileDefaults())
  assert.match(url, /^https:\/\/www\.google\.com\/maps\/search/)
  assert.match(decodeURIComponent(url), /Vertex Móveis/)
})
