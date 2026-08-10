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
  QUOTE_PRICE_PROFILE_LABELS,
  quoteCentimetersToMillimeters,
  quoteDisplayCode,
  quoteVariationDisplayName,
  safeQuotePriceProfile,
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
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
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
    width: '70%',
  },
  totalValue: {
    width: '30%',
    textAlign: 'right',
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderLeftWidth: 1,
    borderColor: colors.line,
  },
  paymentCard: {
    width: '20%',
    minHeight: 28,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  paymentCardLabel: {
    color: colors.muted,
    fontSize: 7.5,
  },
  paymentCardAmount: {
    marginTop: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  paymentCardDate: {
    marginTop: 1,
    color: colors.muted,
    fontSize: 7,
  },
  notes: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 4,
    lineHeight: 1.25,
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
}: {
  quote: QuoteApprovalData
  company: CompanyProfileData
  logoUrl?: string
}) {
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
    quote.installationFee > 0 ? `Instalação: ${formatCurrency(quote.installationFee)}` : '',
    quote.manualDiscount > 0 ? `Desconto: - ${formatCurrency(quote.manualDiscount)}` : '',
    quote.paymentDiscount > 0 ? `Desconto Pix: - ${formatCurrency(quote.paymentDiscount)}` : '',
  ].filter(Boolean)
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
  return (
    <Document
      title={`Orçamento ${quoteDisplayCode(quote)} - ${quote.title}`}
      author={company.tradeName}
      subject="Orçamento de móveis planejados"
      creator="Sistema Vertex"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.continuationHeader} fixed>
          ORÇAMENTO {quoteDisplayCode(quote)} | {quote.client.name}
        </Text>
        <View style={styles.footerRule} fixed />
        <Text style={styles.footerLeft} fixed>
          {company.tradeName} | Orçamento {quoteDisplayCode(quote)}
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
          <Text style={styles.titleBarMain}>ORÇAMENTO Nº {quoteDisplayCode(quote)}</Text>
          <Text>{formatDateOnly(quote.createdAt)}</Text>
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
          <Text style={[styles.cell, styles.clientValue]}>{valueOrFallback(clientAddress)}</Text>
          <Text style={[styles.cell, styles.clientLabel]}>Telefone</Text>
          <Text style={[styles.cell, styles.clientValue]}>{valueOrFallback(quote.client.whatsapp || quote.client.phone)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Serviços e móveis</Text>
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
                item.material || 'MDF',
                QUOTE_PRICE_PROFILE_LABELS[safeQuotePriceProfile(item.priceProfile)],
                item.finish || 'Acabamento interno não informado',
                item.notes,
              ].filter(Boolean).join(' | ')

              return (
                <View key={item.id} style={styles.row} wrap={false}>
                  <Text style={[styles.cell, styles.itemNumber]}>{itemNumbers.get(item.id)}</Text>
                  <View style={[styles.cell, styles.itemDescription]}>
                    <Text>
                      <Text style={styles.serviceName}>{item.description}</Text>
                      <Text style={styles.serviceDetail}> | {details}</Text>
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
          <Text style={[styles.cell, styles.totalLabel]}>
            {totalQuantity} {totalQuantity === 1 ? 'ITEM' : 'ITENS'} | Móveis: {formatCurrency(itemSubtotal)}
            {financialDetails.length ? ` | ${financialDetails.join(' | ')}` : ''}
          </Text>
          <Text style={[styles.cell, styles.totalValue]}>TOTAL: {formatCurrency(quote.total)}</Text>
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>Dados do pagamento | {payment.methodLabel}</Text>
          <View style={styles.paymentGrid}>
            {paymentRows.map((row) => (
              <View key={`${row.label}-${row.dueDate || ''}`} style={styles.paymentCard}>
                <Text style={styles.paymentCardLabel}>{row.label}</Text>
                <Text style={styles.paymentCardAmount}>{formatCurrency(row.amount)}</Text>
                <Text style={styles.paymentCardDate}>{row.dueDate ? `Vencimento: ${formatDateOnly(row.dueDate)}` : 'Vencimento a combinar'}</Text>
              </View>
            ))}
          </View>
        </View>

        {quote.customerNotes ? (
          <Text style={styles.notes} wrap={false}>
            <Text style={styles.bold}>OBSERVAÇÕES: </Text>
            {quote.customerNotes}
          </Text>
        ) : null}

      </Page>
    </Document>
  )
}

export async function renderSimpleQuotePdf(input: {
  quote: QuoteApprovalData
  company: CompanyProfileData
  logoUrl?: string
}) {
  return renderToBuffer(<SimpleQuotePdf {...input} />)
}

export function simpleQuotePdfFileName(quote: QuoteApprovalData) {
  const title = `${quoteDisplayCode(quote)}-${quoteVariationDisplayName(quote)}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return `orcamento-${title || quote.id}.pdf`
}
