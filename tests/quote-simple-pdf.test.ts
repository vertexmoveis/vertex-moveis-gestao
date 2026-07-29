import assert from 'node:assert/strict'
import test from 'node:test'
import { withCompanyProfileDefaults } from '../lib/company-profile'
import type { QuoteApprovalData } from '../lib/quote-approval'
import {
  renderSimpleQuotePdf,
  simpleQuotePdfFileName,
} from '../lib/quote-simple-pdf'

const quote: QuoteApprovalData = {
  id: 'quote-pdf-test',
  number: 42,
  title: 'Cozinha Planejada',
  variationType: 'WOODGRAIN',
  variationName: 'Madeirado',
  variationOrder: 1,
  createdAt: '2026-07-29T12:00:00.000Z',
  validUntil: '2026-08-05T12:00:00.000Z',
  deliveryBusinessDays: 30,
  firstInstallmentDate: '2026-08-10T12:00:00.000Z',
  installationFee: 500,
  manualDiscount: 0,
  paymentDiscount: 0,
  paymentMethod: 'CARD',
  cardInstallments: 3,
  cardDownPayment: 1500,
  subtotal: 9000,
  total: 9500,
  customerNotes: 'Medidas finais serão conferidas antes da fabricação.',
  client: {
    name: 'Cliente de Teste',
    document: null,
    phone: '(11) 99999-9999',
    whatsapp: '(11) 99999-9999',
    address: null,
    street: 'Rua Exemplo',
    number: '10',
    neighborhood: 'Centro',
    city: 'Cotia',
    state: 'SP',
    zipCode: '06700-000',
  },
  items: [
    {
      id: 'item-1',
      environment: 'KITCHEN',
      environmentName: 'Cozinha',
      description: 'Armário aéreo',
      material: 'MDF',
      finish: 'Branco TX',
      priceProfile: 'WOODGRAIN',
      placement: 'Parede da pia',
      sourceItemKey: null,
      width: 180,
      height: 70,
      quantity: 1,
      total: 4500,
      notes: null,
      accessories: [],
    },
    {
      id: 'item-2',
      environment: 'KITCHEN',
      environmentName: 'Cozinha',
      description: 'Gabinete de pia',
      material: 'MDF',
      finish: 'Branco TX',
      priceProfile: 'WOODGRAIN',
      placement: 'Sob a bancada',
      sourceItemKey: null,
      width: 180,
      height: 70,
      quantity: 1,
      total: 4500,
      notes: null,
      accessories: [],
    },
  ],
}

test('gera o orçamento simples como um PDF válido', async () => {
  const pdf = await renderSimpleQuotePdf({
    quote,
    company: withCompanyProfileDefaults(),
  })

  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-')
  assert.ok(pdf.byteLength > 2_000)
})

test('gera um nome de arquivo seguro e identificável', () => {
  assert.equal(
    simpleQuotePdfFileName(quote),
    'orcamento-0042-madeirado.pdf',
  )
})
