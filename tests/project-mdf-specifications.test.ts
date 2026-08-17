import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildProjectMdfSpecificationsFromQuoteItems,
  normalizeProjectMdfSpecifications,
} from '@/lib/project-mdf-specifications'

test('normaliza especificações válidas e remove linhas incompletas ou repetidas', () => {
  const result = normalizeProjectMdfSpecifications([
    { id: 'porta-1', application: '  Portas  ', side: 'EXTERNAL', mdf: 'MDF Off White', notes: '' },
    { id: 'porta-1', application: 'Painel', side: 'EXTERNAL', mdf: 'MDF Carvalho', notes: null },
    { id: 'incompleta', application: '', side: 'INTERNAL', mdf: 'MDF Branco', notes: null },
  ])

  assert.deepEqual(result, [{
    id: 'porta-1',
    application: 'Portas',
    side: 'EXTERNAL',
    mdf: 'MDF Off White',
    notes: null,
  }])
})

test('leva acabamentos externo e interno do orçamento para o projeto', () => {
  const result = buildProjectMdfSpecificationsFromQuoteItems([
    {
      description: 'Armário aéreo',
      placement: 'Parede da pia',
      material: 'MDF',
      finish: 'Branco interno',
      priceProfile: 'WOODGRAIN',
    },
  ])

  assert.deepEqual(result, [
    {
      id: 'mdf-1',
      application: 'Armário aéreo',
      side: 'EXTERNAL',
      mdf: 'MDF Madeirado externo',
      notes: 'Parede da pia',
    },
    {
      id: 'mdf-2',
      application: 'Caixaria interna',
      side: 'INTERNAL',
      mdf: 'MDF Branco interno',
      notes: null,
    },
  ])
})
