import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import { formatClientAddress } from '@/lib/address'
import { addBusinessDays } from '@/lib/business-days'
import {
  formatCompanyAddress,
  type CompanyProfileData,
} from '@/lib/company-profile'
import { formatDateOnly } from '@/lib/date-only'
import type { QuoteApprovalData } from '@/lib/quote-approval'
import {
  getQuotePaymentDetails,
  quoteCentimetersToMillimeters,
  quoteDisplayCode,
  quoteVariationDisplayName,
  type QuoteDocumentLabel,
} from '@/lib/quotes'

const colors = {
  ink: '#151515',
  muted: '#626262',
  line: '#CFCFCF',
  soft: '#ECECEC',
  softer: '#F7F7F7',
  orange: '#FF6500',
  white: '#FFFFFF',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 16,
    paddingRight: 28,
    paddingBottom: 30,
    paddingLeft: 28,
    color: colors.ink,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.3,
  },
  pageDense: {
    fontSize: 9.2,
    lineHeight: 1.18,
  },
  company: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 7,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '66%',
  },
  logo: {
    width: 40,
    height: 29,
    objectFit: 'contain',
  },
  companyName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
    textTransform: 'uppercase',
  },
  companyLegal: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 9.5,
  },
  companyLine: {
    marginTop: 1,
    color: '#333333',
    fontSize: 9.5,
  },
  companyContact: {
    width: '31%',
    textAlign: 'right',
    fontSize: 9.5,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  titleBar: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  titleBarMain: {
    width: '60%',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    textAlign: 'center',
  },
  titleBarSpacer: {
    width: '20%',
  },
  titleBarDate: {
    width: '20%',
    textAlign: 'right',
  },
  delivery: {
    marginTop: 3,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.softer,
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  deliveryRow: {
    flexDirection: 'row',
    gap: 5,
  },
  optionDelivery: {
    width: '30%',
  },
  forecastDelivery: {
    width: '70%',
  },
  sectionTitle: {
    marginTop: 4,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  clientLabel: {
    width: '16%',
    backgroundColor: '#FAFAFA',
    fontFamily: 'Helvetica-Bold',
  },
  clientValue: {
    width: '34%',
  },
  itemHeader: {
    flexDirection: 'row',
    backgroundColor: colors.softer,
  },
  itemNumber: {
    width: '7%',
    textAlign: 'center',
  },
  itemDescription: {
    width: '53%',
  },
  itemQuantity: {
    width: '10%',
    textAlign: 'right',
  },
  itemMoney: {
    width: '15%',
    textAlign: 'right',
  },
  headerCell: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    paddingVertical: 3,
    paddingHorizontal: 5,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  environmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingVertical: 3,
    paddingHorizontal: 5,
    fontFamily: 'Helvetica-Bold',
  },
  serviceName: {
    fontFamily: 'Helvetica-Bold',
  },
  serviceDetail: {
    color: colors.muted,
    fontSize: 8.5,
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#F4F4F4',
    fontFamily: 'Helvetica-Bold',
  },
  totalLabel: {
    width: '60%',
  },
  totalQuantity: {
    width: '10%',
    textAlign: 'right',
  },
  totalBlank: {
    width: '15%',
  },
  totalValue: {
    width: '15%',
    textAlign: 'right',
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    paddingVertical: 3,
    paddingHorizontal: 5,
    fontFamily: 'Helvetica-Bold',
  },
  summaryLineLabel: {
    width: '75%',
    textAlign: 'right',
  },
  summaryLineValue: {
    width: '25%',
    textAlign: 'right',
  },
  paymentDue: {
    width: '22%',
  },
  paymentAmount: {
    width: '22%',
    textAlign: 'right',
  },
  paymentMethod: {
    width: '31%',
  },
  paymentObservation: {
    width: '25%',
  },
  paymentPairDue: {
    width: '24%',
  },
  paymentPairAmount: {
    width: '26%',
    textAlign: 'right',
  },
  paymentMethodSummary: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.softer,
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  notes: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 4,
    lineHeight: 1.25,
  },
  signature: {
    marginTop: 12,
    minHeight: 88,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: colors.ink,
    paddingRight: 82,
    paddingBottom: 12,
    paddingLeft: 82,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderColor: colors.ink,
    paddingTop: 4,
    textAlign: 'center',
    fontSize: 8.5,
  },
  signatureDense: {
    marginTop: 6,
    minHeight: 42,
    paddingBottom: 6,
  },
  continuationHeader: {
    position: 'absolute',
    right: 28,
    top: 9,
    left: 28,
    color: colors.muted,
    fontSize: 8,
    textAlign: 'right',
  },
  footerLeft: {
    position: 'absolute',
    bottom: 13,
    left: 28,
    color: colors.muted,
    fontSize: 8,
  },
  footerRight: {
    position: 'absolute',
    right: 28,
    bottom: 13,
    width: 180,
    color: colors.muted,
    fontSize: 8,
    textAlign: 'right',
  },
  footerRule: {
    position: 'absolute',
    right: 28,
    bottom: 24,
    left: 28,
    borderTopWidth: 0.6,
    borderColor: colors.line,
  },
})

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function valueOrFallback(value?: string | null) {
  return value?.trim() || 'Não informado'
}

function groupedQuoteItems(quote: QuoteApprovalData) {
  const groups = new Map<string, QuoteApprovalData['items']>()

  for (const item of quote.items) {
    const environment = item.environmentName || item.environment || 'Ambiente'
    const items = groups.get(environment) || []
    items.push(item)
    groups.set(environment, items)
  }

  return Array.from(groups, ([environment, items]) => ({ environment, items }))
}

function SimpleQuotePdf({
  quote,
  company,
  logoUrl,
  documentLabel = 'Orçamento',
}: {
  quote: QuoteApprovalData
  company: CompanyProfileData
  logoUrl?: string
  documentLabel?: QuoteDocumentLabel
}) {
  const documentLabelUpper = documentLabel.toLocaleUpperCase('pt-BR')
  const payment = getQuotePaymentDetails(quote)
  const companyAddress = formatCompanyAddress(company)
  const clientAddress = formatClientAddress(quote.client)
  const deliveryForecast = addBusinessDays(
    quote.createdAt,
    quote.deliveryBusinessDays || 30,
  )
  const groups = groupedQuoteItems(quote)
  const itemNumbers = new Map(quote.items.map((item, index) => [item.id, index + 1]))
  const itemSubtotal = quote.items.reduce((sum, item) => sum + item.total, 0)
  const totalQuantity = quote.items.reduce((sum, item) => sum + item.quantity, 0)
  const financialDetails = [
    ...(quote.installationFee > 0 ? [{ label: 'INSTALAÇÃO', value: quote.installationFee }] : []),
    ...(quote.manualDiscount > 0 ? [{ label: 'DESCONTO COMERCIAL', value: -quote.manualDiscount }] : []),
    ...(quote.paymentDiscount > 0 ? [{ label: 'DESCONTO PIX', value: -quote.paymentDiscount }] : []),
  ]
  const paymentRows = payment.method === 'CARD'
    ? [
        ...(payment.downPayment > 0
          ? [{
              label: 'Entrada',
              dueDate: quote.createdAt,
              amount: payment.downPayment,
              method: 'Entrada',
            }]
          : []),
        ...payment.installments.map((installment) => ({
          label: `Parcela ${installment.number}`,
          dueDate: installment.dueDate,
          amount: installment.amount,
          method: 'Cartão de crédito',
        })),
      ]
    : [{
        label: payment.method === 'PIX' ? 'Pagamento à vista' : 'Pagamento',
        dueDate: quote.createdAt,
        amount: payment.total,
      method: payment.methodLabel,
      }]
  const streetAddress = [
    quote.client.street || quote.client.address,
    quote.client.number,
    quote.client.neighborhood,
  ].filter(Boolean).join(', ')
  const pairedPaymentRows = Array.from(
    { length: Math.ceil(paymentRows.length / 2) },
    (_, index) => [paymentRows[index * 2], paymentRows[(index * 2) + 1]],
  )
  const denseDocument = quote.items.length + paymentRows.length > 15
  return (
    <Document
      title={`${documentLabel} ${quoteDisplayCode(quote)} - ${quote.title}`}
      author={company.tradeName}
      subject={`${documentLabel} de móveis planejados`}
      creator="Sistema Vertex"
    >
      <Page size="A4" style={[styles.page, denseDocument ? styles.pageDense : {}]}>
        <Text style={styles.continuationHeader} fixed>
          {documentLabelUpper} {quoteDisplayCode(quote)} | {quote.client.name}
        </Text>
        <View style={styles.footerRule} fixed />
        <Text style={styles.footerLeft} fixed>
          {company.tradeName} | {documentLabel} {quoteDisplayCode(quote)}
        </Text>
        <Text style={styles.footerRight} fixed>
          Documento gerado pelo sistema Vertex
        </Text>
        <View style={styles.company} wrap={false}>
          <View style={styles.brand}>
            {/* @react-pdf/renderer Image does not expose the HTML alt attribute. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
            <View>
              <Text style={styles.companyName}>{company.tradeName}</Text>
              {company.legalName ? <Text style={styles.companyLegal}>{company.legalName}</Text> : null}
              <Text style={styles.companyLine}>
                {[company.document ? `CNPJ: ${company.document}` : '', ...companyAddress].filter(Boolean).join(' | ')}
              </Text>
            </View>
          </View>
          <View style={styles.companyContact}>
            {company.phone ? <Text style={styles.bold}>{company.phone}</Text> : null}
            {company.email ? <Text>{company.email}</Text> : null}
            <Text style={styles.companyLine}>Responsável: {company.tradeName}</Text>
          </View>
        </View>

        <View style={styles.titleBar} wrap={false}>
          <Text style={styles.titleBarSpacer}></Text>
          <Text style={styles.titleBarMain}>{documentLabelUpper} Nº {quoteDisplayCode(quote)}</Text>
          <Text style={styles.titleBarDate}>{formatDateOnly(quote.createdAt)}</Text>
        </View>
        <View style={styles.deliveryRow} wrap={false}>
          <Text style={[styles.delivery, styles.optionDelivery]}>OPÇÃO: {quoteVariationDisplayName(quote)}</Text>
          <Text style={[styles.delivery, styles.forecastDelivery]}>
            ENTREGA: {formatDateOnly(deliveryForecast)} ({quote.deliveryBusinessDays || 30} dias úteis após aprovação e pagamento)
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Dados do cliente</Text>
        <View style={styles.row} wrap={false}>
          <Text style={[styles.cell, styles.clientLabel]}>Cliente</Text>
          <Text style={[styles.cell, styles.clientValue]}>{quote.client.name}</Text>
          <Text style={[styles.cell, styles.clientLabel]}>CPF/CNPJ</Text>
          <Text style={[styles.cell, styles.clientValue]}>{valueOrFallback(quote.client.document)}</Text>
        </View>
        <View style={styles.row} wrap={false}>
          <Text style={[styles.cell, styles.clientLabel]}>Endereço</Text>
          <Text style={[styles.cell, styles.clientValue]}>{valueOrFallback(streetAddress || clientAddress)}</Text>
          <Text style={[styles.cell, styles.clientLabel]}>CEP</Text>
          <Text style={[styles.cell, styles.clientValue]}>{valueOrFallback(quote.client.zipCode)}</Text>
        </View>
        <View style={styles.row} wrap={false}>
          <Text style={[styles.cell, styles.clientLabel]}>Cidade</Text>
          <Text style={[styles.cell, styles.clientValue]}>{valueOrFallback(quote.client.city)}</Text>
          <Text style={[styles.cell, styles.clientLabel]}>Estado</Text>
          <Text style={[styles.cell, styles.clientValue]}>{valueOrFallback(quote.client.state)}</Text>
        </View>
        <View style={styles.row} wrap={false}>
          <Text style={[styles.cell, styles.clientLabel]}>Telefone</Text>
          <Text style={[styles.cell, styles.clientValue]}>{valueOrFallback(quote.client.whatsapp || quote.client.phone)}</Text>
          <Text style={[styles.cell, styles.clientLabel]}>E-mail</Text>
          <Text style={[styles.cell, styles.clientValue]}>{valueOrFallback(quote.client.email)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Serviços</Text>
        <View style={styles.itemHeader}>
          <Text style={[styles.headerCell, styles.itemNumber]}>Item</Text>
          <Text style={[styles.headerCell, styles.itemDescription]}>Descrição</Text>
          <Text style={[styles.headerCell, styles.itemQuantity]}>Qtd.</Text>
          <Text style={[styles.headerCell, styles.itemMoney]}>Valor unit.</Text>
          <Text style={[styles.headerCell, styles.itemMoney]}>Subtotal</Text>
        </View>
        {groups.map((group) => (
          <View key={group.environment}>
            <View style={styles.environmentRow} wrap={false}>
              <Text>{group.environment}</Text>
              <Text>{formatCurrency(group.items.reduce((sum, item) => sum + item.total, 0))}</Text>
            </View>
            {group.items.map((item) => {
              const unitValue = item.quantity > 0 ? item.total / item.quantity : item.total
              const details = [
                item.placement,
                `${quoteCentimetersToMillimeters(item.width)} x ${quoteCentimetersToMillimeters(item.height)} mm`,
                item.notes,
              ].filter(Boolean).join(' · ')

              return (
                <View key={item.id} style={styles.row} wrap={false}>
                  <Text style={[styles.cell, styles.itemNumber]}>{itemNumbers.get(item.id)}</Text>
                  <View style={[styles.cell, styles.itemDescription]}>
                    <Text>
                      <Text style={styles.serviceName}>{item.description}</Text>
                      <Text style={styles.serviceDetail}>{details ? ` (${details})` : ''}</Text>
                    </Text>
                  </View>
                  <Text style={[styles.cell, styles.itemQuantity]}>{item.quantity}</Text>
                  <Text style={[styles.cell, styles.itemMoney]}>{formatCurrency(unitValue)}</Text>
                  <Text style={[styles.cell, styles.itemMoney]}>{formatCurrency(item.total)}</Text>
                </View>
              )
            })}
          </View>
        ))}
        <View style={styles.totalRow} wrap={false}>
          <Text style={[styles.cell, styles.totalLabel]}>TOTAL</Text>
          <Text style={[styles.cell, styles.totalQuantity]}>{totalQuantity}</Text>
          <Text style={[styles.cell, styles.totalBlank]}></Text>
          <Text style={[styles.cell, styles.totalValue]}>{formatCurrency(itemSubtotal)}</Text>
        </View>
        <View style={styles.summaryLine} wrap={false}>
          <Text style={styles.summaryLineLabel}>SERVIÇOS:</Text>
          <Text style={styles.summaryLineValue}>{formatCurrency(itemSubtotal)}</Text>
        </View>
        {financialDetails.map((detail) => (
          <View key={detail.label} style={styles.summaryLine} wrap={false}>
            <Text style={styles.summaryLineLabel}>{detail.label}:</Text>
            <Text style={styles.summaryLineValue}>{formatCurrency(detail.value)}</Text>
          </View>
        ))}
        <View style={styles.summaryLine} wrap={false}>
          <Text style={styles.summaryLineLabel}>TOTAL:</Text>
          <Text style={styles.summaryLineValue}>{formatCurrency(quote.total)}</Text>
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>Dados do pagamento</Text>
          {paymentRows.length > 5 ? (
            <>
              <Text style={styles.paymentMethodSummary}>Forma de pagamento: {payment.methodLabel}</Text>
              <View style={styles.itemHeader}>
                <Text style={[styles.headerCell, styles.paymentPairDue]}>Vencimento</Text>
                <Text style={[styles.headerCell, styles.paymentPairAmount]}>Valor</Text>
                <Text style={[styles.headerCell, styles.paymentPairDue]}>Vencimento</Text>
                <Text style={[styles.headerCell, styles.paymentPairAmount]}>Valor</Text>
              </View>
              {pairedPaymentRows.map(([left, right]) => (
                <View key={`${left.label}-${left.dueDate || ''}`} style={styles.row} wrap={false}>
                  <Text style={[styles.cell, styles.paymentPairDue]}>{left.label}: {left.dueDate ? formatDateOnly(left.dueDate) : 'A combinar'}</Text>
                  <Text style={[styles.cell, styles.paymentPairAmount]}>{formatCurrency(left.amount)}</Text>
                  <Text style={[styles.cell, styles.paymentPairDue]}>{right ? `${right.label}: ${right.dueDate ? formatDateOnly(right.dueDate) : 'A combinar'}` : ''}</Text>
                  <Text style={[styles.cell, styles.paymentPairAmount]}>{right ? formatCurrency(right.amount) : ''}</Text>
                </View>
              ))}
            </>
          ) : (
            <>
              <View style={styles.itemHeader}>
                <Text style={[styles.headerCell, styles.paymentDue]}>Vencimento</Text>
                <Text style={[styles.headerCell, styles.paymentAmount]}>Valor</Text>
                <Text style={[styles.headerCell, styles.paymentMethod]}>Forma de pagamento</Text>
                <Text style={[styles.headerCell, styles.paymentObservation]}>Observação</Text>
              </View>
              {paymentRows.map((row) => (
                <View key={`${row.label}-${row.dueDate || ''}`} style={styles.row} wrap={false}>
                  <Text style={[styles.cell, styles.paymentDue]}>{row.dueDate ? formatDateOnly(row.dueDate) : 'A combinar'}</Text>
                  <Text style={[styles.cell, styles.paymentAmount]}>{formatCurrency(row.amount)}</Text>
                  <Text style={[styles.cell, styles.paymentMethod]}>{row.method}</Text>
                  <Text style={[styles.cell, styles.paymentObservation]}>{row.label}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {quote.customerNotes ? (
          <Text style={styles.notes} wrap={false}>
            <Text style={styles.bold}>OBSERVAÇÕES: </Text>
            {quote.customerNotes}
          </Text>
        ) : null}

        <View style={[styles.signature, denseDocument ? styles.signatureDense : {}]} wrap={false}>
          <Text style={styles.signatureLine}>Assinatura do cliente</Text>
        </View>

      </Page>
    </Document>
  )
}

export async function renderSimpleQuotePdf(input: {
  quote: QuoteApprovalData
  company: CompanyProfileData
  logoUrl?: string
  documentLabel?: QuoteDocumentLabel
}) {
  return renderToBuffer(<SimpleQuotePdf {...input} />)
}

export function simpleQuotePdfFileName(quote: QuoteApprovalData, documentLabel: QuoteDocumentLabel = 'Orçamento') {
  const title = `${quoteDisplayCode(quote)}-${quoteVariationDisplayName(quote)}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  const prefix = documentLabel === 'Pedido' ? 'pedido' : 'orcamento'
  return `${prefix}-${title || quote.id}.pdf`
}
