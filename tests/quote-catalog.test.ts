import assert from 'node:assert/strict'
import test from 'node:test'
import { getQuoteFurnitureGroup, getQuoteFurnitureGroups, QUOTE_ENVIRONMENT_OPTIONS } from '../lib/quote-catalog'

test('oferece móveis avulsos adequados para cada ambiente', () => {
  const kitchen = getQuoteFurnitureGroup('Cozinha', 'Móveis avulsos')
  const bedroom = getQuoteFurnitureGroup('Dormitório', 'Móveis avulsos')

  assert.ok(kitchen.models.includes('Balcão auxiliar avulso'))
  assert.ok(!kitchen.models.includes('Cômoda avulsa'))
  assert.ok(bedroom.models.includes('Cômoda avulsa'))
  assert.ok(bedroom.models.includes('Gaveteiro avulso'))
  assert.ok(!bedroom.models.includes('Balcão auxiliar avulso'))
})

test('mantém os móveis avulsos nos ambientes equivalentes', () => {
  assert.deepEqual(
    getQuoteFurnitureGroup('Suíte', 'Móveis avulsos').models,
    getQuoteFurnitureGroup('Dormitório', 'Móveis avulsos').models,
  )
  assert.deepEqual(
    getQuoteFurnitureGroup('Home theater', 'Móveis avulsos').models,
    getQuoteFurnitureGroup('Sala', 'Móveis avulsos').models,
  )
})

test('não repete tipos ou modelos dentro das novas listas', () => {
  for (const environment of QUOTE_ENVIRONMENT_OPTIONS) {
    const groups = getQuoteFurnitureGroups(environment)
    const types = groups.map((group) => group.type)
    assert.equal(new Set(types).size, types.length, `Tipos repetidos em ${environment}`)

    const standalone = getQuoteFurnitureGroup(environment, 'Móveis avulsos')
    assert.equal(standalone.type, 'Móveis avulsos', `Lista de móveis avulsos ausente em ${environment}`)
    assert.equal(new Set(standalone.models).size, standalone.models.length, `Móveis repetidos em ${environment}`)
  }
})
