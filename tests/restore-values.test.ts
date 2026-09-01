import assert from 'node:assert/strict'
import test from 'node:test'
import {
  restoreRowValues,
  serializeJsonRestoreValue,
} from '../scripts/restore-values.mjs'

test('converte array textual legado em JSON válido sem perder os itens', () => {
  assert.equal(
    serializeJsonRestoreValue('{"data de aprovação"}'),
    '["data de aprovação"]',
  )
})

test('preserva valores JSON estruturados durante a restauração', () => {
  assert.equal(serializeJsonRestoreValue(['medição', 'aprovação']), '["medição","aprovação"]')
  assert.equal(serializeJsonRestoreValue('{"etapa":"produção"}'), '{"etapa":"produção"}')
})

test('preserva texto legado desconhecido como string JSON válida', () => {
  assert.equal(serializeJsonRestoreValue('anotação antiga'), '"anotação antiga"')
})

test('serializa apenas as colunas JSON identificadas no schema restaurado', () => {
  const jsonColumns = new Map([
    ['Project', new Set(['contractRevisionChanges'])],
  ])
  const columns = ['id', 'contractRevisionChanges', 'name']
  const row = {
    id: 'project-1',
    contractRevisionChanges: '{"data de aprovação"}',
    name: 'Cozinha',
  }

  assert.deepEqual(
    restoreRowValues('Project', columns, row, jsonColumns),
    ['project-1', '["data de aprovação"]', 'Cozinha'],
  )
})
