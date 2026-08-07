import assert from 'node:assert/strict'
import test from 'node:test'
import { automaticReservationQuantity, maxReservableQuantity } from '../lib/inventory-reservations'

test('reserva automática somente o saldo disponível', () => {
  assert.equal(automaticReservationQuantity({
    requiredQuantity: 8,
    stockQuantity: 10,
    activeReservedQuantity: 4,
  }), 6)
})

test('reserva automática não cria quantidade negativa', () => {
  assert.equal(automaticReservationQuantity({
    requiredQuantity: 3,
    stockQuantity: 2,
    activeReservedQuantity: 5,
  }), 0)
})

test('edição da reserva considera a quantidade já separada pelo projeto', () => {
  assert.equal(maxReservableQuantity({
    stockQuantity: 10,
    activeReservedQuantity: 8,
    currentProjectQuantity: 3,
  }), 5)
})
