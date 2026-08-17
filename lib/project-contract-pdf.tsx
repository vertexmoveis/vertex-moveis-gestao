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
  statusBand: {
    marginTop: 5,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusPending: { borderColor: '#F2B986', backgroundColor: colors.orangeSoft },
  statusSigned: { borderColor: '#9DD5BA', backgroundColor: colors.greenSoft },
  statusPendingText: { color: '#9A4500', fontFamily: 'Helvetica-Bold' },
  statusSignedText: { color: colors.green, fontFamily: 'Helvetica-Bold' },
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
  partyGrid: {
    flexDirection: 'row',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.line,
  },
  party: { flex: 1, minHeight: 72, padding: 8 },
  partySecond: { borderLeftWidth: 1, borderLeftColor: colors.line },
  label: {
    fontSize: 6.5,
    color: colors.muted,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: { fontFamily: 'Helvetica-Bold' },
  details: { marginTop: 3, color: colors.muted, lineHeight: 1.45 },
  intro: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.line,
    paddingVertical: 7,
    paddingHorizontal: 8,
    textAlign: 'justify',
  },
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
  const pairedPayments = Array.from(
    { length: Math.ceil(snapshot.payment.schedule.length / 2) },
    (_, index) => [snapshot.payment.schedule[index * 2], snapshot.payment.schedule[(index * 2) + 1]],
  )
  const fallbackEnvironments = snapshot.project.environments.length > 0
    ? snapshot.project.environments
    : [snapshot.project.room || 'Projeto completo']
  const scope = snapshot.project.scope?.length ? snapshot.project.scope : fallbackEnvironments.map((environment) => ({
    environment,
    furniture: [],
    specifications: [],
  }))
  const primaryTerms = snapshot.terms.slice(0, 7)
  const additionalTerms = snapshot.terms.slice(7)
  const signatureOnAdditionalPage = additionalTerms.length > 0

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
          <Text style={styles.documentTitle}>CONTRATO DE PRESTAÇÃO DE SERVIÇOS E FORNECIMENTO DE MÓVEIS PLANEJADOS</Text>
          <Text>Versão {input.version} · {dateOnly(snapshot.generatedAt)}</Text>
        </View>
        <View style={[styles.statusBand, signed ? styles.statusSigned : styles.statusPending]}>
          <Text style={signed ? styles.statusSignedText : styles.statusPendingText}>
            {signed ? 'ACEITO ELETRONICAMENTE' : 'AGUARDANDO ASSINATURA DO CLIENTE'}
          </Text>
          <Text>Código {authenticityCode}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Qualificação das partes</Text>
          <View style={styles.partyGrid}>
            <View style={styles.party}>
              <Text style={styles.label}>Contratada</Text>
              <Text style={styles.value}>{snapshot.company.legalName || snapshot.company.tradeName}</Text>
              <View style={styles.details}>
                <Text>{snapshot.company.document ? `CNPJ: ${snapshot.company.document}` : 'CNPJ não informado'}</Text>
                <Text>{snapshot.company.address || 'Endereço não informado'}</Text>
                <Text>{snapshot.company.phone || snapshot.company.email || ''}</Text>
              </View>
            </View>
            <View style={[styles.party, styles.partySecond]}>
              <Text style={styles.label}>Contratante</Text>
              <Text style={styles.value}>{snapshot.client.name}</Text>
              <View style={styles.details}>
                <Text>{snapshot.client.document || input.signatoryDocument || 'CPF/CNPJ não informado'}</Text>
                <Text>{snapshot.client.address || 'Endereço não informado'}</Text>
                <Text>{snapshot.client.phone || snapshot.client.email || ''}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.intro}>
            Pelo presente instrumento particular, as partes acima qualificadas celebram este contrato, que será regido pelo projeto aprovado, pelo quadro financeiro e pelas cláusulas descritas nas páginas seguintes.
          </Text>
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
          <Text style={styles.sectionTitle}>Ambientes e escopo contratado</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableCell, styles.scopeEnvironment]}><Text style={styles.tableHeadText}>Ambiente</Text></View>
              <View style={[styles.tableCell, styles.tableCellBorder, styles.scopeFurniture]}><Text style={styles.tableHeadText}>Móveis previstos</Text></View>
              <View style={[styles.tableCell, styles.tableCellBorder, styles.scopeSpecification]}><Text style={styles.tableHeadText}>Materiais e acabamentos</Text></View>
            </View>
            {scope.map((entry, index) => (
              <View key={`${entry.environment}-${index}`} style={index === 0 ? styles.tableRowFirst : styles.tableRow} wrap={false}>
                <View style={[styles.tableCell, styles.scopeEnvironment]}><Text style={styles.scopePrimary}>{entry.environment}</Text></View>
                <View style={[styles.tableCell, styles.tableCellBorder, styles.scopeFurniture]}>
                  <Text>{compactText(entry.furniture, 'Conforme projeto técnico aprovado', 230)}</Text>
                </View>
                <View style={[styles.tableCell, styles.tableCellBorder, styles.scopeSpecification]}>
                  <Text>{compactText(entry.specifications, 'Conforme projeto aprovado', 130)}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.scopeNote}>O projeto técnico aprovado e seus anexos complementam esta descrição e prevalecem quanto a medidas, divisões e posicionamento.</Text>
          </View>
        </View>

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

        <View>
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
