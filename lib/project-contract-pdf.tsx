import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { ProjectContractSnapshot } from '@/lib/project-contracts'

export type ProjectContractPdfInput = {
  id: string
  version: number
  snapshot: ProjectContractSnapshot
  signedAt?: Date | null
  signatoryName?: string | null
  signatoryDocument?: string | null
  acceptedIpHash?: string | null
  acceptedUserAgent?: string | null
  logoDataUrl?: string
}

type SignedContractPdfInput = ProjectContractPdfInput & {
  signedAt: Date
  signatoryName: string
}

const colors = {
  orange: '#FF6B00',
  ink: '#171717',
  muted: '#616161',
  line: '#CFCFCF',
  soft: '#EEEEEE',
  lighter: '#F8F8F8',
  green: '#087A46',
  greenSoft: '#EEF9F3',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingRight: 32,
    paddingBottom: 44,
    paddingLeft: 32,
    fontFamily: 'Helvetica',
    fontSize: 8.4,
    color: colors.ink,
    lineHeight: 1.36,
  },
  topLine: {
    height: 5,
    backgroundColor: colors.orange,
    marginTop: -30,
    marginRight: -32,
    marginLeft: -32,
    marginBottom: 14,
  },
  quotePage: {
    paddingTop: 14,
    paddingRight: 28,
    paddingBottom: 28,
    paddingLeft: 28,
    fontSize: 9.2,
    lineHeight: 1.08,
  },
  quoteTopLine: {
    height: 5,
    backgroundColor: colors.orange,
    marginTop: -14,
    marginRight: -28,
    marginBottom: 8,
    marginLeft: -28,
  },
  quoteCompany: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 5,
  },
  quoteBrand: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, width: '66%' },
  quoteLogo: { width: 36, height: 26, objectFit: 'contain' },
  quoteCompanyName: { fontFamily: 'Helvetica-Bold', fontSize: 14, textTransform: 'uppercase' },
  quoteCompanyLegal: { marginTop: 1, color: colors.muted, fontSize: 8.5 },
  quoteCompanyLine: { marginTop: 0.5, color: '#333333', fontSize: 8.5 },
  quoteCompanyContact: { width: '31%', textAlign: 'right', fontSize: 8.5, lineHeight: 1.18 },
  quoteBold: { fontFamily: 'Helvetica-Bold' },
  quoteTitleBar: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  quoteTitleMain: { width: '60%', fontFamily: 'Helvetica-Bold', fontSize: 12, textAlign: 'center' },
  quoteTitleSpacer: { width: '20%' },
  quoteTitleDate: { width: '20%', textAlign: 'right' },
  quoteDeliveryRow: { flexDirection: 'row', gap: 5 },
  quoteDelivery: {
    marginTop: 3,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.lighter,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontFamily: 'Helvetica-Bold',
  },
  quoteOption: { width: '30%' },
  quoteForecast: { width: '70%' },
  quoteSectionTitle: {
    marginTop: 3,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.2,
    textTransform: 'uppercase',
  },
  quoteRow: { flexDirection: 'row' },
  quoteCell: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    paddingVertical: 1.6,
    paddingHorizontal: 5,
  },
  quoteClientLabel: { width: '16%', backgroundColor: '#FAFAFA', fontFamily: 'Helvetica-Bold' },
  quoteClientValue: { width: '34%' },
  quoteItemHeader: { flexDirection: 'row', backgroundColor: colors.lighter },
  quoteHeaderCell: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    paddingVertical: 1.6,
    paddingHorizontal: 5,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.2,
    textTransform: 'uppercase',
  },
  quoteItemNumber: { width: '7%', textAlign: 'center' },
  quoteItemDescription: { width: '53%' },
  quoteItemQuantity: { width: '10%', textAlign: 'right' },
  quoteItemMoney: { width: '15%', textAlign: 'right' },
  quoteEnvironmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingVertical: 1.6,
    paddingHorizontal: 5,
    fontFamily: 'Helvetica-Bold',
  },
  quoteServiceName: { fontFamily: 'Helvetica-Bold' },
  quoteServiceDetail: { color: colors.muted, fontSize: 7.7 },
  quoteTotalRow: { flexDirection: 'row', backgroundColor: '#F4F4F4', fontFamily: 'Helvetica-Bold' },
  quoteTotalLabel: { width: '60%' },
  quoteTotalQuantity: { width: '10%', textAlign: 'right' },
  quoteTotalBlank: { width: '15%' },
  quoteTotalValue: { width: '15%', textAlign: 'right' },
  quoteSummaryLine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    paddingVertical: 1.6,
    paddingHorizontal: 5,
    fontFamily: 'Helvetica-Bold',
  },
  quoteSummaryLabel: { width: '75%', textAlign: 'right' },
  quoteSummaryValue: { width: '25%', textAlign: 'right' },
  quotePaymentDue: { width: '22%' },
  quotePaymentAmount: { width: '22%', textAlign: 'right' },
  quotePaymentMethod: { width: '31%' },
  quotePaymentObservation: { width: '25%' },
  quotePaymentPairDue: { width: '24%' },
  quotePaymentPairAmount: { width: '26%', textAlign: 'right' },
  quotePaymentTripleDue: { width: '20%' },
  quotePaymentTripleAmount: { width: '13.333%', textAlign: 'right' },
  quotePaymentSummary: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.lighter,
    paddingVertical: 1.6,
    paddingHorizontal: 5,
  },
  quoteNotes: { marginTop: 3, borderWidth: 1, borderColor: colors.line, padding: 3, lineHeight: 1.1 },
  quoteContinuation: {
    position: 'absolute',
    right: 28,
    top: 7,
    left: 28,
    color: colors.muted,
    fontSize: 7,
    textAlign: 'right',
  },
  companyHeader: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: { flexDirection: 'row', alignItems: 'flex-start' },
  logo: { width: 48, height: 36, objectFit: 'contain', marginRight: 10 },
  brandName: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  brandSub: { marginTop: 1, fontSize: 7.8, color: colors.muted },
  companyDetails: { marginTop: 6, color: colors.muted, lineHeight: 1.45 },
  contact: { width: 190, textAlign: 'right', lineHeight: 1.5 },
  contactStrong: { fontFamily: 'Helvetica-Bold' },
  titleBand: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  documentTitle: { maxWidth: 390, fontSize: 10.5, fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 9 },
  sectionTitle: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingVertical: 4,
    paddingHorizontal: 7,
    fontSize: 8.7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 6.5,
    color: colors.muted,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  details: { marginTop: 3, color: colors.muted, lineHeight: 1.45 },
  summaryGrid: {
    flexDirection: 'row',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.line,
  },
  summaryCell: { flex: 1, minHeight: 48, padding: 8 },
  summaryCellBorder: { borderLeftWidth: 1, borderLeftColor: colors.line },
  summaryValue: { marginTop: 2, fontSize: 9.6, fontFamily: 'Helvetica-Bold' },
  totalCell: { flex: 1.12, minHeight: 48, padding: 8, backgroundColor: colors.ink, color: '#FFFFFF' },
  totalLabel: { fontSize: 6.5, color: '#CFCFCF', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  total: { marginTop: 2, color: colors.orange, fontSize: 13.5, fontFamily: 'Helvetica-Bold' },
  table: { borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.line },
  tableHeader: { flexDirection: 'row', backgroundColor: colors.lighter, borderBottomWidth: 1, borderBottomColor: colors.line },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line },
  tableRowFirst: { flexDirection: 'row' },
  tableCell: { paddingVertical: 5, paddingHorizontal: 7 },
  tableCellBorder: { borderLeftWidth: 1, borderLeftColor: colors.line },
  scopeEnvironment: { width: '23%' },
  scopeFurniture: { width: '49%' },
  scopeSpecification: { width: '28%' },
  tableHeadText: { fontSize: 6.5, color: colors.muted, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  scopePrimary: { fontFamily: 'Helvetica-Bold' },
  scopeNote: { paddingVertical: 5, paddingHorizontal: 7, color: colors.muted, fontSize: 7.2, borderTopWidth: 1, borderTopColor: colors.line },
  pageHeader: { marginBottom: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  pageTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  pageCode: { color: colors.muted, textAlign: 'right' },
  paymentSummary: { borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.line, padding: 7 },
  paymentGrid: { borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.line },
  paymentRow: { flexDirection: 'row' },
  paymentItem: { flex: 1, minHeight: 31, paddingVertical: 5, paddingHorizontal: 7, borderTopWidth: 1, borderTopColor: colors.line },
  paymentItemSecond: { borderLeftWidth: 1, borderLeftColor: colors.line },
  paymentLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  paymentName: { fontFamily: 'Helvetica-Bold' },
  paymentAmount: { fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  paymentDate: { marginTop: 1, fontSize: 7, color: colors.muted },
  termList: { borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.line },
  term: { paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: colors.line },
  termTitle: { fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  termText: { textAlign: 'justify' },
  closing: { marginTop: 10, textAlign: 'justify' },
  signatureDate: { marginTop: 12, textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  signature: {
    marginTop: 10,
    minHeight: 154,
    borderWidth: 1,
    borderColor: colors.ink,
    paddingTop: 18,
    paddingRight: 24,
    paddingBottom: 18,
    paddingLeft: 24,
    justifyContent: 'flex-end',
  },
  signatureIntro: { position: 'absolute', top: 14, left: 20, right: 20, color: colors.muted, textAlign: 'center' },
  signatureGrid: { flexDirection: 'row', gap: 28 },
  signatureColumn: { flex: 1 },
  signatureLine: { borderTopWidth: 1, borderTopColor: colors.ink, paddingTop: 5, textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  signatureCaption: { marginTop: 2, textAlign: 'center', fontSize: 7, color: colors.muted },
  signedProof: { marginTop: 10, minHeight: 136, borderWidth: 1, borderColor: '#8CCCAD', backgroundColor: colors.greenSoft, padding: 14 },
  signedTitle: { color: colors.green, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  signedName: { marginTop: 25, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.ink, fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  signedDetails: { marginTop: 3, textAlign: 'center', color: colors.muted },
  audit: { marginTop: 8, backgroundColor: colors.lighter, borderWidth: 1, borderColor: colors.line, padding: 8, fontSize: 7, color: colors.muted },
  footer: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: 20,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: colors.muted,
  },
})

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function dateTime(value: Date | string | null | undefined) {
  if (!value) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

function dateOnly(value: string | null | undefined) {
  if (!value) return 'A combinar'
  const key = value.slice(0, 10)
  const [year, month, day] = key.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function paymentName(type: string, number: number) {
  return type === 'DOWN_PAYMENT' ? 'Entrada' : `Parcela ${number}`
}

function compactText(values: string[], fallback: string, maxLength: number) {
  const text = values.join('; ')
  if (!text) return fallback
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3).trim()}...`
}

function valueOrFallback(value?: string | null) {
  return value?.trim() || 'Não informado'
}

function optionalCurrency(value: number) {
  return value > 0 ? currency(value) : '—'
}

function ContractFooter({ companyName, authenticityCode }: { companyName: string; authenticityCode: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{companyName} · Documento gerado pelo sistema Vertex</Text>
      <Text render={({ pageNumber, totalPages }) => `${authenticityCode} · Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}

function Terms({ terms, startIndex = 0 }: { terms: ProjectContractSnapshot['terms']; startIndex?: number }) {
  return (
    <View style={styles.termList}>
      {terms.map((term, index) => (
        <View key={`${term.title}-${startIndex + index}`} style={styles.term} wrap={false}>
          <Text style={styles.termTitle}>{startIndex + index + 1}. {term.title}</Text>
          <Text style={styles.termText}>{term.text}</Text>
        </View>
      ))}
    </View>
  )
}

function SignatureBlock({ input, signed }: { input: ProjectContractPdfInput; signed: boolean }) {
  const { snapshot } = input
  if (signed) {
    return (
      <View style={styles.signedProof} wrap={false}>
        <Text style={styles.signedTitle}>ACEITE ELETRÔNICO REGISTRADO</Text>
        <Text style={styles.details}>O cliente declarou que leu e concordou com o projeto, os valores, o prazo e todas as condições deste contrato.</Text>
        <Text style={styles.signedName}>{input.signatoryName}</Text>
        <Text style={styles.signedDetails}>
          {input.signatoryDocument ? `Documento: ${input.signatoryDocument} · ` : ''}Aceite registrado em {dateTime(input.signedAt)}
        </Text>
        <View style={styles.audit}>
          <Text>Contrato: {input.id} · Versão: {input.version} · Gerado em: {dateTime(snapshot.generatedAt)}</Text>
          <Text>Identificador técnico: {input.acceptedIpHash ? `${input.acceptedIpHash.slice(0, 24)}...` : 'não disponível'}</Text>
          <Text>Dispositivo informado: {(input.acceptedUserAgent || 'não disponível').slice(0, 150)}</Text>
        </View>
      </View>
    )
  }

  return (
    <>
      <Text style={styles.signatureDate}>Cotia - SP, ______ de ______________________________ de __________.</Text>
      <View style={styles.signature} wrap={false}>
        <Text style={styles.signatureIntro}>Por estarem de acordo, as partes assinam este instrumento e reconhecem a validade do aceite eletrônico.</Text>
        <View style={styles.signatureGrid}>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureLine}>{snapshot.company.legalName || snapshot.company.tradeName}</Text>
            <Text style={styles.signatureCaption}>CONTRATADA</Text>
          </View>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureLine}>{snapshot.client.name}</Text>
            <Text style={styles.signatureCaption}>CONTRATANTE</Text>
          </View>
        </View>
      </View>
    </>
  )
}

function ContractDocument({ input }: { input: ProjectContractPdfInput }) {
  const { snapshot } = input
  const signed = Boolean(input.signedAt && input.signatoryName)
  const authenticityCode = `${input.id.toUpperCase()}-V${input.version}`
  const fallbackEnvironments = snapshot.project.environments.length > 0
    ? snapshot.project.environments
    : [snapshot.project.room || 'Projeto completo']
  const scope = snapshot.project.scope?.length ? snapshot.project.scope : fallbackEnvironments.map((environment) => ({
    environment,
    furniture: [],
    specifications: [],
    items: [],
  }))
  const quoteCode = snapshot.project.quoteNumber
    ? String(snapshot.project.quoteNumber).padStart(4, '0')
    : authenticityCode
  const streetAddress = [
    snapshot.client.street,
    snapshot.client.number,
    snapshot.client.neighborhood,
  ].filter(Boolean).join(', ')
  const frozenItems = scope.flatMap((entry) => entry.items || [])
  const itemSubtotal = frozenItems.reduce((sum, item) => sum + item.total, 0)
  const totalQuantity = frozenItems.reduce((sum, item) => sum + item.quantity, 0)
  const paymentRows = snapshot.payment.schedule.map((payment) => ({
    ...payment,
    label: paymentName(payment.type, payment.number),
  }))
  const pairedPayments = Array.from(
    { length: Math.ceil(paymentRows.length / 2) },
    (_, index) => [paymentRows[index * 2], paymentRows[(index * 2) + 1]],
  )
  const tripledPayments = Array.from(
    { length: Math.ceil(paymentRows.length / 3) },
    (_, index) => [
      paymentRows[index * 3],
      paymentRows[(index * 3) + 1],
      paymentRows[(index * 3) + 2],
    ],
  )
  let itemNumber = 0
  const quoteGroups = scope.map((entry) => {
    const items = entry.items?.length
      ? entry.items
      : (entry.furniture.length > 0 ? entry.furniture : ['Conforme projeto técnico aprovado']).map((description) => ({
          description,
          placement: null,
          dimensions: null,
          material: null,
          finish: compactText(entry.specifications, '', 120) || null,
          notes: null,
          quantity: 1,
          unitPrice: 0,
          total: 0,
        }))
    return {
      environment: entry.environment,
      items: items.map((item) => ({ ...item, itemNumber: ++itemNumber })),
    }
  })
  const primaryTermCount = 12
  const primaryTerms = snapshot.terms.slice(0, primaryTermCount)
  const additionalTerms = snapshot.terms.slice(primaryTermCount)
  const signatureOnAdditionalPage = additionalTerms.length > 0

  return (
    <Document title={`Contrato ${snapshot.project.name}`} author={snapshot.company.tradeName}>
      <Page size="A4" style={[styles.page, styles.quotePage]}>
        <View style={styles.quoteTopLine} />
        <Text style={styles.quoteContinuation} fixed>
          PEDIDO {quoteCode} | {snapshot.client.name}
        </Text>
        <View style={styles.quoteCompany} wrap={false}>
          <View style={styles.quoteBrand}>
            {input.logoDataUrl ? <PdfImage src={input.logoDataUrl} style={styles.quoteLogo} /> : null}
            <View>
              <Text style={styles.quoteCompanyName}>{snapshot.company.tradeName}</Text>
              {snapshot.company.legalName ? <Text style={styles.quoteCompanyLegal}>{snapshot.company.legalName}</Text> : null}
              <Text style={styles.quoteCompanyLine}>
                {[snapshot.company.document ? `CNPJ: ${snapshot.company.document}` : '', snapshot.company.address].filter(Boolean).join(' | ')}
              </Text>
            </View>
          </View>
          <View style={styles.quoteCompanyContact}>
            {snapshot.company.phone ? <Text style={styles.quoteBold}>{snapshot.company.phone}</Text> : null}
            {snapshot.company.email ? <Text>{snapshot.company.email}</Text> : null}
            <Text style={styles.quoteCompanyLine}>Responsável: {snapshot.company.tradeName}</Text>
          </View>
        </View>

        <View style={styles.quoteTitleBar} wrap={false}>
          <Text style={styles.quoteTitleSpacer}></Text>
          <Text style={styles.quoteTitleMain}>PEDIDO Nº {quoteCode}</Text>
          <Text style={styles.quoteTitleDate}>{dateOnly(snapshot.generatedAt)}</Text>
        </View>
        <View style={styles.quoteDeliveryRow} wrap={false}>
          <Text style={[styles.quoteDelivery, styles.quoteOption]}>OPÇÃO: {snapshot.project.variationName || 'Projeto contratado'}</Text>
          <Text style={[styles.quoteDelivery, styles.quoteForecast]}>
            ENTREGA: {dateOnly(snapshot.project.deliveryDeadlineDate)} ({snapshot.project.deliveryBusinessDays} dias úteis após aprovação e pagamento)
          </Text>
        </View>

        <Text style={styles.quoteSectionTitle}>Dados do cliente</Text>
        <View style={styles.quoteRow} wrap={false}>
          <Text style={[styles.quoteCell, styles.quoteClientLabel]}>Cliente</Text>
          <Text style={[styles.quoteCell, styles.quoteClientValue]}>{snapshot.client.name}</Text>
          <Text style={[styles.quoteCell, styles.quoteClientLabel]}>CPF/CNPJ</Text>
          <Text style={[styles.quoteCell, styles.quoteClientValue]}>{valueOrFallback(snapshot.client.document || input.signatoryDocument)}</Text>
        </View>
        <View style={styles.quoteRow} wrap={false}>
          <Text style={[styles.quoteCell, styles.quoteClientLabel]}>Endereço</Text>
          <Text style={[styles.quoteCell, styles.quoteClientValue]}>{valueOrFallback(streetAddress || snapshot.client.address)}</Text>
          <Text style={[styles.quoteCell, styles.quoteClientLabel]}>CEP</Text>
          <Text style={[styles.quoteCell, styles.quoteClientValue]}>{valueOrFallback(snapshot.client.zipCode)}</Text>
        </View>
        <View style={styles.quoteRow} wrap={false}>
          <Text style={[styles.quoteCell, styles.quoteClientLabel]}>Cidade</Text>
          <Text style={[styles.quoteCell, styles.quoteClientValue]}>{valueOrFallback(snapshot.client.city)}</Text>
          <Text style={[styles.quoteCell, styles.quoteClientLabel]}>Estado</Text>
          <Text style={[styles.quoteCell, styles.quoteClientValue]}>{valueOrFallback(snapshot.client.state)}</Text>
        </View>
        <View style={styles.quoteRow} wrap={false}>
          <Text style={[styles.quoteCell, styles.quoteClientLabel]}>Telefone</Text>
          <Text style={[styles.quoteCell, styles.quoteClientValue]}>{valueOrFallback(snapshot.client.phone)}</Text>
          <Text style={[styles.quoteCell, styles.quoteClientLabel]}>E-mail</Text>
          <Text style={[styles.quoteCell, styles.quoteClientValue]}>{valueOrFallback(snapshot.client.email)}</Text>
        </View>

        <Text style={styles.quoteSectionTitle}>Serviços</Text>
        <View style={styles.quoteItemHeader}>
          <Text style={[styles.quoteHeaderCell, styles.quoteItemNumber]}>Item</Text>
          <Text style={[styles.quoteHeaderCell, styles.quoteItemDescription]}>Descrição</Text>
          <Text style={[styles.quoteHeaderCell, styles.quoteItemQuantity]}>Qtd.</Text>
          <Text style={[styles.quoteHeaderCell, styles.quoteItemMoney]}>Valor unit.</Text>
          <Text style={[styles.quoteHeaderCell, styles.quoteItemMoney]}>Subtotal</Text>
        </View>
        {quoteGroups.map((group) => (
          <View key={group.environment}>
            <View style={styles.quoteEnvironmentRow} wrap={false}>
              <Text>{group.environment}</Text>
              <Text>{optionalCurrency(group.items.reduce((sum, item) => sum + item.total, 0))}</Text>
            </View>
            {group.items.map((item) => {
              const displayUnitPrice = item.quantity > 0 ? item.total / item.quantity : item.total
              const details = [
                item.placement,
                item.dimensions,
                item.material,
                item.finish,
                item.notes,
              ].filter(Boolean).join(' · ')

              return (
                <View key={`${group.environment}-${item.itemNumber}`} style={styles.quoteRow} wrap={false}>
                  <Text style={[styles.quoteCell, styles.quoteItemNumber]}>{item.itemNumber}</Text>
                  <View style={[styles.quoteCell, styles.quoteItemDescription]}>
                    <Text>
                      <Text style={styles.quoteServiceName}>{item.description}</Text>
                      <Text style={styles.quoteServiceDetail}>{details ? ` (${details})` : ''}</Text>
                    </Text>
                  </View>
                  <Text style={[styles.quoteCell, styles.quoteItemQuantity]}>{item.quantity}</Text>
                  <Text style={[styles.quoteCell, styles.quoteItemMoney]}>{optionalCurrency(displayUnitPrice)}</Text>
                  <Text style={[styles.quoteCell, styles.quoteItemMoney]}>{optionalCurrency(item.total)}</Text>
                </View>
              )
            })}
          </View>
        ))}
        <View style={styles.quoteTotalRow} wrap={false}>
          <Text style={[styles.quoteCell, styles.quoteTotalLabel]}>TOTAL</Text>
          <Text style={[styles.quoteCell, styles.quoteTotalQuantity]}>{totalQuantity || quoteGroups.reduce((sum, group) => sum + group.items.length, 0)}</Text>
          <Text style={[styles.quoteCell, styles.quoteTotalBlank]}></Text>
          <Text style={[styles.quoteCell, styles.quoteTotalValue]}>{currency(itemSubtotal || snapshot.project.value)}</Text>
        </View>
        <View style={styles.quoteSummaryLine} wrap={false}>
          <Text style={styles.quoteSummaryLabel}>SERVIÇOS:</Text>
          <Text style={styles.quoteSummaryValue}>{currency(itemSubtotal || snapshot.project.value)}</Text>
        </View>
        {snapshot.payment.paymentDiscount ? (
          <View style={styles.quoteSummaryLine} wrap={false}>
            <Text style={styles.quoteSummaryLabel}>DESCONTO:</Text>
            <Text style={styles.quoteSummaryValue}>-{currency(snapshot.payment.paymentDiscount)}</Text>
          </View>
        ) : null}
        {snapshot.payment.cardFeeAmount ? (
          <View style={styles.quoteSummaryLine} wrap={false}>
            <Text style={styles.quoteSummaryLabel}>ACRÉSCIMO DO CARTÃO:</Text>
            <Text style={styles.quoteSummaryValue}>{currency(snapshot.payment.cardFeeAmount)}</Text>
          </View>
        ) : null}
        <View style={styles.quoteSummaryLine} wrap={false}>
          <Text style={styles.quoteSummaryLabel}>TOTAL:</Text>
          <Text style={styles.quoteSummaryValue}>{currency(snapshot.project.value)}</Text>
        </View>

        <View wrap={false}>
          <Text style={styles.quoteSectionTitle}>Dados do pagamento</Text>
          {paymentRows.length > 8 ? (
            <>
              <Text style={styles.quotePaymentSummary}>Forma de pagamento: {snapshot.payment.methodLabel || 'Conforme combinado'}</Text>
              <View style={styles.quoteItemHeader}>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentTripleDue]}>Vencimento</Text>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentTripleAmount]}>Valor</Text>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentTripleDue]}>Vencimento</Text>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentTripleAmount]}>Valor</Text>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentTripleDue]}>Vencimento</Text>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentTripleAmount]}>Valor</Text>
              </View>
              {tripledPayments.map(([left, middle, right]) => (
                <View key={`${left.label}-${left.dueDate}`} style={styles.quoteRow} wrap={false}>
                  <Text style={[styles.quoteCell, styles.quotePaymentTripleDue]}>{left.label}: {dateOnly(left.dueDate)}</Text>
                  <Text style={[styles.quoteCell, styles.quotePaymentTripleAmount]}>{currency(left.amount)}</Text>
                  <Text style={[styles.quoteCell, styles.quotePaymentTripleDue]}>{middle ? `${middle.label}: ${dateOnly(middle.dueDate)}` : ''}</Text>
                  <Text style={[styles.quoteCell, styles.quotePaymentTripleAmount]}>{middle ? currency(middle.amount) : ''}</Text>
                  <Text style={[styles.quoteCell, styles.quotePaymentTripleDue]}>{right ? `${right.label}: ${dateOnly(right.dueDate)}` : ''}</Text>
                  <Text style={[styles.quoteCell, styles.quotePaymentTripleAmount]}>{right ? currency(right.amount) : ''}</Text>
                </View>
              ))}
            </>
          ) : paymentRows.length > 5 ? (
            <>
              <Text style={styles.quotePaymentSummary}>Forma de pagamento: {snapshot.payment.methodLabel || 'Conforme combinado'}</Text>
              <View style={styles.quoteItemHeader}>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentPairDue]}>Vencimento</Text>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentPairAmount]}>Valor</Text>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentPairDue]}>Vencimento</Text>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentPairAmount]}>Valor</Text>
              </View>
              {pairedPayments.map(([left, right]) => (
                <View key={`${left.label}-${left.dueDate}`} style={styles.quoteRow} wrap={false}>
                  <Text style={[styles.quoteCell, styles.quotePaymentPairDue]}>{left.label}: {dateOnly(left.dueDate)}</Text>
                  <Text style={[styles.quoteCell, styles.quotePaymentPairAmount]}>{currency(left.amount)}</Text>
                  <Text style={[styles.quoteCell, styles.quotePaymentPairDue]}>{right ? `${right.label}: ${dateOnly(right.dueDate)}` : ''}</Text>
                  <Text style={[styles.quoteCell, styles.quotePaymentPairAmount]}>{right ? currency(right.amount) : ''}</Text>
                </View>
              ))}
            </>
          ) : (
            <>
              <View style={styles.quoteItemHeader}>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentDue]}>Vencimento</Text>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentAmount]}>Valor</Text>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentMethod]}>Forma de pagamento</Text>
                <Text style={[styles.quoteHeaderCell, styles.quotePaymentObservation]}>Observação</Text>
              </View>
              {paymentRows.map((payment) => (
                <View key={`${payment.type}-${payment.number}`} style={styles.quoteRow} wrap={false}>
                  <Text style={[styles.quoteCell, styles.quotePaymentDue]}>{dateOnly(payment.dueDate)}</Text>
                  <Text style={[styles.quoteCell, styles.quotePaymentAmount]}>{currency(payment.amount)}</Text>
                  <Text style={[styles.quoteCell, styles.quotePaymentMethod]}>{snapshot.payment.methodLabel || 'Conforme combinado'}</Text>
                  <Text style={[styles.quoteCell, styles.quotePaymentObservation]}>{payment.label}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <Text style={styles.quoteNotes} wrap={false}>
          <Text style={styles.quoteBold}>OBSERVAÇÕES: </Text>
          Este pedido, o projeto técnico aprovado e seus anexos integram o contrato. As cláusulas e o aceite das partes estão nas páginas seguintes.
        </Text>

        <ContractFooter companyName={snapshot.company.tradeName} authenticityCode={authenticityCode} />
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.topLine} />
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.label}>Contrato de móveis planejados</Text>
            <Text style={styles.pageTitle}>Condições comerciais e contratuais</Text>
          </View>
          <Text style={styles.pageCode}>{snapshot.project.name}{'\n'}Código {authenticityCode}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cláusulas e condições</Text>
          <Terms terms={primaryTerms} />
        </View>

        {!signatureOnAdditionalPage ? (
          <>
            <Text style={styles.closing}>E, por estarem de acordo com todas as condições, as partes reconhecem este instrumento como expressão de sua vontade.</Text>
            <SignatureBlock input={input} signed={signed} />
          </>
        ) : null}

        <ContractFooter companyName={snapshot.company.tradeName} authenticityCode={authenticityCode} />
      </Page>

      {signatureOnAdditionalPage ? (
        <Page size="A4" style={styles.page}>
          <View style={styles.topLine} />
          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.label}>Contrato de móveis planejados</Text>
              <Text style={styles.pageTitle}>Responsabilidades e aceite</Text>
            </View>
            <Text style={styles.pageCode}>{snapshot.project.name}{'\n'}Código {authenticityCode}</Text>
          </View>

          <Text style={styles.sectionTitle}>Continuação das cláusulas</Text>
          <Terms terms={additionalTerms} startIndex={primaryTerms.length} />
          <Text style={styles.closing}>E, por estarem de acordo com todas as condições, as partes reconhecem este instrumento como expressão de sua vontade.</Text>
          <SignatureBlock input={input} signed={signed} />

          <ContractFooter companyName={snapshot.company.tradeName} authenticityCode={authenticityCode} />
        </Page>
      ) : null}
    </Document>
  )
}

export async function renderProjectContractPdf(input: ProjectContractPdfInput) {
  return renderToBuffer(<ContractDocument input={input} />)
}

export async function renderSignedProjectContractPdf(input: SignedContractPdfInput) {
  return renderProjectContractPdf(input)
}
