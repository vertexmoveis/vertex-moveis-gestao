import assert from 'node:assert/strict'
import test from 'node:test'
import { quoteDocumentLabel } from '../lib/quotes'

test('mantém orçamento durante a negociação', () => {
  assert.equal(quoteDocumentLabel({ status: 'DRAFT' }), 'Orçamento')
  assert.equal(quoteDocumentLabel({ status: 'APPROVED' }), 'Orçamento')
})

test('muda o documento para pedido depois da venda', () => {
  assert.equal(quoteDocumentLabel({ status: 'SOLD' }), 'Pedido')
  assert.equal(quoteDocumentLabel({ status: 'APPROVED', convertedProjectId: 'project-1' }), 'Pedido')
  assert.equal(quoteDocumentLabel({ status: 'APPROVED', convertedProject: { id: 'project-1' } }), 'Pedido')
})
