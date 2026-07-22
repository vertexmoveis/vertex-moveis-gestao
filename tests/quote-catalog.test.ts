import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getQuoteEnvironmentTemplates,
  getQuoteFurnitureGroup,
  getQuoteFurnitureGroups,
  QUOTE_ENVIRONMENT_OPTIONS,
  searchQuoteFurnitureOptions,
} from '../lib/quote-catalog'

test('oferece móveis avulsos adequados para cada ambiente', () => {
  const kitchen = getQuoteFurnitureGroup('Cozinha', 'Móveis avulsos')
  const bedroom = getQuoteFurnitureGroup('Dormitório', 'Móveis avulsos')

  assert.ok(kitchen.models.includes('Balcão auxiliar avulso'))
  assert.ok(!kitchen.models.includes('Cômoda avulsa'))
  assert.ok(bedroom.models.includes('Cômoda avulsa'))
  assert.ok(getQuoteFurnitureGroup('Dormitório', 'Gaveteiro').models.includes('Gaveteiro avulso'))
  assert.ok(!bedroom.models.includes('Gaveteiro avulso'))
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

test('não repete tipos ou modelos na seleção de cada ambiente', () => {
  for (const environment of QUOTE_ENVIRONMENT_OPTIONS) {
    const groups = getQuoteFurnitureGroups(environment)
    const types = groups.map((group) => group.type)
    const models = groups.flatMap((group) => group.models)
    assert.equal(new Set(types).size, types.length, `Tipos repetidos em ${environment}`)
    assert.equal(new Set(models).size, models.length, `Modelos repetidos em ${environment}`)

    const standalone = getQuoteFurnitureGroup(environment, 'Móveis avulsos')
    assert.equal(standalone.type, 'Móveis avulsos', `Lista de móveis avulsos ausente em ${environment}`)
    assert.equal(new Set(standalone.models).size, standalone.models.length, `Móveis repetidos em ${environment}`)
  }
})

test('busca modelos ignorando acentos e reconhece nomes alternativos', () => {
  const withoutAccent = searchQuoteFurnitureOptions('Cozinha', 'armario aereo')
  const alias = searchQuoteFurnitureOptions('Cozinha', 'armario superior')

  assert.ok(withoutAccent.some((option) => option.model === 'Armário aéreo'))
  assert.ok(alias.some((option) => option.model === 'Armário aéreo'))
  assert.ok(!alias.some((option) => option.model === 'Guarda-roupa de abrir'))
})

test('modelos rápidos usam apenas móveis válidos no ambiente', () => {
  for (const environment of QUOTE_ENVIRONMENT_OPTIONS) {
    for (const template of getQuoteEnvironmentTemplates(environment)) {
      for (const item of template.items) {
        assert.ok(
          getQuoteFurnitureGroup(environment, item.type).models.includes(item.model),
          `${template.name} possui o modelo inválido ${item.model} em ${environment}`,
        )
      }
    }
  }
})
