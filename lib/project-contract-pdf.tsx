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

type SignedContractPdfInput = {
  id: string
  version: number
  snapshot: ProjectContractSnapshot
  signedAt: Date
  signatoryName: string
  signatoryDocument: string | null
  acceptedIpHash: string | null
  acceptedUserAgent: string | null
  logoDataUrl?: string
}

const colors = {
  orange: '#FF6B00',
  ink: '#151515',
  muted: '#666666',
  line: '#DDDDDD',
  soft: '#F6F6F6',
  green: '#087A46',
}

const styles = StyleSheet.create({
  page: { padding: 38, fontFamily: 'Helvetica', fontSize: 9, color: colors.ink, lineHeight: 1.4 },
  topLine: { height: 4, backgroundColor: colors.orange, margin: -38, marginBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  brand: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  logo: { width: 44, height: 32, objectFit: 'contain' },
  brandName: { fontSize: 17, fontFamily: 'Helvetica-Bold' },
  eyebrow: { fontSize: 7, color: colors.orange, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  title: { marginTop: 4, fontSize: 18, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  pageTitle: { marginTop: 4, fontSize: 18, fontFamily: 'Helvetica-Bold' },
  headerMain: { flexGrow: 1, paddingRight: 16 },
  codeBox: { width: 190, textAlign: 'right' },
  right: { textAlign: 'right' },
  muted: { color: colors.muted },
  proof: { borderLeftWidth: 3, borderLeftColor: colors.green, backgroundColor: '#F0FAF5', padding: 12, marginBottom: 18 },
  proofTitle: { color: colors.green, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 16 },
  sectionTitle: { borderBottomWidth: 1, borderBottomColor: colors.ink, paddingBottom: 5, marginBottom: 8, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  grid: { flexDirection: 'row', gap: 10 },
  box: { flex: 1, borderWidth: 1, borderColor: colors.line, padding: 10, minHeight: 72 },
  label: { fontSize: 6.5, color: colors.muted, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 3 },
  value: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  totalBox: { backgroundColor: colors.ink, color: '#FFFFFF', padding: 12, marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { color: colors.orange, fontSize: 16, fontFamily: 'Helvetica-Bold' },
  table: { borderWidth: 1, borderColor: colors.line },
  tableHeader: { flexDirection: 'row', backgroundColor: colors.soft, borderBottomWidth: 1, borderBottomColor: colors.line },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  cell: { padding: 6, flex: 1 },
  cellWide: { padding: 6, flex: 2 },
  cellRight: { padding: 6, flex: 1, textAlign: 'right' },
  term: { marginBottom: 9 },
  termTitle: { fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  signature: { marginTop: 24, borderWidth: 1, borderColor: colors.line, padding: 14 },
  signatureName: { marginTop: 14, paddingTop: 7, borderTopWidth: 1, borderTopColor: colors.ink, fontFamily: 'Helvetica-Bold' },
  audit: { marginTop: 12, backgroundColor: colors.soft, padding: 10, fontSize: 7.5, color: colors.muted },
  footer: { position: 'absolute', left: 38, right: 38, bottom: 24, paddingTop: 7, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: colors.muted },
  footerMain: { flexGrow: 1, paddingRight: 12 },
  footerCode: { width: 190, textAlign: 'right' },
})

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function dateTime(value: Date | string | null) {
  if (!value) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value))
}

function dateOnly(value: string | null) {
  if (!value) return 'Não informado'
  const key = value.slice(0, 10)
  const [year, month, day] = key.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function ContractDocument({ input }: { input: SignedContractPdfInput }) {
  const { snapshot } = input
  const authenticityCode = `${input.id.toUpperCase()}-V${input.version}`

  return (
    <Document title={`Contrato ${snapshot.project.name}`} author={snapshot.company.tradeName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topLine} />
        <View style={styles.header}>
          <View style={styles.brand}>
            {input.logoDataUrl ? <PdfImage src={input.logoDataUrl} style={styles.logo} /> : null}
            <View>
              <Text style={styles.brandName}>{snapshot.company.tradeName}</Text>
              <Text style={styles.muted}>Móveis planejados</Text>
            </View>
          </View>
          <View>
            <Text style={[styles.eyebrow, styles.right]}>Contrato digital aceito</Text>
            <Text style={styles.title}>{snapshot.project.name}</Text>
            <Text style={[styles.muted, styles.right]}>Versão {input.version}</Text>
          </View>
        </View>

        <View style={styles.proof}>
          <Text style={styles.proofTitle}>Aceite registrado com sucesso</Text>
          <Text>Cliente: {input.signatoryName} · Aceito em {dateTime(input.signedAt)}</Text>
          <Text style={styles.muted}>Código de autenticação: {authenticityCode}</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.box}>
            <Text style={styles.label}>Contratada</Text>
            <Text style={styles.value}>{snapshot.company.tradeName}</Text>
            <Text>{snapshot.company.document || 'Documento não informado'}</Text>
            <Text>{snapshot.company.address || 'Endereço não informado'}</Text>
            <Text>{snapshot.company.phone || snapshot.company.email || ''}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Cliente</Text>
            <Text style={styles.value}>{snapshot.client.name}</Text>
            <Text>{snapshot.client.document || input.signatoryDocument || 'Documento não informado'}</Text>
            <Text>{snapshot.client.address || 'Endereço não informado'}</Text>
            <Text>{snapshot.client.phone || snapshot.client.email || ''}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo do projeto</Text>
          <View style={styles.grid}>
            <View style={styles.box}>
              <Text style={styles.label}>Projeto</Text>
              <Text style={styles.value}>{snapshot.project.name}</Text>
              <Text>{snapshot.project.environments.join(', ') || snapshot.project.room || 'Ambientes não informados'}</Text>
            </View>
            <View style={styles.box}>
              <Text style={styles.label}>Prazo combinado</Text>
              <Text style={styles.value}>{snapshot.project.deliveryBusinessDays} dias úteis</Text>
              <Text>Previsão: {dateOnly(snapshot.project.deliveryDeadlineDate)}</Text>
            </View>
          </View>
          <View style={styles.totalBox}>
            <Text>Investimento total</Text>
            <Text style={styles.total}>{currency(snapshot.project.value)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Condições de pagamento</Text>
          <Text style={styles.value}>{snapshot.payment.summary || snapshot.payment.methodLabel || 'Condição registrada no projeto'}</Text>
          <Text style={styles.muted}>Entrada: {currency(snapshot.payment.downPayment)} · Parcelas: {snapshot.payment.installmentCount}</Text>
          {snapshot.payment.schedule.length > 0 ? (
            <View style={[styles.table, { marginTop: 8 }]}>
              <View style={styles.tableHeader}>
                <Text style={styles.cell}>Parcela</Text>
                <Text style={styles.cellWide}>Vencimento</Text>
                <Text style={styles.cellRight}>Valor</Text>
              </View>
              {snapshot.payment.schedule.slice(0, 8).map((payment, index) => (
                <View key={`${payment.type}-${payment.number}-${index}`} style={styles.tableRow}>
                  <Text style={styles.cell}>{payment.type === 'DOWN_PAYMENT' ? 'Entrada' : `${payment.number}`}</Text>
                  <Text style={styles.cellWide}>{dateOnly(payment.dueDate)}</Text>
                  <Text style={styles.cellRight}>{currency(payment.amount)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerMain}>{snapshot.company.tradeName}</Text>
          <Text style={styles.footerCode}>{authenticityCode} · Página 1</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.topLine} />
        <View style={styles.header}>
          <View style={styles.headerMain}>
            <Text style={styles.eyebrow}>Condições contratuais</Text>
            <Text style={styles.pageTitle}>{snapshot.project.name}</Text>
          </View>
          <Text style={[styles.muted, styles.codeBox]}>Código {authenticityCode}</Text>
        </View>

        <View style={styles.section}>
          {snapshot.terms.map((term, index) => (
            <View key={`${term.title}-${index}`} style={styles.term} wrap={false}>
              <Text style={styles.termTitle}>{index + 1}. {term.title}</Text>
              <Text>{term.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.signature} wrap={false}>
          <Text style={styles.label}>Comprovante de aceite eletrônico</Text>
          <Text>Declaro que li e concordo com as condições deste contrato e com os dados comerciais congelados na versão {input.version}.</Text>
          <Text style={styles.signatureName}>{input.signatoryName}</Text>
          <Text>{input.signatoryDocument ? `Documento: ${input.signatoryDocument}` : 'Documento não informado'}</Text>
          <Text>Aceite registrado em {dateTime(input.signedAt)}</Text>
        </View>

        <View style={styles.audit} wrap={false}>
          <Text style={styles.termTitle}>Trilha de auditoria</Text>
          <Text>Contrato: {input.id} · Versão: {input.version}</Text>
          <Text>Gerado em: {dateTime(snapshot.generatedAt)} · Aceito em: {dateTime(input.signedAt)}</Text>
          <Text>Identificador técnico: {input.acceptedIpHash ? `${input.acceptedIpHash.slice(0, 24)}...` : 'não disponível'}</Text>
          <Text>Dispositivo informado: {(input.acceptedUserAgent || 'não disponível').slice(0, 160)}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerMain}>Documento gerado pelo sistema Vertex Móveis</Text>
          <Text style={styles.footerCode}>{authenticityCode} · Página 2</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderSignedProjectContractPdf(input: SignedContractPdfInput) {
  return renderToBuffer(<ContractDocument input={input} />)
}
