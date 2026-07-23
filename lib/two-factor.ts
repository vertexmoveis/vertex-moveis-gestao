import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { generateSecret, generateURI, verify } from 'otplib'

function encryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 24) throw new Error('NEXTAUTH_SECRET não está configurado corretamente.')
  return createHash('sha256').update(secret, 'utf8').digest()
}

export function encryptTwoFactorSecret(secret: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

export function decryptTwoFactorSecret(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split('.')
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Segredo de autenticação inválido.')
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function createTwoFactorSetup(email: string) {
  const secret = generateSecret({ length: 20 })
  return {
    secret,
    encryptedSecret: encryptTwoFactorSecret(secret),
    uri: generateURI({
      issuer: 'Vertex Móveis',
      label: email,
      secret,
      period: 30,
      digits: 6,
    }),
  }
}

export async function verifyTwoFactorCode(encryptedSecret: string, token: string) {
  const normalizedToken = token.replace(/\D/g, '').slice(0, 6)
  if (normalizedToken.length !== 6) return false
  const result = await verify({
    secret: decryptTwoFactorSecret(encryptedSecret),
    token: normalizedToken,
    epochTolerance: 30,
  })
  return result.valid
}
