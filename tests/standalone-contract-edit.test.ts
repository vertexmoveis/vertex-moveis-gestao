import assert from 'node:assert/strict'
import test from 'node:test'
import { buildStandaloneContractSnapshot } from '@/lib/standalone-contracts'
import { standaloneContractEditForm, createStandaloneSchema, editStandaloneSchema } from '@/lib/standalone-contract-edit'

const input = {
  clientId: 'client-1', title: 'Cozinha planejada', description: 'Armários inferiores em MDF branco.\nIncluir bancada conforme visita.',
  value: 12500.75, paymentMethod: 'CARD' as const, downPayment: 2500.25,
  downPaymentDate: '2026-10-18', installmentCount: 4, firstInstallmentDate: '2026-11-20', deliveryBusinessDays: 45,
}
const client = { id: 'client-1', name: 'Cliente fictício', document: null, phone: null, whatsapp: null, email: null,
  address: null, street: null, number: null, neighborhood: null, city: null, state: null, zipCode: null }

test('edição recupera conteúdo, valores e datas exatos do contrato avulso', () => {
  const snapshot = buildStandaloneContractSnapshot(input, client, { tradeName: 'Vertex' })
  assert.deepEqual(standaloneContractEditForm({ clientId: client.id, standaloneTitle: input.title, snapshot }), input)
})

test('edição Pix preserva o vencimento original sem criar entrada ou parcelas novas', () => {
  const snapshot = buildStandaloneContractSnapshot({ ...input, paymentMethod: 'PIX' }, client, { tradeName: 'Vertex' })
  const form = standaloneContractEditForm({ clientId: client.id, standaloneTitle: input.title, snapshot })!
  assert.equal(form.paymentMethod, 'PIX')
  assert.equal(form.downPayment, 0)
  assert.equal(form.installmentCount, 1)
  assert.equal(form.firstInstallmentDate, '2026-11-20')
  assert.equal(form.downPaymentDate, '2026-11-20')
})

test('revisão exige identificação da versão carregada e rejeita datas e valores inválidos', () => {
  assert.equal(editStandaloneSchema.safeParse(input).success, false)
  assert.equal(editStandaloneSchema.safeParse({ ...input, updatedAt: '2026-10-19T12:00:00.000Z' }).success, true)
  for (const changes of [{ value: 0 }, { value: 10.001 }, { downPayment: 12500.75 }, { firstInstallmentDate: '2026-02-30' }, { installmentCount: 0 }]) {
    assert.equal(createStandaloneSchema.safeParse({ ...input, ...changes }).success, false)
  }
})

test('snapshot inválido não produz formulário vazio que possa substituir o conteúdo original', () => {
  assert.equal(standaloneContractEditForm({ clientId: client.id, standaloneTitle: 'Cozinha', snapshot: {} }), null)
})
