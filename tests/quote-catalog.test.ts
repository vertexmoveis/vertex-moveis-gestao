import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getQuoteEnvironmentTemplates,
  getQuoteFurnitureGroup,
  getQuoteFurnitureGroups,
  QUOTE_ENVIRONMENT_OPTIONS,
  searchQuoteFurnitureOptions,
} from '../lib/quote-catalog'

test('oferece apenas móveis de marcenaria no seletor', () => {
  const kitchen = searchQuoteFurnitureOptions('Cozinha', '')
  const bedroom = searchQuoteFurnitureOptions('Dormitório', '')
  const livingRoom = searchQuoteFurnitureOptions('Sala', '')
  const studio = searchQuoteFurnitureOptions('Studio', '')

  assert.ok(!kitchen.some((option) => option.type === 'Móveis avulsos'))
  assert.ok(!kitchen.some((option) => option.model === 'Balcão auxiliar avulso'))
  assert.ok(!bedroom.some((option) => option.model === 'Cômoda avulsa'))
  assert.ok(!livingRoom.some((option) => option.model === 'Mesa lateral'))
  assert.ok(!studio.some((option) => option.model === 'Sofá com armazenamento'))
  assert.ok(kitchen.some((option) => option.model === 'Armário aéreo'))
  assert.ok(bedroom.some((option) => option.model === 'Guarda-roupa de abrir'))
  assert.ok(livingRoom.some((option) => option.model === 'Painel para TV'))
})

test('não repete tipos ou modelos na seleção de cada ambiente', () => {
  for (const environment of QUOTE_ENVIRONMENT_OPTIONS) {
    const groups = getQuoteFurnitureGroups(environment)
    const types = groups.map((group) => group.type)
    const models = groups.flatMap((group) => group.models)
    assert.equal(new Set(types).size, types.length, `Tipos repetidos em ${environment}`)
    assert.equal(new Set(models).size, models.length, `Modelos repetidos em ${environment}`)

    assert.ok(!types.includes('Móveis avulsos'), `Móveis avulsos não devem aparecer em ${environment}`)
  }
})

test('busca modelos ignorando acentos e reconhece nomes alternativos', () => {
  const withoutAccent = searchQuoteFurnitureOptions('Cozinha', 'armario aereo')
  const alias = searchQuoteFurnitureOptions('Cozinha', 'armario superior')

  assert.ok(withoutAccent.some((option) => option.model === 'Armário aéreo'))
  assert.ok(alias.some((option) => option.model === 'Armário aéreo'))
  assert.ok(!alias.some((option) => option.model === 'Guarda-roupa de abrir'))
})

test('oferece módulos para forno de embutir na cozinha', () => {
  const ovenModules = getQuoteFurnitureGroup('Cozinha', 'Módulo para forno')
  const standaloneSearch = searchQuoteFurnitureOptions('Cozinha', 'forno solto')
  const drawerSearch = searchQuoteFurnitureOptions('Cozinha', 'forno com gaveteiro')

  assert.ok(ovenModules.models.includes('Módulo avulso para forno de embutir'))
  assert.ok(ovenModules.models.includes('Módulo para forno de embutir com gaveteiro'))
  assert.ok(standaloneSearch.some((option) => option.model === 'Módulo avulso para forno de embutir'))
  assert.ok(drawerSearch.some((option) => option.model === 'Módulo para forno de embutir com gaveteiro'))
})

test('mantém a opção personalizada restrita a móvel sob medida', () => {
  const personalized = getQuoteFurnitureGroup('Cozinha', 'Personalizado')

  assert.deepEqual(personalized.models, ['Outro móvel sob medida'])
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
