import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'

type PieceLabel = {
  id: string
  label: string
  environment: string | null
  material: string
  finish: string | null
  widthMm: number
  heightMm: number
  quantity: number
  grain: boolean
  qrCode: string
}

const styles = StyleSheet.create({
  page: { padding: 24, fontFamily: 'Helvetica', color: '#151515' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottomWidth: 2, borderBottomColor: '#FF6B00', paddingBottom: 9 },
  brand: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  title: { fontSize: 10, color: '#555555' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  label: { width: '48.8%', height: 150, borderWidth: 1, borderColor: '#BBBBBB', padding: 10, flexDirection: 'row' },
  content: { flexGrow: 1, paddingRight: 8 },
  number: { fontSize: 7, color: '#FF6B00', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  piece: { marginTop: 4, fontSize: 13, fontFamily: 'Helvetica-Bold' },
  environment: { marginTop: 3, fontSize: 9, color: '#555555' },
  measure: { marginTop: 10, fontSize: 16, fontFamily: 'Helvetica-Bold' },
  detail: { marginTop: 4, fontSize: 8, color: '#444444' },
  quantity: { marginTop: 8, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  qr: { width: 64, height: 64 },
  qrHint: { marginTop: 4, width: 64, textAlign: 'center', fontSize: 6, color: '#777777' },
  footer: { position: 'absolute', left: 24, right: 24, bottom: 10, fontSize: 6.5, color: '#777777', textAlign: 'center' },
})

export async function renderProjectLabelsPdf(input: { projectName: string; pieces: PieceLabel[] }) {
  return renderToBuffer(
    <Document title={`Etiquetas - ${input.projectName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>VERTEX MÓVEIS</Text>
          <Text style={styles.title}>{input.projectName} · {input.pieces.length} etiqueta(s)</Text>
        </View>
        <View style={styles.grid}>
          {input.pieces.map((piece, index) => (
            <View key={piece.id} style={styles.label} wrap={false}>
              <View style={styles.content}>
                <Text style={styles.number}>Peça {index + 1}</Text>
                <Text style={styles.piece}>{piece.label}</Text>
                <Text style={styles.environment}>{piece.environment || 'Sem ambiente definido'}</Text>
                <Text style={styles.measure}>{piece.widthMm} × {piece.heightMm} mm</Text>
                <Text style={styles.detail}>{piece.material}{piece.finish ? ` · ${piece.finish}` : ''}{piece.grain ? ' · respeitar veio' : ''}</Text>
                <Text style={styles.quantity}>Quantidade: {piece.quantity}</Text>
              </View>
              <View>
                <PdfImage src={piece.qrCode} style={styles.qr} />
                <Text style={styles.qrHint}>Abrir projeto</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>Etiquetas geradas pelo sistema Vertex. Confira as medidas antes do corte.</Text>
      </Page>
    </Document>
  )
}
