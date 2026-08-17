import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeProjectFileDisplayName,
  projectFileDisplayName,
  projectFileExtension,
} from '@/lib/project-files'

test('separa o nome visível da extensão do arquivo', () => {
  assert.equal(projectFileDisplayName('20260803_093010.heic'), '20260803_093010')
  assert.equal(projectFileExtension('Dormitorio_Filha.pdf'), '.pdf')
})

test('renomeia preservando a extensão original', () => {
  assert.equal(
    normalizeProjectFileDisplayName('Medição da cozinha', '20260803_093010.heic'),
    'Medição da cozinha.heic',
  )
  assert.equal(
    normalizeProjectFileDisplayName('Projeto técnico.pdf', 'arquivo.pdf'),
    'Projeto técnico.pdf',
  )
})

test('remove caminhos e rejeita nome vazio', () => {
  assert.equal(
    normalizeProjectFileDisplayName('../Medição\\cozinha', 'foto.jpg'),
    '-Medição-cozinha.jpg',
  )
  assert.equal(normalizeProjectFileDisplayName('   ', 'foto.jpg'), '')
})
