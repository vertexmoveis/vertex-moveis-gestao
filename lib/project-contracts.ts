import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto'
import { moneyValue, type NumericValue } from './money'
import {
  getQuotePaymentSummary,
  QUOTE_PAYMENT_METHOD_LABELS,
  quoteCentimetersToMillimeters,
  safeQuotePaymentMethod,
} from './quotes'

const PROJECT_CONTRACT_SNAPSHOT_VERSION = 1

export const PROJECT_CONTRACT_SIGNATURE_METHODS = ['DIGITAL', 'IN_PERSON'] as const
export type ProjectContractSignatureMethod = typeof PROJECT_CONTRACT_SIGNATURE_METHODS[number]

export function isInPersonProjectContractSignature(method?: string | null) {
  return method === 'IN_PERSON'
}

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
  paymentMethod?: string | null
  paymentDiscount?: NumericValue
  cardFeePercent?: number | null
  cardFeeAmount?: NumericValue
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
  sourceQuote?: {
    number?: number | null
    variationName?: string | null
    items: Array<{
      environment: string
      environmentName?: string | null
      description: string
      furnitureModel?: string | null
      placement?: string | null
      material?: string | null
      finish?: string | null
      quantity: number
      width?: number | null
      height?: number | null
      unitPrice?: NumericValue
      total?: NumericValue
      notes?: string | null
    }>
  } | null
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
    street?: string | null
    number?: string | null
    neighborhood?: string | null
    city?: string | null
    state?: string | null
    zipCode?: string | null
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
    quoteNumber?: number | null
    variationName?: string | null
    scope?: Array<{
      environment: string
      furniture: string[]
      specifications: string[]
      items?: Array<{
        description: string
        placement: string | null
        dimensions: string | null
        material: string | null
        finish: string | null
        notes: string | null
        quantity: number
        unitPrice: number
        total: number
      }>
    }>
  }
  payment: {
    method?: string
    methodLabel?: string
    summary?: string
    paymentDiscount?: number
    cardFeePercent?: number
    cardFeeAmount?: number
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

function contractCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatContractAddress(source: AddressSource) {
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

function encryptProjectContractToken(token: string) {
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
  const paymentMethod = safeQuotePaymentMethod(project.paymentMethod)
  const paymentSummary = getQuotePaymentSummary({
    total: value,
    paymentMethod,
    cardInstallments: project.installmentCount,
    cardDownPayment: downPayment,
  })
  const environmentNames = Array.from(
    new Set(project.environments.map((environment) => environment.name.trim()).filter(Boolean)),
  )
  const scopeByEnvironment = new Map<string, {
    furniture: Set<string>
    specifications: Set<string>
    items: NonNullable<NonNullable<ProjectContractSnapshot['project']['scope']>[number]['items']>
  }>()

  for (const item of project.sourceQuote?.items || []) {
    const environment = item.environmentName?.trim() || item.environment.trim() || 'Ambiente não informado'
    const scope = scopeByEnvironment.get(environment) || {
      furniture: new Set<string>(),
      specifications: new Set<string>(),
      items: [],
    }
    const furniture = item.furnitureModel?.trim() || item.description.trim()
    if (furniture) {
      scope.furniture.add(`${Math.max(item.quantity || 1, 1)}x ${furniture}${item.placement?.trim() ? ` - ${item.placement.trim()}` : ''}`)
    }
    const specification = [item.material?.trim(), item.finish?.trim()].filter(Boolean).join(' - ')
    if (specification) scope.specifications.add(specification)
    const widthMm = item.width ? quoteCentimetersToMillimeters(item.width) : null
    const heightMm = item.height ? quoteCentimetersToMillimeters(item.height) : null
    scope.items.push({
      description: furniture || 'Móvel planejado',
      placement: item.placement?.trim() || null,
      dimensions: widthMm && heightMm ? `${widthMm} x ${heightMm} mm` : null,
      material: item.material?.trim() || null,
      finish: item.finish?.trim() || null,
      notes: item.notes?.trim() || null,
      quantity: Math.max(item.quantity || 1, 1),
      unitPrice: moneyValue(item.unitPrice),
      total: moneyValue(item.total),
    })
    scopeByEnvironment.set(environment, scope)
  }

  const scope = environmentNames.map((environment) => {
    const details = scopeByEnvironment.get(environment)
    return {
      environment,
      furniture: Array.from(details?.furniture || []),
      specifications: Array.from(details?.specifications || []),
      items: details?.items || [],
    }
  })

  for (const [environment, details] of scopeByEnvironment.entries()) {
    if (scope.some((entry) => entry.environment === environment)) continue
    scope.push({
      environment,
      furniture: Array.from(details.furniture),
      specifications: Array.from(details.specifications),
      items: details.items,
    })
  }

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
      street: project.client.street || project.client.address || null,
      number: project.client.number || null,
      neighborhood: project.client.neighborhood || null,
      city: project.client.city || null,
      state: project.client.state || null,
      zipCode: project.client.zipCode || null,
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
      quoteNumber: project.sourceQuote?.number || null,
      variationName: project.sourceQuote?.variationName || null,
      scope,
    },
    payment: {
      method: paymentMethod,
      methodLabel: QUOTE_PAYMENT_METHOD_LABELS[paymentMethod],
      summary: paymentSummary,
      paymentDiscount: moneyValue(project.paymentDiscount),
      cardFeePercent: Math.max(Number(project.cardFeePercent) || 0, 0),
      cardFeeAmount: moneyValue(project.cardFeeAmount),
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
        text: `A CONTRATADA fornecerá, produzirá, entregará e instalará os móveis planejados do projeto "${project.name}", nos ambientes e condições descritos neste contrato e no projeto técnico aprovado pelo CONTRATANTE. Imagens decorativas, eletrodomésticos e objetos que não estejam expressamente discriminados não integram o objeto.`,
      },
      {
        title: 'Projeto, medidas e especificações',
        text: 'As medidas finais, divisões, ferragens, cores, materiais e acabamentos serão conferidos antes do início da fabricação. O CONTRATANTE declara que analisará e aprovará o projeto técnico. Alterações solicitadas depois da aprovação dependerão de viabilidade e poderão modificar o preço e o prazo.',
      },
      {
        title: 'Preço e condição de pagamento',
        text: `O investimento total é de ${contractCurrency(value)}. Condição combinada: ${paymentSummary}. A entrada e as parcelas obedecem ao quadro financeiro deste documento, que integra o contrato para todos os fins.`,
      },
      {
        title: 'Prazo',
        text: `O prazo previsto é de ${project.deliveryBusinessDays || 30} dias úteis, contado após a aprovação final do projeto, a conferência das medidas e a confirmação do pagamento combinado. A previsão poderá ser revista quando houver alteração solicitada pelo cliente, impedimento no imóvel, atraso de fornecedor ou evento de força maior, sempre com comunicação ao CONTRATANTE.`,
      },
      {
        title: 'Obrigações do CONTRATANTE',
        text: 'O CONTRATANTE deverá fornecer informações corretas, aprovar o projeto, cumprir os pagamentos e disponibilizar o local livre, acessível e em condições para medição, entrega e instalação. Também deverá informar a posição de redes elétrica, hidráulica, de gás, aquecimento ou refrigeração e as medidas dos eletrodomésticos incorporados ao projeto.',
      },
      {
        title: 'Obrigações da CONTRATADA',
        text: 'A CONTRATADA executará os móveis com técnica e cuidado, observará o projeto aprovado, comunicará ocorrências relevantes e realizará a entrega e a instalação nas condições combinadas. Defeitos de fabricação ou de instalação atribuíveis à CONTRATADA serão analisados e corrigidos conforme a garantia aplicável.',
      },
      {
        title: 'Condições do imóvel',
        text: 'Paredes fora de esquadro, frágeis ou desniveladas, umidade, infiltração, exposição excessiva ao sol, instalações ocultas, pragas ou obras realizadas por terceiros podem impedir ou comprometer a instalação. Serviços de alvenaria, elétrica, hidráulica, gás, pintura, marmoraria e adequação do imóvel não estão incluídos, salvo quando descritos por escrito.',
      },
      {
        title: 'Entrega e instalação',
        text: 'A entrega e a instalação serão agendadas. O CONTRATANTE ou pessoa indicada deverá permitir o acesso e acompanhar a conferência. Se o local não estiver disponível ou adequado na data combinada, um novo agendamento poderá alterar o prazo e gerar custos adicionais previamente informados.',
      },
      {
        title: 'Alterações e serviços adicionais',
        text: 'Qualquer alteração de medida, material, acabamento, quantidade ou configuração deverá ser registrada por escrito. Quando a mudança gerar diferença de custo ou prazo, a execução dependerá da aprovação de orçamento complementar pelo CONTRATANTE.',
      },
      {
        title: 'Peças, ajustes e tolerâncias',
        text: 'Por se tratar de produto sob medida, poderão ocorrer ajustes técnicos durante a fabricação e a instalação. Pequenas variações próprias dos materiais, veios, tonalidades e emendas não caracterizam defeito quando estiverem dentro das especificações do fabricante e do projeto aprovado.',
      },
      {
        title: 'Garantia e assistência',
        text: 'A garantia cobre defeitos de fabricação e de instalação atribuíveis à CONTRATADA. Não cobre mau uso, excesso de peso, umidade, infiltração, calor, exposição solar, pragas, limpeza inadequada, intervenção de terceiros ou desgaste natural. Solicitações deverão ser registradas pelos canais de atendimento da Vertex Móveis.',
      },
      {
        title: 'Desistência e rescisão',
        text: 'Como os móveis são personalizados e fabricados para o CONTRATANTE, eventual desistência após a aprovação será apurada conforme a etapa executada, os materiais adquiridos, os serviços realizados e a legislação aplicável. As partes poderão formalizar por escrito a rescisão e os valores efetivamente devidos.',
      },
      {
        title: 'Inadimplemento',
        text: 'O atraso de pagamento poderá suspender a fabricação, a entrega, a instalação e a garantia de prazo enquanto permanecer a pendência. Encargos e medidas de cobrança somente serão aplicados nos limites previstos em lei e mediante comunicação ao CONTRATANTE.',
      },
      {
        title: 'Comunicações e validade dos ajustes',
        text: 'Acordos, aprovações e mudanças deverão constar no sistema, no projeto aprovado, em mensagem escrita ou em documento assinado. Conversas verbais que não forem confirmadas por escrito não alteram este contrato.',
      },
      {
        title: 'Assinatura, registros e proteção de dados',
        text: 'A assinatura poderá ocorrer eletronicamente ou em via física. O sistema identifica a versão apresentada e registra a modalidade e a data informadas; na assinatura presencial, a via física é a evidência original. Os dados pessoais serão utilizados para execução do contrato, atendimento, cobrança e cumprimento de obrigações legais, com acesso restrito às finalidades do serviço.',
      },
      {
        title: 'Legislação e foro',
        text: 'Este contrato será interpretado conforme a legislação brasileira, especialmente as normas de proteção ao consumidor quando aplicáveis. Fica preservado ao CONTRATANTE o direito de utilizar o foro legalmente competente para resolver eventual controvérsia.',
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
