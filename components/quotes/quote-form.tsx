'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import {
  DEFAULT_QUOTE_MATERIAL,
  DEFAULT_QUOTE_PRICING,
  QUOTE_CALCULATION_MODE_LABELS,
  QUOTE_CALCULATION_MODES,
  QUOTE_DIFFICULTY_LABELS,
  QUOTE_ENVIRONMENT_OPTIONS,
  QUOTE_PRICE_PROFILE_LABELS,
  QUOTE_PRICE_PROFILES,
  QUOTE_PAYMENT_METHOD_LABELS,
  QUOTE_PAYMENT_METHODS,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUSES,
  calculateQuoteTotals,
  getQuoteAutomaticPricing,
  getQuoteFurnitureAccessories,
  getQuoteFurnitureDescription,
  getQuoteFurnitureGroup,
  getQuoteFurnitureGroups,
  getQuotePaymentSummary,
  quoteCentimetersToMillimeters,
  quoteMillimetersToCentimeters,
  resolveQuoteFurnitureSelection,
  safeQuoteCalculationMode,
  safeQuotePriceProfile,
  type QuoteCalculationMode,
  type QuoteDifficulty,
  type QuotePaymentMethod,
  type QuotePriceProfile,
  type QuoteStatus,
} from '@/lib/quotes'
import type { QuotePriceRule } from '@/lib/quote-price-rules'
import { formatCurrency } from '@/lib/utils'
import type { QuoteData, QuoteItemData } from '@/types/quotes'

type ClientOption = {
  id: string
  name: string
}

type QuoteFormProps = {
  clients: ClientOption[]
  initialData?: QuoteData | null
  onSubmit: (data: QuotePayload) => Promise<void>
  onCancel: () => void
}

export type QuotePayload = {
  clientId?: string
  title: string
  status: QuoteStatus
  pricePerM2: number
  materialCostPerM2: number
  installationFee: number
  marginPercent: number
  discount: number
  paymentMethod: QuotePaymentMethod
  cardInstallments: number
  cardDownPayment: number
  cardFeePercent: number
  deliveryBusinessDays: number
  firstInstallmentDate?: string
  validUntil?: string
  notes?: string
  customerNotes?: string
  items: QuoteItemPayload[]
}

type QuoteItemPayload = {
  environment: string
  description: string
  furnitureType?: string
  furnitureModel?: string
  width: number
  height: number
  depth?: number | null
  difficulty?: QuoteDifficulty
  calculationMode: QuoteCalculationMode
  priceProfile: QuotePriceProfile
  manualPrice?: number | null
  accessories: string[]
  quantity: number
  material?: string
  finish?: string
  notes?: string
}

type DraftItem = {
  environment: string
  furnitureType: string
  furnitureModel: string
  customFurniture: string
  widthMm: string
  heightMm: string
  quantity: string
  difficulty: QuoteDifficulty
  calculationMode: QuoteCalculationMode
  priceProfile: QuotePriceProfile
  manualPrice: string
  accessories: string[]
  finish: string
  notes: string
  material: string
}

type MaterialOption = {
  id: string
  name: string
  defaultFinish: string | null
  unitCost: number
  active: boolean
}

function moneyToString(value?: number | null) {
  return value ? String(value) : ''
}

function parseNumber(value: string) {
  const normalized = value.replace(',', '.')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : 0
}

function todayInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function itemDescription(item: DraftItem) {
  return getQuoteFurnitureDescription(item.furnitureType, item.furnitureModel, item.customFurniture)
}

function getAvailablePriceProfiles(environment: string) {
  if (environment === 'Cozinha') return QUOTE_PRICE_PROFILES
  if (['Dormitório', 'Suíte', 'Quarto infantil', 'Quarto de bebê'].includes(environment)) {
    return QUOTE_PRICE_PROFILES.filter((profile) => ['STANDARD', 'WOODGRAIN'].includes(profile))
  }
  return QUOTE_PRICE_PROFILES.filter((profile) => profile === 'STANDARD')
}

function getSuggestedCalculation(
  environment: string,
  furnitureType: string,
  furnitureModel: string,
  priceProfile: QuotePriceProfile = 'STANDARD',
  priceRules: QuotePriceRule[] = []
) {
  const furnitureGroup = getQuoteFurnitureGroup(environment, furnitureType)
  const automaticPricing = getQuoteAutomaticPricing({
    environment,
    furnitureType,
    furnitureModel,
    priceProfile,
  }, DEFAULT_QUOTE_PRICING.pricePerM2, priceRules)
  const calculationMode = automaticPricing.overridesSuggestedMode
    ? automaticPricing.mode
    : furnitureGroup.suggestedMode || 'AREA_M2'

  return {
    calculationMode,
    manualPrice: calculationMode !== 'AREA_M2' && automaticPricing.overridesSuggestedMode
      ? String(automaticPricing.rate)
      : '',
  }
}

function itemToDraft(item?: QuoteItemData): DraftItem {
  const environment = item?.environment || 'Cozinha'
  const resolved = item?.furnitureType && item?.furnitureModel
    ? {
        furnitureType: item.furnitureType,
        furnitureModel: item.furnitureModel,
        customFurniture: item.furnitureType === 'Personalizado' ? item.description : '',
      }
    : resolveQuoteFurnitureSelection(environment, item?.description || '')

  return {
    environment,
    ...resolved,
    widthMm: item?.width ? String(quoteCentimetersToMillimeters(item.width)) : '',
    heightMm: item?.height ? String(quoteCentimetersToMillimeters(item.height)) : '',
    quantity: item?.quantity ? String(item.quantity) : '1',
    difficulty: item?.difficulty === 'DIFICIL' ? 'DIFICIL' : 'NORMAL',
    calculationMode: safeQuoteCalculationMode(item?.calculationMode),
    priceProfile: safeQuotePriceProfile(item?.priceProfile),
    manualPrice: moneyToString(item?.manualPrice),
    accessories: item?.accessories || [],
    finish: item?.finish || '',
    notes: item?.notes || '',
    material: item?.material || DEFAULT_QUOTE_MATERIAL,
  }
}

function emptyItem(): DraftItem {
  const environment = 'Cozinha'
  const furnitureGroup = getQuoteFurnitureGroups(environment)[0]
  const suggestedCalculation = getSuggestedCalculation(environment, furnitureGroup.type, furnitureGroup.models[0])

  return {
    ...itemToDraft(),
    environment,
    furnitureType: furnitureGroup.type,
    furnitureModel: furnitureGroup.models[0],
    customFurniture: '',
    ...suggestedCalculation,
  }
}

function toCalculationItem(item: DraftItem) {
  return {
    environment: item.environment,
    description: itemDescription(item),
    furnitureType: item.furnitureType,
    furnitureModel: item.furnitureModel,
    width: quoteMillimetersToCentimeters(parseNumber(item.widthMm)),
    height: quoteMillimetersToCentimeters(parseNumber(item.heightMm)),
    depth: null,
    difficulty: item.difficulty,
    calculationMode: item.calculationMode,
    priceProfile: item.priceProfile,
    manualPrice: parseNumber(item.manualPrice),
    accessories: item.accessories,
    quantity: Math.max(1, Math.round(parseNumber(item.quantity) || 1)),
    material: item.material || DEFAULT_QUOTE_MATERIAL,
    finish: item.finish,
    notes: item.notes,
  }
}

export function QuoteForm({ clients, initialData, onSubmit, onCancel }: QuoteFormProps) {
  const [clientId, setClientId] = useState(initialData?.client?.id || '')
  const [title, setTitle] = useState(initialData?.title || '')
  const [status, setStatus] = useState<QuoteStatus>(initialData?.status || 'DRAFT')
  const [installationFee, setInstallationFee] = useState(moneyToString(initialData?.installationFee) || '0')
  const [discount, setDiscount] = useState(moneyToString(initialData?.manualDiscount ?? initialData?.discount) || '0')
  const [paymentMethod, setPaymentMethod] = useState<QuotePaymentMethod>(initialData?.paymentMethod || 'TO_DEFINE')
  const [cardInstallments, setCardInstallments] = useState(String(initialData?.cardInstallments || 1))
  const [cardDownPayment, setCardDownPayment] = useState(moneyToString(initialData?.cardDownPayment) || '0')
  const [cardFeePercent, setCardFeePercent] = useState(moneyToString(initialData?.cardFeePercent) || '0')
  const [deliveryBusinessDays, setDeliveryBusinessDays] = useState(String(initialData?.deliveryBusinessDays || 30))
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(initialData?.firstInstallmentDate?.slice(0, 10) || todayInputValue())
  const [validUntil, setValidUntil] = useState(initialData?.validUntil?.slice(0, 10) || '')
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [customerNotes, setCustomerNotes] = useState(
    initialData?.customerNotes || 'Orçamento válido conforme medidas informadas. Produção após aprovação e pagamento combinado.'
  )
  const [items, setItems] = useState<DraftItem[]>(
    initialData?.items?.length ? initialData.items.map(itemToDraft) : [emptyItem()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [priceRules, setPriceRules] = useState<QuotePriceRule[]>([])
  const [materials, setMaterials] = useState<MaterialOption[]>([])

  useEffect(() => {
    let active = true
    Promise.all([
      fetch('/api/settings/price-rules?active=1').then((response) => response.ok ? response.json() : []),
      fetch('/api/settings/materials?active=1').then((response) => response.ok ? response.json() : []),
      fetch('/api/settings/company').then((response) => response.ok ? response.json() : null),
    ]).then(([rules, materialOptions, companyProfile]) => {
      if (!active) return
      setPriceRules(Array.isArray(rules) ? rules : [])
      setMaterials(Array.isArray(materialOptions) ? materialOptions : [])
      if (!initialData && companyProfile?.defaultDeliveryBusinessDays) {
        setDeliveryBusinessDays(String(companyProfile.defaultDeliveryBusinessDays))
      }
    }).catch(() => {
      if (!active) return
      setPriceRules([])
      setMaterials([])
    })

    return () => { active = false }
  }, [initialData])

  const calculated = useMemo(() => calculateQuoteTotals(
    items.map(toCalculationItem),
    {
      pricePerM2: DEFAULT_QUOTE_PRICING.pricePerM2,
      materialCostPerM2: initialData?.materialCostPerM2 || DEFAULT_QUOTE_PRICING.materialCostPerM2,
      priceRules,
      materialCosts: materials,
      installationFee: parseNumber(installationFee),
      marginPercent: DEFAULT_QUOTE_PRICING.marginPercent,
      discount: parseNumber(discount),
      paymentMethod,
      cardInstallments: Math.min(Math.max(Math.round(parseNumber(cardInstallments) || 1), 1), 24),
      cardDownPayment: parseNumber(cardDownPayment),
      cardFeePercent: parseNumber(cardFeePercent),
    }
  ), [cardDownPayment, cardFeePercent, cardInstallments, discount, installationFee, initialData?.materialCostPerM2, items, materials, paymentMethod, priceRules])

  const updateItem = <K extends keyof DraftItem>(index: number, field: K, value: DraftItem[K]) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )))
  }

  const updateItemEnvironment = (index: number, environment: string) => {
    const furnitureGroup = getQuoteFurnitureGroups(environment)[0]
    const priceProfile: QuotePriceProfile = 'STANDARD'
    const suggestedCalculation = getSuggestedCalculation(environment, furnitureGroup.type, furnitureGroup.models[0], priceProfile, priceRules)
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index
        ? {
            ...item,
            environment,
            furnitureType: furnitureGroup.type,
            furnitureModel: furnitureGroup.models[0],
            customFurniture: '',
            priceProfile,
            ...suggestedCalculation,
            accessories: [],
          }
        : item
    )))
  }

  const updateFurnitureType = (index: number, furnitureType: string) => {
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const furnitureGroup = getQuoteFurnitureGroup(item.environment, furnitureType)
      const suggestedCalculation = getSuggestedCalculation(
        item.environment,
        furnitureType,
        furnitureGroup.models[0],
        item.priceProfile,
        priceRules
      )
      return {
        ...item,
        furnitureType,
        furnitureModel: furnitureGroup.models[0],
        customFurniture: '',
        ...suggestedCalculation,
        accessories: [],
      }
    }))
  }

  const updateFurnitureModel = (index: number, furnitureModel: string) => {
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      return {
        ...item,
        furnitureModel,
        ...getSuggestedCalculation(item.environment, item.furnitureType, furnitureModel, item.priceProfile, priceRules),
      }
    }))
  }

  const toggleAccessory = (index: number, accessory: string) => {
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const accessories = item.accessories.includes(accessory)
        ? item.accessories.filter((itemAccessory) => itemAccessory !== accessory)
        : [...item.accessories, accessory]
      return { ...item, accessories }
    }))
  }

  const removeItem = (index: number) => {
    setItems((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Informe o nome do orçamento.')
      return
    }
    if (!clientId) {
      setError('Selecione o cliente do orçamento.')
      return
    }
    const enteredCardDownPayment = paymentMethod === 'CARD' ? parseNumber(cardDownPayment) : 0
    if (enteredCardDownPayment > calculated.total) {
      setError(`A entrada não pode ser maior que o total de ${formatCurrency(calculated.total)}.`)
      return
    }

    const payload: QuotePayload = {
      clientId: clientId || undefined,
      title: title.trim(),
      status,
      pricePerM2: DEFAULT_QUOTE_PRICING.pricePerM2,
      materialCostPerM2: initialData?.materialCostPerM2 || DEFAULT_QUOTE_PRICING.materialCostPerM2,
      installationFee: parseNumber(installationFee),
      marginPercent: DEFAULT_QUOTE_PRICING.marginPercent,
      discount: parseNumber(discount),
      paymentMethod,
      cardInstallments: Math.min(Math.max(Math.round(parseNumber(cardInstallments) || 1), 1), 24),
      cardDownPayment: enteredCardDownPayment,
      cardFeePercent: paymentMethod === 'CARD' ? parseNumber(cardFeePercent) : 0,
      deliveryBusinessDays: Math.min(Math.max(Math.round(parseNumber(deliveryBusinessDays) || 30), 1), 365),
      firstInstallmentDate: paymentMethod === 'CARD' ? firstInstallmentDate || undefined : undefined,
      validUntil: validUntil || undefined,
      notes: notes.trim() || undefined,
      customerNotes: customerNotes.trim() || undefined,
      items: items.map((item) => {
        const calculatedItem = toCalculationItem(item)
        return {
          ...calculatedItem,
          description: calculatedItem.description.trim(),
          furnitureType: calculatedItem.furnitureType.trim(),
          furnitureModel: calculatedItem.furnitureModel.trim(),
          material: calculatedItem.material,
          finish: calculatedItem.finish.trim() || undefined,
          notes: calculatedItem.notes.trim() || undefined,
        }
      }),
    }

    if (payload.items.some((item) => !item.environment || !item.description || item.width <= 0 || item.height <= 0)) {
      setError('Preencha ambiente, móvel, largura e altura de todos os itens.')
      return
    }
    if (payload.items.some((item) => item.calculationMode !== 'AREA_M2' && (!item.manualPrice || item.manualPrice <= 0))) {
      setError('Informe o preço por metro ou por unidade nos móveis que não usam o cálculo automático por m².')
      return
    }

    setSaving(true)
    try {
      await onSubmit(payload)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar o orçamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input label="Nome do orçamento" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Cozinha planejada" />
        <Select
          label="Cliente"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          placeholder="Cliente em orçamento"
          options={clients.map((client) => ({ value: client.id, label: client.name }))}
        />
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as QuoteStatus)}
          options={QUOTE_STATUSES.map((value) => ({ value, label: QUOTE_STATUS_LABELS[value] }))}
        />
        <Input label="Validade" type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input
          label="Prazo de entrega (dias úteis)"
          type="number"
          min={1}
          max={365}
          value={deliveryBusinessDays}
          onChange={(event) => setDeliveryBusinessDays(event.target.value)}
          helperText="Contado após a aprovação e a confirmação do pagamento."
        />
        <Input
          label="Primeiro vencimento"
          type="date"
          value={firstInstallmentDate}
          disabled={paymentMethod !== 'CARD'}
          onChange={(event) => setFirstInstallmentDate(event.target.value)}
          helperText={paymentMethod === 'CARD' ? 'As demais parcelas serão mensais.' : 'Disponível para pagamento parcelado.'}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_180px]">
        <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3">
          <p className="text-sm font-semibold text-[#121212]">Tabela automática da Vertex</p>
          <p className="mt-1 text-xs text-[#777]">
            O preço muda conforme ambiente, móvel e padrão selecionados. Móvel difícil aumenta 30%.
          </p>
        </div>
        <Input label="Instalação" inputMode="decimal" value={installationFee} onChange={(event) => setInstallationFee(event.target.value)} />
        <Input label="Desconto comercial" inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-3 border-y border-[#E8E8E8] py-4 lg:grid-cols-[minmax(220px,1fr)_160px_160px_180px]">
        <Select
          label="Forma de pagamento"
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value as QuotePaymentMethod)}
          options={QUOTE_PAYMENT_METHODS.map((value) => ({ value, label: QUOTE_PAYMENT_METHOD_LABELS[value] }))}
        />
        {paymentMethod === 'CARD' ? (
          <>
            <Input
              label="Entrada (R$)"
              inputMode="decimal"
              value={cardDownPayment}
              onChange={(event) => setCardDownPayment(event.target.value)}
            />
            <Select
              label="Parcelas no cartão"
              value={cardInstallments}
              onChange={(event) => setCardInstallments(event.target.value)}
              options={Array.from({ length: 24 }, (_, index) => {
                const value = String(index + 1)
                return { value, label: `${value}x` }
              })}
            />
            <Input
              label="Taxa da operadora (%)"
              inputMode="decimal"
              value={cardFeePercent}
              onChange={(event) => setCardFeePercent(event.target.value)}
              helperText={`Custo estimado: ${formatCurrency(calculated.cardFeeAmount)}`}
            />
          </>
        ) : (
          <div className="flex min-h-10 items-center border-l-4 border-[#FF6B00] bg-[#FFF7ED] px-4 py-2 text-sm text-[#7A3B00] lg:col-span-2">
            {paymentMethod === 'PIX'
              ? `Desconto Pix: ${formatCurrency(calculated.paymentDiscount)} · Total: ${formatCurrency(calculated.total)}`
              : 'O pagamento será definido com o cliente.'}
          </div>
        )}
        {paymentMethod === 'CARD' && (
          <div className="border-l-4 border-blue-500 bg-blue-50 px-4 py-2 text-sm text-blue-800 lg:col-span-4">
            {getQuotePaymentSummary({
              total: calculated.total,
              paymentMethod,
              cardInstallments: calculated.cardInstallments,
              cardDownPayment: calculated.cardDownPayment,
            })}
          </div>
        )}
      </div>

      <section className="border-y border-[#E8E8E8] bg-[#FAFAFA] py-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <h3 className="text-sm font-semibold text-[#121212]">Móveis e ambientes</h3>
            <p className="text-xs text-[#777]">Escolha ambiente, tipo, modelo e adicionais de cada móvel.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => [...current, emptyItem()])}>
            <Plus size={14} />
            Adicionar
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => {
            const calculatedItem = calculated.items[index]
            const furnitureGroup = getQuoteFurnitureGroup(item.environment, item.furnitureType)
            const accessoryOptions = getQuoteFurnitureAccessories(item.environment, item.furnitureType)
            const automaticPricing = getQuoteAutomaticPricing(item, DEFAULT_QUOTE_PRICING.pricePerM2, priceRules)
            const areaPrice = automaticPricing.mode === 'AREA_M2'
              ? automaticPricing.rate
              : DEFAULT_QUOTE_PRICING.pricePerM2
            const calculationMeasure = item.calculationMode === 'AREA_M2'
              ? `${calculatedItem.areaM2.toFixed(2)} m²`
              : item.calculationMode === 'LINEAR_METER'
                ? `${((calculatedItem.width / 100) * calculatedItem.quantity).toFixed(2)} m linear`
                : `${calculatedItem.quantity} un.`

            return (
              <div key={index} className="border border-[#E8E8E8] bg-white p-4">
                <div className="mb-4 flex flex-col gap-2 border-b border-[#F0F0F0] pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#121212]">Móvel {index + 1}</p>
                    <p className="text-xs text-[#777]">{calculationMeasure} · {formatCurrency(calculatedItem.total)}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remover móvel"
                    title="Remover móvel"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Select
                      label="Ambiente"
                      value={item.environment}
                      onChange={(event) => updateItemEnvironment(index, event.target.value)}
                      options={QUOTE_ENVIRONMENT_OPTIONS.map((option) => ({ value: option, label: option }))}
                    />
                    <Select
                      label="Tipo"
                      value={item.furnitureType}
                      onChange={(event) => updateFurnitureType(index, event.target.value)}
                      options={getQuoteFurnitureGroups(item.environment).map((option) => ({ value: option.type, label: option.type }))}
                    />
                    {item.furnitureType === 'Personalizado' ? (
                      <Input
                        label="Nome do móvel"
                        value={item.customFurniture}
                        onChange={(event) => updateItem(index, 'customFurniture', event.target.value)}
                        placeholder="Informe o móvel"
                      />
                    ) : (
                      <Select
                        label="Modelo"
                        value={item.furnitureModel}
                        onChange={(event) => updateFurnitureModel(index, event.target.value)}
                        options={furnitureGroup.models.map((option) => ({ value: option, label: option }))}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Input label="Largura (mm)" inputMode="numeric" value={item.widthMm} onChange={(event) => updateItem(index, 'widthMm', event.target.value)} placeholder="Ex.: 700" />
                    <Input label="Altura (mm)" inputMode="numeric" value={item.heightMm} onChange={(event) => updateItem(index, 'heightMm', event.target.value)} placeholder="Ex.: 2600" />
                    <Input label="Quantidade" inputMode="numeric" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                    <Select
                      label="Dificuldade"
                      value={item.difficulty}
                      onChange={(event) => updateItem(index, 'difficulty', event.target.value as QuoteDifficulty)}
                      options={Object.entries(QUOTE_DIFFICULTY_LABELS).map(([value, label]) => ({ value, label }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <Select
                      label="Padrão de preço"
                      value={item.priceProfile}
                      onChange={(event) => updateItem(index, 'priceProfile', event.target.value as QuotePriceProfile)}
                      options={getAvailablePriceProfiles(item.environment).map((value) => ({
                        value,
                        label: QUOTE_PRICE_PROFILE_LABELS[value],
                      }))}
                    />
                    <Select
                      label="Forma de cálculo"
                      value={item.calculationMode}
                      onChange={(event) => {
                        const calculationMode = event.target.value as QuoteCalculationMode
                        updateItem(index, 'calculationMode', calculationMode)
                        if (calculationMode === 'AREA_M2') {
                          updateItem(index, 'manualPrice', '')
                        } else if (automaticPricing.overridesSuggestedMode && automaticPricing.mode === calculationMode) {
                          updateItem(index, 'manualPrice', String(automaticPricing.rate))
                        }
                      }}
                      options={QUOTE_CALCULATION_MODES.map((value) => ({ value, label: QUOTE_CALCULATION_MODE_LABELS[value] }))}
                    />
                    {item.calculationMode !== 'AREA_M2' ? (
                      <Input
                        label={item.calculationMode === 'LINEAR_METER' ? 'Preço por metro' : 'Preço por unidade'}
                        inputMode="decimal"
                        value={item.manualPrice}
                        onChange={(event) => updateItem(index, 'manualPrice', event.target.value)}
                        placeholder="R$ 0,00"
                      />
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-[#121212]">Preço por m²</span>
                        <div className="flex h-10 items-center rounded-lg border border-[#D9D9D9] bg-[#F5F5F5] px-3 text-sm font-semibold text-[#555]">
                          {formatCurrency(areaPrice)}
                        </div>
                      </div>
                    )}
                    <Select
                      label="Material"
                      value={item.material}
                      onChange={(event) => {
                        const material = materials.find((option) => option.name === event.target.value)
                        updateItem(index, 'material', event.target.value)
                        if (!item.finish && material?.defaultFinish) updateItem(index, 'finish', material.defaultFinish)
                      }}
                      options={(materials.length ? materials : [{ id: 'default-mdf', name: DEFAULT_QUOTE_MATERIAL, defaultFinish: null, unitCost: DEFAULT_QUOTE_PRICING.materialCostPerM2, active: true }]).map((option) => ({ value: option.name, label: option.name }))}
                    />
                    <Input label="Acabamento" value={item.finish} onChange={(event) => updateItem(index, 'finish', event.target.value)} placeholder="Branco TX" />
                  </div>

                  <fieldset className="border-t border-[#F0F0F0] pt-3">
                    <legend className="mb-2 text-sm font-medium text-[#121212]">Adicionais</legend>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                      {accessoryOptions.map((accessory) => (
                        <label key={accessory} className="flex items-center gap-2 text-sm text-[#555]">
                          <input
                            type="checkbox"
                            checked={item.accessories.includes(accessory)}
                            onChange={() => toggleAccessory(index, accessory)}
                            className="h-4 w-4 accent-[#FF6B00]"
                          />
                          <span>{accessory}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <Input label="Observação do móvel" value={item.notes} onChange={(event) => updateItem(index, 'notes', event.target.value)} />

                  <div className="rounded-lg bg-[#FFF7ED] px-3 py-2 text-xs text-[#9A4A00]">
                    {automaticPricing.label}: {item.calculationMode === 'AREA_M2'
                      ? `${formatCurrency(areaPrice)}/m²`
                      : `${formatCurrency(parseNumber(item.manualPrice))}${item.calculationMode === 'LINEAR_METER' ? '/m linear' : '/un.'}`}.
                    {item.difficulty === 'DIFICIL' ? ' com acréscimo de 30% por dificuldade.' : '.'}
                    {item.accessories.length > 0 ? ` ${item.accessories.length} adicional(is) selecionado(s).` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Textarea label="Observações internas" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <Textarea label="Mensagem para o cliente" value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#121212] p-4 text-white md:grid-cols-5">
        <div><p className="text-xs text-white/50">Subtotal</p><p className="text-base font-semibold">{formatCurrency(calculated.subtotal)}</p></div>
        <div><p className="text-xs text-white/50">Descontos</p><p className="text-base font-semibold">{formatCurrency(calculated.discount)}</p></div>
        <div><p className="text-xs text-white/50">Custo</p><p className="text-base font-semibold">{formatCurrency(calculated.costTotal)}</p></div>
        <div><p className="text-xs text-white/50">Lucro previsto</p><p className="text-base font-semibold text-emerald-300">{formatCurrency(calculated.profit)}</p></div>
        <div><p className="text-xs text-white/50">Total</p><p className="text-lg font-bold text-[#FFB06B]">{formatCurrency(calculated.total)}</p></div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={saving}>{initialData ? 'Salvar Orçamento' : 'Criar Orçamento'}</Button>
      </div>
    </form>
  )
}
