import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildProjectContractSnapshot,
  createProjectContractToken,
  decryptProjectContractToken,
  hashProjectContractToken,
  isInPersonProjectContractSignature,
  parseProjectContractSnapshot,
} from '../lib/project-contracts'
import { isLowStock, stockShortage } from '../lib/inventory'
import { summarizeOperationalHealth } from '../lib/health-monitor'
import { renderProjectContractPdf, renderSignedProjectContractPdf } from '../lib/project-contract-pdf'

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
    paymentMethod: 'CARD',
    cardFeePercent: 3,
    cardFeeAmount: '240',
    downPayment: '2000',
    installmentCount: 2,
    installmentValue: '4000',
    client: { name: 'Cliente', street: 'Rua A', number: '10', city: 'Cotia', state: 'SP' },
    environments: [{ name: 'Cozinha' }],
    sourceQuote: {
      number: 12,
      variationName: 'Branco TX externo',
      items: [{
        environment: 'Cozinha',
        environmentName: 'Cozinha',
        description: 'Armário aéreo',
        furnitureModel: 'Armário aéreo',
        placement: 'Parede da pia',
        material: 'MDF',
        finish: 'Branco TX externo',
        quantity: 2,
        width: 150,
        height: 70,
        unitPrice: '1000',
        total: '2000',
        notes: 'Com fechamento suave',
      }],
    },
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
  assert.equal(snapshot.payment.methodLabel, 'Cartão parcelado')
  assert.match(snapshot.payment.summary || '', /Entrada de .*2\.000,00 \+ 2x de .*4\.000,00 no cartão/)
  assert.equal(snapshot.payment.cardFeeAmount, 240)
  assert.equal(snapshot.client.address, 'Rua A, 10, Cotia - SP')
  assert.equal(snapshot.client.city, 'Cotia')
  assert.equal(snapshot.project.quoteNumber, 12)
  assert.equal(snapshot.project.variationName, 'Branco TX externo')
  assert.deepEqual(snapshot.project.scope, [{
    environment: 'Cozinha',
    furniture: ['2x Armário aéreo - Parede da pia'],
    specifications: ['MDF - Branco TX externo'],
    items: [{
      description: 'Armário aéreo',
      placement: 'Parede da pia',
      dimensions: '1500 x 700 mm',
      material: 'MDF',
      finish: 'Branco TX externo',
      notes: 'Com fechamento suave',
      quantity: 2,
      unitPrice: 1000,
      total: 2000,
    }],
  }])
  assert.equal(snapshot.terms.length, 16)
  assert.equal(parseProjectContractSnapshot(snapshot)?.project.name, 'Cozinha')
})

test('gera o novo contrato assinado como PDF de três páginas', async () => {
  const snapshot = buildProjectContractSnapshot({
    id: 'project-pdf',
    name: 'Cozinha e dormitório',
    room: 'Cozinha, Dormitório',
    value: 34900,
    deliveryBusinessDays: 30,
    paymentMethod: 'CARD',
    downPayment: 15000,
    installmentCount: 1,
    installmentValue: 19900,
    firstInstallmentDate: new Date('2026-08-12T12:00:00Z'),
    client: { name: 'Matheus Rodrigues', city: 'Cotia', state: 'SP' },
    environments: [{ name: 'Cozinha' }, { name: 'Dormitório' }],
    payments: [
      { installmentNumber: 0, type: 'DOWN_PAYMENT', amount: 15000, dueDate: new Date('2026-07-12T12:00:00Z') },
      { installmentNumber: 1, type: 'INSTALLMENT', amount: 19900, dueDate: new Date('2026-08-12T12:00:00Z') },
    ],
  }, { tradeName: 'Vertex Móveis', city: 'Cotia', state: 'SP' })

  const pdf = await renderSignedProjectContractPdf({
    id: 'contract-test',
    version: 2,
    snapshot,
    signedAt: new Date('2026-08-03T15:00:00Z'),
    signatoryName: 'Matheus Rodrigues',
    signatoryDocument: null,
    acceptedIpHash: 'abc123'.repeat(10),
    acceptedUserAgent: 'Browser de teste',
  })

  assert.equal(pdf.subarray(0, 4).toString(), '%PDF')
  assert.ok(pdf.length > 5000)

  const unsignedPdf = await renderProjectContractPdf({
    id: 'contract-test',
    version: 2,
    snapshot,
  })
  const pages = Buffer.from(unsignedPdf)
    .toString('latin1')
    .match(/\/Type\s*\/Page\b/g)
  const pageSizes = [...Buffer.from(unsignedPdf)
    .toString('latin1')
    .matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)]

  assert.equal(unsignedPdf.subarray(0, 4).toString(), '%PDF')
  assert.equal(pages?.length, 3)
  assert.equal(pageSizes.length, 3)
  assert.ok(pageSizes.every(([, width, height]) => (
    Math.abs(Number(width) - 595.28) < 0.1
    && Math.abs(Number(height) - 841.89) < 0.1
  )))
})

test('gera registro de assinatura presencial sem evidências de aceite digital', async () => {
  const snapshot = buildProjectContractSnapshot({
    id: 'project-in-person',
    name: 'Móveis planejados casa',
    room: 'Casa completa',
    value: 59220.35,
    deliveryBusinessDays: 30,
    paymentMethod: 'BOLETO',
    downPayment: 19222,
    installmentCount: 11,
    installmentValue: 3636.21,
    firstInstallmentDate: new Date('2026-09-20T12:00:00Z'),
    client: { name: 'Paulo Henrique Campos de Souza', city: 'Cotia', state: 'SP' },
    environments: [{ name: 'Cozinha' }, { name: 'Sala' }],
    payments: [
      { installmentNumber: 0, type: 'DOWN_PAYMENT', amount: 19222, dueDate: new Date('2026-08-22T12:00:00Z') },
      ...Array.from({ length: 11 }, (_, index) => ({
        installmentNumber: index + 1,
        type: 'INSTALLMENT',
        amount: index === 10 ? 3636.25 : 3636.21,
        dueDate: new Date(Date.UTC(2026, 8 + index, 20, 12)),
      })),
    ],
  }, { tradeName: 'Vertex Móveis', city: 'Cotia', state: 'SP' })

  const pdf = await renderSignedProjectContractPdf({
    id: 'contract-in-person',
    version: 2,
    snapshot,
    signedAt: new Date('2026-08-22T12:00:00Z'),
    signatoryName: 'Paulo Henrique Campos de Souza',
    acceptedIpHash: null,
    acceptedUserAgent: null,
    signatureMethod: 'IN_PERSON',
    signatureRecordedAt: new Date('2026-08-24T14:00:00Z'),
    signatureRecordedByName: 'Eduardo Alves Martins',
    signatureNote: 'Via física é a evidência original.',
  })

  assert.equal(isInPersonProjectContractSignature('IN_PERSON'), true)
  assert.equal(isInPersonProjectContractSignature('DIGITAL'), false)
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF')
  assert.ok(pdf.length > 5000)
})

test('mantém pedido extenso com doze parcelas em três páginas', async () => {
  const items = Array.from({ length: 14 }, (_, index) => ({
    environment: index < 8 ? 'Cozinha' : 'Dormitório',
    environmentName: index < 8 ? 'Cozinha' : 'Dormitório',
    description: index < 8 ? `Armário planejado ${index + 1}` : `Módulo planejado ${index - 7}`,
    furnitureModel: index < 8 ? `Armário planejado ${index + 1}` : `Módulo planejado ${index - 7}`,
    placement: index % 2 === 0 ? 'Parede principal' : 'Parede lateral',
    material: 'MDF',
    finish: index % 2 === 0 ? 'Branco TX externo' : 'Madeirado externo - branco interno',
    quantity: 1,
    width: 80,
    height: 70,
    unitPrice: 1500,
    total: 1500,
  }))
  const payments = Array.from({ length: 12 }, (_, index) => ({
    installmentNumber: index + 1,
    type: 'INSTALLMENT',
    amount: 1750,
    dueDate: new Date(Date.UTC(2026, 7 + index, 1, 12)),
  }))
  const snapshot = buildProjectContractSnapshot({
    id: 'project-long-pdf',
    name: 'Cozinha planejada',
    room: 'Cozinha',
    value: 21000,
    deliveryBusinessDays: 30,
    paymentMethod: 'CARD',
    downPayment: 0,
    installmentCount: 12,
    installmentValue: 1750,
    firstInstallmentDate: new Date('2026-08-01T12:00:00Z'),
    client: { name: 'Cliente de teste', city: 'Cotia', state: 'SP' },
    environments: [{ name: 'Cozinha' }, { name: 'Dormitório' }],
    sourceQuote: {
      number: 17,
      variationName: 'Branco TX externo',
      items,
    },
    payments,
  }, { tradeName: 'Vertex Móveis', city: 'Cotia', state: 'SP' })

  const pdf = await renderProjectContractPdf({
    id: 'contract-long-test',
    version: 2,
    snapshot,
  })
  const pages = Buffer.from(pdf)
    .toString('latin1')
    .match(/\/Type\s*\/Page\b/g)

  assert.equal(pdf.subarray(0, 4).toString(), '%PDF')
  assert.equal(pages?.length, 3)
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
