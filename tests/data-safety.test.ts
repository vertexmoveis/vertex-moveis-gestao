import assert from 'node:assert/strict'
import test from 'node:test'
import { Prisma } from '@prisma/client'
import { generate } from 'otplib'
import { encryptCloudBackup, verifyCloudBackup } from '@/lib/cloud-backup'
import { moneyValue, numberValue, optionalMoneyValue } from '@/lib/money'
import {
  createProjectPortalToken,
  decryptProjectPortalToken,
  hashProjectPortalToken,
} from '@/lib/project-portal'
import {
  createTwoFactorSetup,
  decryptTwoFactorSecret,
  verifyTwoFactorCode,
} from '@/lib/two-factor'

process.env.NEXTAUTH_SECRET ||= 'vertex-tests-secret-with-more-than-24-characters'

test('valores Decimal preservam centavos ao serem serializados', () => {
  const decimal = new Prisma.Decimal('3250.07')

  assert.equal(numberValue(decimal), 3250.07)
  assert.equal(moneyValue(decimal), 3250.07)
  assert.equal(optionalMoneyValue(decimal), 3250.07)
  assert.equal(optionalMoneyValue(null), null)
})

test('backup criptografado detecta alterações e restaura o conteúdo original', () => {
  const key = Buffer.alloc(32, 7)
  const snapshot = {
    format: 'vertex-postgresql-backup-v1',
    tables: { Project: [{ id: 'project-1', value: '3250.07' }] },
  }
  const encrypted = encryptCloudBackup(snapshot, key)

  assert.deepEqual(verifyCloudBackup(encrypted, key), snapshot)
  assert.throws(
    () => verifyCloudBackup({ ...encrypted, checksum: '0'.repeat(64) }, key),
    /integridade/,
  )
})

test('token do portal é aleatório, armazenado criptografado e validado por hash', () => {
  const first = createProjectPortalToken()
  const second = createProjectPortalToken()

  assert.notEqual(first.token, second.token)
  assert.equal(decryptProjectPortalToken(first.tokenEncrypted), first.token)
  assert.equal(hashProjectPortalToken(first.token), first.tokenHash)
  assert.notEqual(first.tokenEncrypted, first.token)
})

test('segredo do autenticador é criptografado e aceita o código TOTP atual', async () => {
  const setup = createTwoFactorSetup('admin@vertexmoveis.com.br')
  const token = await generate({ secret: setup.secret })

  assert.equal(decryptTwoFactorSecret(setup.encryptedSecret), setup.secret)
  assert.equal(await verifyTwoFactorCode(setup.encryptedSecret, token), true)
  assert.equal(await verifyTwoFactorCode(setup.encryptedSecret, '000'), false)
})
