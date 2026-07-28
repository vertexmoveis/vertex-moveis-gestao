import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto'
import { moneyValue, type NumericValue } from './money'

export const PROJECT_CONTRACT_SNAPSHOT_VERSION = 1

type AddressSource = {
  address?: string | null
  street?: string | null
  number?: string | null
  complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
}

type ProjectContractSource = {
  id: string
  name: string
  room?: string | null
  value: NumericValue
  approvalDate?: Date | null
  deliveryBusinessDays: number
  deliveryDeadlineDate?: Date | null
  downPayment: NumericValue
  installmentCount: number
  installmentValue: NumericValue
  firstInstallmentDate?: Date | null
  client: AddressSource & {
    name: string
    document?: string | null
    phone?: string | null
    whatsapp?: string | null
    email?: string | null
  }
  environments: Array<{ name: string }>
  payments: Array<{
    installmentNumber: number
    type: string
    amount: NumericValue
    dueDate: Date
  }>
}

type CompanySource = AddressSource & {
  tradeName: string
  legalName?: string | null
  document?: string | null
  phone?: string | null
  email?: string | null
}

export type ProjectContractSnapshot = {
  version: typeof PROJECT_CONTRACT_SNAPSHOT_VERSION
  generatedAt: string
  company: {
    tradeName: string
    legalName: string | null
    document: string | null
    phone: string | null
    email: string | null
    address: string | null
  }
  client: {
    name: string
    document: string | null
    phone: string | null
    email: string | null
    address: string | null
  }
  project: {
    id: string
    name: string
    room: string | null
    environments: string[]
    value: number
    approvalDate: string | null
    deliveryBusinessDays: number
    deliveryDeadlineDate: string | null
  }
  payment: {
    downPayment: number
    installmentCount: number
    installmentValue: number
    firstInstallmentDate: string | null
    schedule: Array<{
      number: number
      type: string
      amount: number
      dueDate: string
    }>
  }
  terms: Array<{ title: string; text: string }>
}

function contractEncryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret || secret.length < 24) {
    throw new Error('NEXTAUTH_SECRET não está configurado corretamente.')
  }
  return createHash('sha256').update(`project-contract:${secret}`, 'utf8').digest()
}

function iso(value?: Date | null) {
  return value && !Number.isNaN(value.getTime()) ? value.toISOString() : null
}

export function formatContractAddress(source: AddressSource) {
  if (source.address?.trim()) return source.address.trim()

  const firstLine = [source.street, source.number].filter(Boolean).join(', ')
  const secondLine = [source.complement, source.neighborhood].filter(Boolean).join(' - ')
  const cityLine = [source.city, source.state].filter(Boolean).join(' - ')
  const parts = [firstLine, secondLine, cityLine, source.zipCode].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

export function hashProjectContractToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function encryptProjectContractToken(token: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', contractEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

export function decryptProjectContractToken(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split('.')
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Link de contrato inválido.')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    contractEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function createProjectContractToken() {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    tokenHash: hashProjectContractToken(token),
    tokenEncrypted: encryptProjectContractToken(token),
  }
}

export function projectContractUrl(origin: string, token: string) {
  const configuredOrigin = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, '')
  return `${configuredOrigin || origin.replace(/\/$/, '')}/contrato/${token}`
}

export function hashProjectContractAcceptanceIp(ip: string) {
  return createHmac('sha256', contractEncryptionKey()).update(ip).digest('hex')
}

export function buildProjectContractSnapshot(
  project: ProjectContractSource,
  company: CompanySource,
): ProjectContractSnapshot {
  const value = moneyValue(project.value)
  const downPayment = moneyValue(project.downPayment)
  const installmentValue = moneyValue(project.installmentValue)
  const environmentNames = Array.from(
    new Set(project.environments.map((environment) => environment.name.trim()).filter(Boolean)),
  )

  return {
    version: PROJECT_CONTRACT_SNAPSHOT_VERSION,
    generatedAt: new Date().toISOString(),
    company: {
      tradeName: company.tradeName,
      legalName: company.legalName || null,
      document: company.document || null,
      phone: company.phone || null,
      email: company.email || null,
      address: formatContractAddress(company),
    },
    client: {
      name: project.client.name,
      document: project.client.document || null,
      phone: project.client.whatsapp || project.client.phone || null,
      email: project.client.email || null,
      address: formatContractAddress(project.client),
    },
    project: {
      id: project.id,
      name: project.name,
      room: project.room || null,
      environments: environmentNames,
      value,
      approvalDate: iso(project.approvalDate),
      deliveryBusinessDays: project.deliveryBusinessDays || 30,
      deliveryDeadlineDate: iso(project.deliveryDeadlineDate),
    },
    payment: {
      downPayment,
      installmentCount: project.installmentCount,
      installmentValue,
      firstInstallmentDate: iso(project.firstInstallmentDate),
      schedule: project.payments.map((payment) => ({
        number: payment.installmentNumber,
        type: payment.type,
        amount: moneyValue(payment.amount),
        dueDate: payment.dueDate.toISOString(),
      })),
    },
    terms: [
      {
        title: 'Objeto',
        text: `Produção, entrega e instalação dos móveis planejados do projeto "${project.name}", nos ambientes descritos neste documento.`,
      },
      {
        title: 'Medidas e definições',
        text: 'As medidas finais, ferragens, cores e acabamentos serão conferidos antes do início da fabricação. Mudanças posteriores podem alterar prazo e valor.',
      },
      {
        title: 'Prazo',
        text: `O prazo previsto é de ${project.deliveryBusinessDays || 30} dias úteis, contado após a aprovação final do projeto e a confirmação do pagamento combinado.`,
      },
      {
        title: 'Pagamento',
        text: `O investimento total registrado é de R$ ${value.toFixed(2).replace('.', ',')}. Entrada e parcelas seguem o quadro financeiro deste documento.`,
      },
      {
        title: 'Entrega e instalação',
        text: 'A instalação será agendada com o cliente. O local deve estar acessível e em condições adequadas para o serviço na data combinada.',
      },
      {
        title: 'Garantia e atendimento',
        text: 'Ocorrências após a instalação serão registradas no atendimento de garantia da Vertex Móveis para análise e acompanhamento.',
      },
    ],
  }
}

export function parseProjectContractSnapshot(value: unknown): ProjectContractSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const snapshot = value as Partial<ProjectContractSnapshot>
  if (
    snapshot.version !== PROJECT_CONTRACT_SNAPSHOT_VERSION
    || !snapshot.company?.tradeName
    || !snapshot.client?.name
    || !snapshot.project?.id
    || !Array.isArray(snapshot.terms)
    || !Array.isArray(snapshot.payment?.schedule)
  ) {
    return null
  }
  return snapshot as ProjectContractSnapshot
}
