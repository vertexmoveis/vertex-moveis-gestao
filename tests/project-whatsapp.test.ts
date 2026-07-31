import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDeliverySchedulingWhatsAppMessage } from '@/lib/project-whatsapp'

test('mensagem de entrega identifica cliente, projeto, data, período e endereço', () => {
  const message = buildDeliverySchedulingWhatsAppMessage({
    clientName: 'Maria',
    projectName: 'Cozinha planejada',
    suggestedDate: '15/08/2026',
  })

  assert.match(message, /Olá, Maria/)
  assert.match(message, /Cozinha planejada/)
  assert.match(message, /15\/08\/2026/)
  assert.match(message, /manhã ou da tarde/)
  assert.match(message, /endereço de entrega/)
})

test('mensagem pergunta a melhor data quando o projeto ainda não tem previsão', () => {
  const message = buildDeliverySchedulingWhatsAppMessage({
    clientName: 'João',
    projectName: 'Dormitório',
  })

  assert.match(message, /Qual é o melhor dia/)
})
