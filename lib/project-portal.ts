import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function portalEncryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 24) throw new Error('NEXTAUTH_SECRET não está configurado corretamente.')
  return createHash('sha256').update(`project-portal:${secret}`, 'utf8').digest()
}

export function hashProjectPortalToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function encryptProjectPortalToken(token: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', portalEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

export function decryptProjectPortalToken(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split('.')
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) throw new Error('Link inválido.')
  const decipher = createDecipheriv('aes-256-gcm', portalEncryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function createProjectPortalToken() {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    tokenHash: hashProjectPortalToken(token),
    tokenEncrypted: encryptProjectPortalToken(token),
  }
}
