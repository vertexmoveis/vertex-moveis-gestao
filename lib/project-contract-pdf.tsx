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
  orangeSoft: '#FFF5EC',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingRight: 32,
    paddingBottom: 42,
    paddingLeft: 32,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: colors.ink,
    lineHeight: 1.35,
  },
  topLine: { height: 5, backgroundColor: colors.orange, marginTop: -30, marginRight: -32, marginLeft: -32, marginBottom: 16 },
  companyHeader: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: { flexDirection: 'row', alignItems: 'flex-start' },
  logo: { width: 50, height: 38, objectFit: 'contain', marginRight: 10 },
  brandName: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  brandSub: { marginTop: 1, fontSize: 8, color: colors.muted },
  companyDetails: { marginTop: 7, color: colors.muted, lineHeight: 1.45 },
  contact: { width: 185, textAlign: 'right', lineHeight: 1.5 },
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
  documentTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  statusBand: {
    marginTop: 6,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusPending: { borderColor: '#F2B986', backgroundColor: colors.orangeSoft },
  statusSigned: { borderColor: '#9DD5BA', backgroundColor: colors.greenSoft },
  statusPendingText: { color: '#9A4500', fontFamily: 'Helvetica-Bold' },
  statusSignedText: { color: colors.green, fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 10 },
  sectionTitle: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingVertical: 4,
    paddingHorizontal: 7,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  partyGrid: { flexDirection: 'row', borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.line },
  party: { flex: 1, minHeight: 70, padding: 8 },
  partySecond: { borderLeftWidth: 1, borderLeftColor: colors.line },
  label: { fontSize: 6.5, color: colors.muted, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 2 },
  value: { fontFamily: 'Helvetica-Bold' },
  details: { marginTop: 4, color: colors.muted, lineHeight: 1.45 },
  summaryGrid: { flexDirection: 'row', borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.line },
  summaryCell: { flex: 1, minHeight: 48, padding: 8 },
  summaryCellBorder: { borderLeftWidth: 1, borderLeftColor: colors.line },
  summaryValue: { marginTop: 2, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totalCell: { flex: 1.15, minHeight: 48, padding: 8, backgroundColor: colors.ink, color: '#FFFFFF' },
  totalLabel: { fontSize: 6.5, color: '#CFCFCF', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  total: { marginTop: 2, color: colors.orange, fontSize: 14, fontFamily: 'Helvetica-Bold' },
  paymentSummary: { borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.line, padding: 7 },
  paymentGrid: { borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.line },
  paymentRow: { flexDirection: 'row' },
  paymentItem: { flex: 1, minHeight: 32, paddingVertical: 5, paddingHorizontal: 7, borderTopWidth: 1, borderTopColor: colors.line },
  paymentItemSecond: { borderLeftWidth: 1, borderLeftColor: colors.line },
  paymentLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  paymentName: { fontFamily: 'Helvetica-Bold' },
  paymentAmount: { fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  paymentDate: { marginTop: 1, fontSize: 7, color: colors.muted },
  pageHeader: { marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  pageTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  pageCode: { color: colors.muted, textAlign: 'right' },
  termList: { borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.line },
  term: { paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: colors.line },
  termTitle: { fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  signature: {
    marginTop: 14,
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.ink,
    paddingRight: 82,
    paddingBottom: 12,
    paddingLeft: 82,
    justifyContent: 'flex-end',
  },
  signatureIntro: { position: 'absolute', top: 12, left: 14, right: 14, color: colors.muted, textAlign: 'center' },
  signatureLine: { borderTopWidth: 1, borderTopColor: colors.ink, paddingTop: 5, textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  signedProof: { marginTop: 14, minHeight: 106, borderWidth: 1, borderColor: '#8CCCAD', backgroundColor: colors.greenSoft, padding: 13 },
  signedTitle: { color: colors.green, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  signedName: { marginTop: 17, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.ink, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  audit: { marginTop: 8, backgroundColor: colors.lighter, borderWidth: 1, borderColor: colors.line, padding: 8, fontSize: 7, color: colors.muted },
  footer: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: 22,
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

function ContractDocument({ input }: { input: ProjectContractPdfInput }) {
  const { snapshot } = input
  const signed = Boolean(input.signedAt && input.signatoryName)
  const authenticityCode = `${input.id.toUpperCase()}-V${input.version}`
  const pairedPayments = Array.from(
    { length: Math.ceil(snapshot.payment.schedule.length / 2) },
    (_, index) => [snapshot.payment.schedule[index * 2], snapshot.payment.schedule[(index * 2) + 1]],
  )

  return (
    <Document title={`Contrato ${snapshot.project.name}`} author={snapshot.company.tradeName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topLine} />
        <View style={styles.companyHeader}>
          <View style={styles.brand}>
            {input.logoDataUrl ? <PdfImage src={input.logoDataUrl} style={styles.logo} /> : null}
            <View>
              <Text style={styles.brandName}>{snapshot.company.tradeName.toUpperCase()}</Text>
              <Text style={styles.brandSub}>{snapshot.company.legalName || 'Móveis planejados'}</Text>
              <View style={styles.companyDetails}>
                <Text>{snapshot.company.document ? `CNPJ: ${snapshot.company.document}` : 'CNPJ não informado'}</Text>
                <Text>{snapshot.company.address || 'Endereço não informado'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.contact}>
            <Text style={styles.contactStrong}>{snapshot.company.phone || 'Telefone não informado'}</Text>
            <Text style={styles.contactStrong}>{snapshot.company.email || 'E-mail não informado'}</Text>
            <Text>Responsável: {snapshot.company.tradeName}</Text>
          </View>
        </View>

        <View style={styles.titleBand}>
          <Text style={styles.documentTitle}>CONTRATO DE FORNECIMENTO</Text>
          <Text>Versão {input.version} · {dateOnly(snapshot.generatedAt)}</Text>
        </View>
        <View style={[styles.statusBand, signed ? styles.statusSigned : styles.statusPending]}>
          <Text style={signed ? styles.statusSignedText : styles.statusPendingText}>
            {signed ? 'ACEITO ELETRONICAMENTE' : 'AGUARDANDO ASSINATURA DO CLIENTE'}
          </Text>
          <Text>Código {authenticityCode}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partes do contrato</Text>
          <View style={styles.partyGrid}>
            <View style={styles.party}>
              <Text style={styles.label}>Contratada</Text>
              <Text style={styles.value}>{snapshot.company.legalName || snapshot.company.tradeName}</Text>
              <View style={styles.details}>
                <Text>{snapshot.company.document || 'Documento não informado'}</Text>
                <Text>{snapshot.company.address || 'Endereço não informado'}</Text>
                <Text>{snapshot.company.phone || snapshot.company.email || ''}</Text>
              </View>
            </View>
            <View style={[styles.party, styles.partySecond]}>
              <Text style={styles.label}>Cliente</Text>
              <Text style={styles.value}>{snapshot.client.name}</Text>
              <View style={styles.details}>
                <Text>{snapshot.client.document || input.signatoryDocument || 'Documento não informado'}</Text>
                <Text>{snapshot.client.address || 'Endereço não informado'}</Text>
                <Text>{snapshot.client.phone || snapshot.client.email || ''}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo do projeto</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCell}>
              <Text style={styles.label}>Projeto</Text>
              <Text style={styles.summaryValue}>{snapshot.project.name}</Text>
              <Text style={styles.details}>{snapshot.project.environments.join(', ') || snapshot.project.room || 'Ambientes não informados'}</Text>
            </View>
            <View style={[styles.summaryCell, styles.summaryCellBorder]}>
              <Text style={styles.label}>Prazo combinado</Text>
              <Text style={styles.summaryValue}>{snapshot.project.deliveryBusinessDays} dias úteis</Text>
              <Text style={styles.details}>Previsão: {dateOnly(snapshot.project.deliveryDeadlineDate)}</Text>
            </View>
            <View style={styles.totalCell}>
              <Text style={styles.totalLabel}>Investimento total</Text>
              <Text style={styles.total}>{currency(snapshot.project.value)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Condições de pagamento</Text>
          <View style={styles.paymentSummary}>
            <Text style={styles.value}>{snapshot.payment.summary || snapshot.payment.methodLabel || 'Condição registrada no projeto'}</Text>
            <Text style={styles.details}>Entrada: {currency(snapshot.payment.downPayment)} · {snapshot.payment.installmentCount} parcela{snapshot.payment.installmentCount !== 1 ? 's' : ''}</Text>
          </View>
          {pairedPayments.length > 0 ? (
            <View style={styles.paymentGrid}>
              {pairedPayments.map((payments, rowIndex) => (
                <View key={`payment-row-${rowIndex}`} style={styles.paymentRow}>
                  {payments.map((payment, columnIndex) => payment ? (
                    <View key={`${payment.type}-${payment.number}-${columnIndex}`} style={[styles.paymentItem, columnIndex === 1 ? styles.paymentItemSecond : {}]}>
                      <View style={styles.paymentLine}>
                        <Text style={styles.paymentName}>{paymentName(payment.type, payment.number)}</Text>
                        <Text style={styles.paymentAmount}>{currency(payment.amount)}</Text>
                      </View>
                      <Text style={styles.paymentDate}>Vencimento: {dateOnly(payment.dueDate)}</Text>
                    </View>
                  ) : <View key={`empty-${columnIndex}`} style={[styles.paymentItem, styles.paymentItemSecond]} />)}
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          <Text>{snapshot.company.tradeName}</Text>
          <Text>{authenticityCode} · Página 1 de 2</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.topLine} />
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.label}>Contrato de fornecimento</Text>
            <Text style={styles.pageTitle}>Condições contratuais</Text>
          </View>
          <Text style={styles.pageCode}>{snapshot.project.name}{'\n'}Código {authenticityCode}</Text>
        </View>

        <Text style={styles.sectionTitle}>Cláusulas e condições</Text>
        <View style={styles.termList}>
          {snapshot.terms.map((term, index) => (
            <View key={`${term.title}-${index}`} style={styles.term} wrap={false}>
              <Text style={styles.termTitle}>{index + 1}. {term.title}</Text>
              <Text>{term.text}</Text>
            </View>
          ))}
        </View>

        {signed ? (
          <View style={styles.signedProof} wrap={false}>
            <Text style={styles.signedTitle}>Aceite eletrônico registrado</Text>
            <Text style={styles.details}>O cliente declarou que leu e concordou com o projeto, os valores, o prazo e as condições deste contrato.</Text>
            <Text style={styles.signedName}>{input.signatoryName}</Text>
            <Text>{input.signatoryDocument ? `Documento: ${input.signatoryDocument}` : 'Documento não informado'}</Text>
            <Text>Aceite registrado em {dateTime(input.signedAt)}</Text>
          </View>
        ) : (
          <View style={styles.signature} wrap={false}>
            <Text style={styles.signatureIntro}>Leia todas as condições acima antes de assinar ou realizar o aceite eletrônico.</Text>
            <Text style={styles.signatureLine}>Assinatura do cliente</Text>
          </View>
        )}

        {signed ? (
          <View style={styles.audit} wrap={false}>
            <Text style={styles.termTitle}>Comprovante e trilha de auditoria</Text>
            <Text>Contrato: {input.id} · Versão: {input.version}</Text>
            <Text>Gerado em: {dateTime(snapshot.generatedAt)} · Aceito em: {dateTime(input.signedAt)}</Text>
            <Text>Identificador técnico: {input.acceptedIpHash ? `${input.acceptedIpHash.slice(0, 24)}...` : 'não disponível'}</Text>
            <Text>Dispositivo informado: {(input.acceptedUserAgent || 'não disponível').slice(0, 160)}</Text>
          </View>
        ) : (
          <View style={styles.audit} wrap={false}>
            <Text style={styles.termTitle}>Aceite eletrônico</Text>
            <Text>Para assinar digitalmente, retorne à página do contrato e preencha a área de assinatura localizada logo abaixo do PDF.</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Documento gerado pelo sistema Vertex Móveis</Text>
          <Text>{authenticityCode} · Página 2 de 2</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderProjectContractPdf(input: ProjectContractPdfInput) {
  return renderToBuffer(<ContractDocument input={input} />)
}

export async function renderSignedProjectContractPdf(input: SignedContractPdfInput) {
  return renderProjectContractPdf(input)
}
