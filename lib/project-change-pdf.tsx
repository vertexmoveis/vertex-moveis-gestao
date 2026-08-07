import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { formatCurrency } from '@/lib/utils'

type Input = {
  id: string
  projectName: string
  clientName: string
  title: string
  description: string
  amountDelta: number
  daysDelta: number
  status: string
  respondentName: string | null
  responseNote: string | null
  respondedAt: Date | null
  ipHash: string | null
  createdAt: Date
}

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: 'Helvetica', fontSize: 10, color: '#151515', lineHeight: 1.45 },
  line: { height: 5, backgroundColor: '#FF6B00', margin: -42, marginBottom: 32 },
  eyebrow: { fontSize: 8, color: '#FF6B00', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginTop: 5 },
  muted: { color: '#666666', marginTop: 4 },
  grid: { flexDirection: 'row', gap: 10, marginTop: 22 },
  box: { flex: 1, borderWidth: 1, borderColor: '#DDDDDD', padding: 12 },
  label: { fontSize: 7, color: '#777777', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 5 },
  value: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', borderBottomWidth: 1, borderBottomColor: '#151515', paddingBottom: 5, marginBottom: 9 },
  proof: { marginTop: 22, borderLeftWidth: 4, borderLeftColor: '#07824C', backgroundColor: '#EFFAF5', padding: 14 },
  proofTitle: { color: '#07824C', fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 7 },
  footer: { position: 'absolute', bottom: 28, left: 42, right: 42, borderTopWidth: 1, borderTopColor: '#DDDDDD', paddingTop: 7, flexDirection: 'row', justifyContent: 'space-between', color: '#777777', fontSize: 7 },
})

export function renderProjectChangePdf(input: Input) {
  const accepted = ['CLIENT_APPROVED', 'APPROVED'].includes(input.status)
  return renderToBuffer(
    <Document title={`Alteração - ${input.title}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.line} />
        <Text style={styles.eyebrow}>Vertex Móveis · Registro de alteração</Text>
        <Text style={styles.title}>{input.title}</Text>
        <Text style={styles.muted}>{input.projectName} · {input.clientName}</Text>
        <View style={styles.grid}>
          <View style={styles.box}><Text style={styles.label}>Ajuste de valor</Text><Text style={styles.value}>{formatCurrency(input.amountDelta)}</Text></View>
          <View style={styles.box}><Text style={styles.label}>Prazo adicional</Text><Text style={styles.value}>{input.daysDelta} dia(s) útil(eis)</Text></View>
          <View style={styles.box}><Text style={styles.label}>Situação</Text><Text style={styles.value}>{accepted ? 'Aceita pelo cliente' : 'Revisão solicitada'}</Text></View>
        </View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Descrição da alteração</Text><Text>{input.description}</Text></View>
        <View style={styles.proof}>
          <Text style={styles.proofTitle}>{accepted ? 'Aceite registrado' : 'Resposta registrada'}</Text>
          <Text>Respondente: {input.respondentName || 'Não informado'}</Text>
          <Text>Data e hora: {input.respondedAt ? input.respondedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não registrada'}</Text>
          {input.responseNote ? <Text>Observação: {input.responseNote}</Text> : null}
          <Text>Identificador técnico: {input.ipHash || 'Não disponível'}</Text>
        </View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Rastreabilidade</Text><Text>Alteração criada em {input.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Documento gerado a partir dos dados registrados no CRM Vertex.</Text></View>
        <View style={styles.footer}><Text>Vertex Móveis · Gestão de marcenaria</Text><Text>{input.id.toUpperCase()}</Text></View>
      </Page>
    </Document>,
  )
}
