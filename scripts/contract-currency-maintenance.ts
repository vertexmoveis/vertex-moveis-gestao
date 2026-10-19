import { constants, createCipheriv, createPublicKey, publicEncrypt, randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { Prisma, PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { standaloneContractEditForm, createStandaloneSchema } from '@/lib/standalone-contract-edit'
import { buildStandaloneContractSnapshot } from '@/lib/standalone-contracts'
import { createProjectContractToken, parseProjectContractSnapshot, projectContractUrl } from '@/lib/project-contracts'
import { buildFinanceCommercialReport, financeCommercialMonth } from '@/lib/finance-commercial-report'

// This utility intentionally loads no .env file and prints no record contents.
// The caller supplies the database, token secret, exact repair plan and RSA key.
const outputPath = 'contract-currency-result.encrypted.json'
const amount = z.number().finite().min(0.01).max(10_000_000)
  .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001)
const targetSchema = z.object({
  clientName: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(160),
  expectedValue: amount,
  value: amount,
  id: z.string().trim().min(1).optional(),
  updatedAt: z.string().datetime().optional(),
  createdById: z.string().trim().min(1).optional(),
}).strict()
const planSchema = z.object({ targets: z.array(targetSchema).min(1).max(20) }).strict()
type Target = z.infer<typeof targetSchema>

class MaintenanceError extends Error {
  constructor(readonly code: string) { super(code) }
}

function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new MaintenanceError(code)
}

const sameText = (left: string | null | undefined, right: string) =>
  typeof left === 'string' && left.toLocaleLowerCase('pt-BR') === right.toLocaleLowerCase('pt-BR')

function monetarySummary(rawSnapshot: unknown) {
  const snapshot = parseProjectContractSnapshot(rawSnapshot)
  if (!snapshot) return null
  return {
    value: snapshot.project.value,
    approvalDate: snapshot.project.approvalDate,
    deliveryBusinessDays: snapshot.project.deliveryBusinessDays,
    deliveryDeadlineDate: snapshot.project.deliveryDeadlineDate,
    scopeItems: (snapshot.project.scope || []).flatMap(scope => scope.items || []).map(item => ({ quantity: item.quantity, unitPrice: item.unitPrice, total: item.total })),
    scopeTotal: Math.round((snapshot.project.scope || []).flatMap(scope => scope.items || []).reduce((sum, item) => sum + item.total, 0) * 100) / 100,
    payment: snapshot.payment,
    scheduleTotal: Math.round(snapshot.payment.schedule.reduce((sum, payment) => sum + payment.amount, 0) * 100) / 100,
  }
}

function encryptionKey() {
  const encoded = process.env.MAINTENANCE_PUBLIC_KEY
  requireCondition(encoded, 'PUBLIC_KEY_REQUIRED')
  const key = createPublicKey(Buffer.from(encoded, 'base64').toString('utf8'))
  requireCondition(key.asymmetricKeyType === 'rsa' && (key.asymmetricKeyDetails?.modulusLength || 0) >= 2048, 'INVALID_PUBLIC_KEY')
  return key
}

async function writeEncrypted(payload: unknown, key: ReturnType<typeof encryptionKey>) {
  const aesKey = randomBytes(32)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const encryptedKey = publicEncrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, aesKey)
  aesKey.fill(0)
  await writeFile(outputPath, JSON.stringify({
    version: 1,
    algorithm: 'RSA-OAEP-256+A256GCM',
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }), { encoding: 'utf8', mode: 0o600 })
}

async function audit(db: PrismaClient, targets: Target[]) {
  const entries = []
  for (const [targetIndex, target] of targets.entries()) {
    const candidates = await db.projectContract.findMany({
      where: {
        projectId: null,
        ...(target.id ? { id: target.id } : {}),
        standaloneTitle: { equals: target.title, mode: 'insensitive' },
        client: { is: { name: { equals: target.clientName, mode: 'insensitive' } } },
      },
      include: { client: { select: { id: true, name: true, archivedAt: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 101,
    })
    entries.push({
      targetIndex,
      expectedValue: target.expectedValue,
      value: target.value,
      truncated: candidates.length > 100,
      candidates: candidates.slice(0, 100).map(contract => ({
        id: contract.id, version: contract.version, status: contract.status,
        signedAt: contract.signedAt, voidedAt: contract.voidedAt, updatedAt: contract.updatedAt,
        projectId: contract.projectId, createdById: contract.createdById, expiresAt: contract.expiresAt,
        client: contract.client,
        form: standaloneContractEditForm(contract),
        monetarySummary: monetarySummary(contract.snapshot),
      })),
    })
  }
  return entries
}

async function apply(db: PrismaClient, targets: Target[]) {
  for (const target of targets) {
    requireCondition(target.id && target.updatedAt && target.createdById, 'EXACT_ID_VERSION_AND_CREATOR_REQUIRED')
    requireCondition(target.expectedValue !== target.value, 'VALUE_ALREADY_EQUAL')
  }
  const ids = targets.map(target => target.id!)
  requireCondition(new Set(ids).size === ids.length, 'DUPLICATE_TARGET_ID')
  requireCondition(process.env.NEXTAUTH_SECRET?.trim(), 'TOKEN_SECRET_REQUIRED')
  const origin = process.env.NEXTAUTH_URL?.trim()
  requireCondition(origin && /^https?:\/\//.test(origin), 'PUBLIC_ORIGIN_REQUIRED')
  const parsedOrigin = new URL(origin)
  requireCondition(!parsedOrigin.username && !parsedOrigin.password, 'INVALID_PUBLIC_ORIGIN')

  return db.$transaction(async tx => {
    // Lock every target before reading or changing any, always in a stable order.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ProjectContract" WHERE "id" IN (${Prisma.join([...ids].sort())}) ORDER BY "id" FOR UPDATE`)
    const company = await tx.companyProfile.findUnique({ where: { id: 'vertex' } })
    requireCondition(company, 'COMPANY_PROFILE_REQUIRED')
    const changes = []
    for (const [targetIndex, target] of targets.entries()) {
      const contract = await tx.projectContract.findUnique({ where: { id: target.id! }, include: { client: true } })
      requireCondition(contract, 'TARGET_NOT_FOUND')
      requireCondition(contract.projectId === null && !contract.signedAt && !contract.voidedAt && ['SENT', 'VIEWED', 'DRAFT'].includes(contract.status), 'TARGET_NO_LONGER_EDITABLE')
      requireCondition(contract.updatedAt.toISOString() === target.updatedAt, 'TARGET_VERSION_CHANGED')
      requireCondition(contract.createdById === target.createdById, 'TARGET_CREATOR_CHANGED')
      requireCondition(contract.client && !contract.client.archivedAt, 'ACTIVE_CLIENT_REQUIRED')
      requireCondition(sameText(contract.client.name, target.clientName) && sameText(contract.standaloneTitle, target.title), 'TARGET_IDENTITY_CHANGED')
      const previousForm = standaloneContractEditForm(contract)
      requireCondition(previousForm, 'ORIGINAL_FORM_UNRECOVERABLE')
      const previousSnapshot = parseProjectContractSnapshot(contract.snapshot)
      requireCondition(previousSnapshot, 'ORIGINAL_SNAPSHOT_UNRECOVERABLE')
      requireCondition(previousForm.value === target.expectedValue, 'ORIGINAL_VALUE_CHANGED')
      const parsed = createStandaloneSchema.safeParse({ ...previousForm, value: target.value })
      requireCondition(parsed.success, 'CORRECTED_FORM_INVALID')
      const snapshot = buildStandaloneContractSnapshot(parsed.data, contract.client, company)
      // Correct only the amount: a maintenance revision must not restart delivery dates.
      snapshot.company = previousSnapshot.company
      snapshot.client = previousSnapshot.client
      snapshot.project = { ...previousSnapshot.project, value: snapshot.project.value, scope: snapshot.project.scope }
      snapshot.payment = { ...previousSnapshot.payment, ...snapshot.payment,
        paymentDiscount: previousSnapshot.payment.paymentDiscount,
        cardFeePercent: previousSnapshot.payment.cardFeePercent,
        cardFeeAmount: previousSnapshot.payment.cardFeeAmount,
      }
      const priceTerm = snapshot.terms.find(term => term.title === 'Preço e condição de pagamento')
      requireCondition(priceTerm && previousSnapshot.terms.filter(term => term.title === priceTerm.title).length === 1, 'PRICE_TERM_UNRECOVERABLE')
      snapshot.terms = previousSnapshot.terms.map(term => term.title === priceTerm.title ? priceTerm : term)
      const token = createProjectContractToken()
      const now = new Date()
      const replacement = await tx.projectContract.create({ data: {
        clientId: contract.clientId, standaloneTitle: contract.standaloneTitle,
        createdById: contract.createdById, version: contract.version + 1,
        status: 'SENT', snapshot: snapshot as unknown as Prisma.InputJsonValue,
        tokenHash: token.tokenHash, tokenEncrypted: token.tokenEncrypted,
        sentAt: now, createdAt: now, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      } })
      const voided = await tx.projectContract.updateMany({
        where: { id: contract.id, updatedAt: contract.updatedAt, createdById: contract.createdById, projectId: null, signedAt: null, voidedAt: null, status: { in: ['SENT', 'VIEWED', 'DRAFT'] } },
        data: { status: 'VOID', voidedAt: now },
      })
      requireCondition(voided.count === 1, 'TARGET_VERSION_CHANGED')
      await tx.activityLog.create({ data: {
        userId: contract.createdById, action: 'Contrato avulso corrigido',
        details: JSON.stringify({ reason: 'Correção de valor monetário confirmada pelo responsável', previousContractId: contract.id, contractId: replacement.id, previousVersion: contract.version, version: replacement.version, previousValue: previousForm.value, value: parsed.data.value }),
      } })
      const previousAfter = await tx.projectContract.findUniqueOrThrow({ where: { id: contract.id } })
      const replacementAfter = await tx.projectContract.findUniqueOrThrow({ where: { id: replacement.id } })
      requireCondition(previousAfter.status === 'VOID' && previousAfter.voidedAt && JSON.stringify(previousAfter.snapshot) === JSON.stringify(contract.snapshot), 'ORIGINAL_SNAPSHOT_MUTATED')
      const restored = standaloneContractEditForm(replacementAfter)
      requireCondition(restored && JSON.stringify(restored) === JSON.stringify(parsed.data), 'PAYMENT_FIELDS_NOT_PRESERVED')
      const summary = monetarySummary(replacementAfter.snapshot)
      requireCondition(summary?.value === target.value && summary.scopeTotal === target.value && summary.scheduleTotal === target.value, 'MONETARY_TOTALS_INCONSISTENT')
      requireCondition(summary.approvalDate === previousSnapshot.project.approvalDate && summary.deliveryDeadlineDate === previousSnapshot.project.deliveryDeadlineDate, 'BUSINESS_DATES_NOT_PRESERVED')
      changes.push({
        targetIndex, previousId: contract.id, id: replacement.id,
        previousVersion: contract.version, version: replacement.version,
        previousValue: previousForm.value, value: parsed.data.value,
        form: parsed.data,
        previousForm,
        verification: { previousStatus: previousAfter.status, previousSnapshotImmutable: true, paymentFieldsPreserved: true, monetarySummary: summary },
        publicUrl: projectContractUrl(parsedOrigin.origin, token.token),
      })
    }
    const reportContracts = await tx.projectContract.findMany({
      where: { id: { in: [...ids, ...changes.map(change => change.id)] } },
      include: { client: { select: { name: true } } },
    })
    const now = new Date()
    const report = buildFinanceCommercialReport({ month: financeCommercialMonth(null, now).key, now, projects: [], quotes: [], contracts: reportContracts })
    const processedTotal = Math.round(changes.reduce((sum, change) => sum + change.value, 0) * 100) / 100
    requireCondition(report.negotiating.count === targets.length && report.negotiating.amount === processedTotal && report.sold.count === 0 && report.lost.count === 0, 'FINANCE_REPORT_INCONSISTENT')
    return { changes, processedTotal, report: { month: report.month, count: report.negotiating.count, amount: report.negotiating.amount, potentialTotal: report.potentialTotal, contractIds: report.negotiating.items.map(item => item.contractId) } }
  }, { timeout: 30_000, maxWait: 15_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

async function main() {
  let key: ReturnType<typeof encryptionKey> | undefined
  let db: PrismaClient | undefined
  let mode: 'audit' | 'apply' | undefined
  try {
    key = encryptionKey()
    const parsedMode = z.enum(['audit', 'apply']).safeParse(process.env.MAINTENANCE_MODE)
    requireCondition(parsedMode.success, 'INVALID_MAINTENANCE_MODE')
    mode = parsedMode.data
    let rawPlan: unknown
    try { rawPlan = JSON.parse(process.env.CONTRACT_CURRENCY_REPAIR_PLAN || '') } catch { throw new MaintenanceError('INVALID_REPAIR_PLAN') }
    const parsedPlan = planSchema.safeParse(rawPlan)
    requireCondition(parsedPlan.success, 'INVALID_REPAIR_PLAN')
    requireCondition(process.env.DATABASE_URL, 'DATABASE_URL_REQUIRED')
    db = new PrismaClient({ log: [] })
    const result = mode === 'audit' ? await audit(db, parsedPlan.data.targets) : await apply(db, parsedPlan.data.targets)
    await writeEncrypted({ success: true, mode, completedAt: new Date().toISOString(), result }, key)
    console.log('Maintenance completed; encrypted result written.')
  } catch (error) {
    const code = error instanceof MaintenanceError ? error.code : 'MAINTENANCE_FAILED'
    if (key) await writeEncrypted({ success: false, mode, completedAt: new Date().toISOString(), error: code }, key).catch(() => undefined)
    console.error(`Maintenance failed: ${code}.`)
    process.exitCode = 1
  } finally {
    await db?.$disconnect().catch(() => undefined)
  }
}

void main()
