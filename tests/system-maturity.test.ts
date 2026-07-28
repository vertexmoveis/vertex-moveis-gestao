import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildProjectContractSnapshot,
  createProjectContractToken,
  decryptProjectContractToken,
  hashProjectContractToken,
  parseProjectContractSnapshot,
} from '../lib/project-contracts'
import { isLowStock, stockShortage } from '../lib/inventory'
import { summarizeOperationalHealth } from '../lib/health-monitor'

test('token do contrato é criptografado e validado sem armazenar o valor aberto', () => {
  const previous = process.env.NEXTAUTH_SECRET
  process.env.NEXTAUTH_SECRET = 'vertex-test-secret-with-more-than-24-chars'
  try {
    const secure = createProjectContractToken()
    assert.notEqual(secure.tokenEncrypted, secure.token)
    assert.equal(decryptProjectContractToken(secure.tokenEncrypted), secure.token)
    assert.equal(secure.tokenHash, hashProjectContractToken(secure.token))
  } finally {
    process.env.NEXTAUTH_SECRET = previous
  }
})

test('snapshot do contrato congela valores, parcelas e partes', () => {
  const snapshot = buildProjectContractSnapshot({
    id: 'project-1',
    name: 'Cozinha',
    room: 'Cozinha',
    value: '10000.00',
    deliveryBusinessDays: 30,
    downPayment: '2000',
    installmentCount: 2,
    installmentValue: '4000',
    client: { name: 'Cliente', street: 'Rua A', number: '10', city: 'Cotia', state: 'SP' },
    environments: [{ name: 'Cozinha' }],
    payments: [
      { installmentNumber: 1, type: 'INSTALLMENT', amount: '4000', dueDate: new Date('2026-08-10T12:00:00Z') },
      { installmentNumber: 2, type: 'INSTALLMENT', amount: '4000', dueDate: new Date('2026-09-10T12:00:00Z') },
    ],
  }, {
    tradeName: 'Vertex Móveis',
    street: 'Rua Saturno',
    number: '6',
    city: 'Cotia',
    state: 'SP',
  })

  assert.equal(snapshot.project.value, 10000)
  assert.equal(snapshot.payment.schedule.length, 2)
  assert.equal(snapshot.client.address, 'Rua A, 10, Cotia - SP')
  assert.equal(parseProjectContractSnapshot(snapshot)?.project.name, 'Cozinha')
})

test('estoque só alerta quando existe mínimo configurado', () => {
  assert.equal(isLowStock(2, 5), true)
  assert.equal(stockShortage(2, 5), 3)
  assert.equal(isLowStock(0, 0), false)
  assert.equal(stockShortage(8, 5), 0)
})

test('saúde operacional diferencia falha crítica de configuração pendente', () => {
  const degraded = summarizeOperationalHealth({
    databaseOk: true,
    backupOk: true,
    backupMessage: 'Backup recente.',
    restoreOk: false,
    restoreMessage: 'Teste pendente.',
    recentErrorCount: 0,
    whatsappReady: false,
    scannerConfigured: false,
    alertWebhookConfigured: false,
  })
  assert.equal(degraded.status, 'degraded')

  const critical = summarizeOperationalHealth({
    databaseOk: false,
    backupOk: false,
    backupMessage: 'Backup indisponível.',
    restoreOk: false,
    restoreMessage: 'Teste indisponível.',
    recentErrorCount: 0,
    whatsappReady: false,
    scannerConfigured: false,
    alertWebhookConfigured: false,
  })
  assert.equal(critical.status, 'critical')
})
