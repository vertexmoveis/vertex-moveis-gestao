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
    paddingTop: 24,
    paddingRight: 28,
    paddingBottom: 34,
    paddingLeft: 28,
    color: colors.ink,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    lineHeight: 1.35,
  },
  company: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flexGrow: 1,
  },
  logo: {
    width: 44,
    height: 32,
    objectFit: 'contain',
  },
  companyName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    textTransform: 'uppercase',
  },
  companyLegal: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 8,
  },
  companyLine: {
    marginTop: 4,
    color: '#333333',
    fontSize: 8,
  },
  companyContact: {
    width: 185,
    textAlign: 'right',
    fontSize: 8,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  titleBar: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  titleBarMain: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  delivery: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.softer,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  sectionTitle: {
    marginTop: 9,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    paddingVertical: 4,
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
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    textTransform: 'uppercase',
  },
  environmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    backgroundColor: colors.soft,
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontFamily: 'Helvetica-Bold',
  },
  serviceName: {
    fontFamily: 'Helvetica-Bold',
  },
  serviceDetail: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 7,
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
  paymentDescription: {
    width: '25%',
  },
  paymentDate: {
    width: '20%',
  },
  paymentAmount: {
    width: '20%',
    textAlign: 'right',
  },
  paymentMethod: {
    width: '35%',
  },
  notes: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.line,
    padding: 7,
    lineHeight: 1.45,
  },
  signatures: {
    marginTop: 15,
    flexDirection: 'row',
    gap: 28,
    borderWidth: 1,
    borderColor: colors.ink,
    paddingTop: 28,
    paddingRight: 18,
    paddingBottom: 8,
    paddingLeft: 18,
  },
  signature: {
    flexGrow: 1,
    borderTopWidth: 1,
    borderColor: colors.ink,
    paddingTop: 4,
    textAlign: 'center',
    fontSize: 7,
  },
  continuationHeader: {
    position: 'absolute',
    right: 28,
    top: 9,
    left: 28,
    color: colors.muted,
    fontSize: 6.5,
    textAlign: 'right',
  },
  footerLeft: {
    position: 'absolute',
    bottom: 13,
    left: 28,
    color: colors.muted,
    fontSize: 6.5,
  },
  footerRight: {
    position: 'absolute',
    right: 28,
    bottom: 13,
    width: 180,
    color: colors.muted,
    fontSize: 6.5,
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
              {company.document ? <Text style={styles.companyLine}>CNPJ: {company.document}</Text> : null}
              {companyAddress.map((line) => <Text key={line} style={styles.companyLine}>{line}</Text>)}
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
        <Text style={styles.delivery}>OPÇÃO: {quoteVariationDisplayName(quote)}</Text>
        <Text style={styles.delivery}>
          PREVISÃO ESTIMADA DE ENTREGA: {formatDateOnly(deliveryForecast)} ({quote.deliveryBusinessDays || 30} dias úteis após aprovação e confirmação do pagamento)
        </Text>

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
                item.priceProfile || 'Acabamento externo não informado',
                item.finish || 'Acabamento interno não informado',
                item.notes,
              ].filter(Boolean).join(' | ')

              return (
                <View key={item.id} style={styles.row} wrap={false}>
                  <Text style={[styles.cell, styles.itemNumber]}>{itemNumbers.get(item.id)}</Text>
                  <View style={[styles.cell, styles.itemDescription]}>
                    <Text style={styles.serviceName}>{item.description}</Text>
                    <Text style={styles.serviceDetail}>{details}</Text>
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
          <Text style={[styles.cell, styles.totalLabel]}>TOTAL DE {totalQuantity} {totalQuantity === 1 ? 'ITEM' : 'ITENS'}</Text>
          <Text style={[styles.cell, styles.totalValue]}>{formatCurrency(itemSubtotal)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Resumo financeiro</Text>
        {quote.installationFee > 0 ? (
          <View style={styles.totalRow} wrap={false}>
            <Text style={[styles.cell, styles.totalLabel]}>Instalação</Text>
            <Text style={[styles.cell, styles.totalValue]}>{formatCurrency(quote.installationFee)}</Text>
          </View>
        ) : null}
        {quote.manualDiscount > 0 ? (
          <View style={styles.totalRow} wrap={false}>
            <Text style={[styles.cell, styles.totalLabel]}>Desconto comercial</Text>
            <Text style={[styles.cell, styles.totalValue]}>- {formatCurrency(quote.manualDiscount)}</Text>
          </View>
        ) : null}
        {quote.paymentDiscount > 0 ? (
          <View style={styles.totalRow} wrap={false}>
            <Text style={[styles.cell, styles.totalLabel]}>Desconto Pix</Text>
            <Text style={[styles.cell, styles.totalValue]}>- {formatCurrency(quote.paymentDiscount)}</Text>
          </View>
        ) : null}
        <View style={styles.totalRow} wrap={false}>
          <Text style={[styles.cell, styles.totalLabel]}>TOTAL DA PROPOSTA</Text>
          <Text style={[styles.cell, styles.totalValue]}>{formatCurrency(quote.total)}</Text>
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>Dados do pagamento</Text>
          <View style={styles.itemHeader}>
            <Text style={[styles.headerCell, styles.paymentDescription]}>Descrição</Text>
            <Text style={[styles.headerCell, styles.paymentDate]}>Vencimento</Text>
            <Text style={[styles.headerCell, styles.paymentAmount]}>Valor</Text>
            <Text style={[styles.headerCell, styles.paymentMethod]}>Forma de pagamento</Text>
          </View>
          {paymentRows.map((row) => (
            <View key={`${row.label}-${row.dueDate || ''}`} style={styles.row}>
              <Text style={[styles.cell, styles.paymentDescription, styles.bold]}>{row.label}</Text>
              <Text style={[styles.cell, styles.paymentDate]}>{row.dueDate ? formatDateOnly(row.dueDate) : 'A combinar'}</Text>
              <Text style={[styles.cell, styles.paymentAmount]}>{formatCurrency(row.amount)}</Text>
              <Text style={[styles.cell, styles.paymentMethod]}>{row.method}</Text>
            </View>
          ))}
        </View>

        {quote.customerNotes ? (
          <>
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text style={styles.notes}>{quote.customerNotes}</Text>
          </>
        ) : null}

        <View style={styles.signatures} wrap={false}>
          <Text style={styles.signature}>Assinatura do cliente</Text>
          <Text style={styles.signature}>{company.tradeName} | Responsável pelo orçamento</Text>
        </View>

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
