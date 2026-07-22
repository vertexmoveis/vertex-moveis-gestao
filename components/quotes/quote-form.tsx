'use client'

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Layers3,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { ClientSearchSelect } from '@/components/clients/client-search-select'
import { FurniturePicker, type RecentFurnitureSelection } from '@/components/quotes/furniture-picker'
import {
  DEFAULT_QUOTE_MATERIAL,
  DEFAULT_QUOTE_PRICING,
  QUOTE_CALCULATION_MODE_LABELS,
  QUOTE_CALCULATION_MODES,
  QUOTE_DIFFICULTY_LABELS,
  QUOTE_DIFFICULTY_MULTIPLIER,
  QUOTE_ENVIRONMENT_OPTIONS,
  QUOTE_PRICE_PROFILE_LABELS,
  QUOTE_PRICE_PROFILES,
  QUOTE_PAYMENT_METHOD_LABELS,
  QUOTE_PAYMENT_METHODS,
  QUOTE_STATUS_LABELS,
  calculateQuoteTotals,
  getQuoteAutomaticPricing,
  getQuoteEnvironmentTemplates,
  getQuoteFurnitureAccessories,
  getQuoteFurnitureDescription,
  getQuoteFurnitureGroup,
  getQuoteFurnitureGroups,
  getQuotePaymentSummary,
  quoteCentimetersToMillimeters,
  quoteMillimetersToCentimeters,
  resolveQuoteFurnitureSelection,
  safeQuoteCalculationMode,
  safeQuoteDifficulty,
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

const MANUAL_QUOTE_STATUSES: QuoteStatus[] = ['DRAFT', 'SENT', 'WAITING_APPROVAL', 'LOST']

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
  environmentName?: string
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
  draftId: string
  environment: string
  environmentName: string
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

type SavedQuoteDraft = {
  version: 1
  savedAt: number
  data: {
    clientId: string
    title: string
    status: QuoteStatus
    installationFee: string
    discount: string
    paymentMethod: QuotePaymentMethod
    cardInstallments: string
    cardDownPayment: string
    cardFeePercent: string
    deliveryBusinessDays: string
    firstInstallmentDate: string
    validUntil: string
    notes: string
    customerNotes: string
    items: DraftItem[]
  }
}

function isSavedQuoteDraft(value: unknown): value is SavedQuoteDraft {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SavedQuoteDraft>
  return candidate.version === 1 && Boolean(candidate.data) && Array.isArray(candidate.data?.items)
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

function clientDraftId() {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function environmentGroupKey(item: Pick<DraftItem, 'environment' | 'environmentName'>) {
  return `${item.environment}::${item.environmentName.trim() || item.environment}`
}

function uniqueEnvironmentName(environment: string, items: DraftItem[]) {
  const used = new Set(items.map((item) => item.environmentName.trim().toLocaleLowerCase('pt-BR')).filter(Boolean))
  if (!used.has(environment.toLocaleLowerCase('pt-BR'))) return environment

  let index = 2
  while (used.has(`${environment} ${index}`.toLocaleLowerCase('pt-BR'))) index += 1
  return `${environment} ${index}`
}

function getDimensionWarnings(item: DraftItem) {
  const width = parseNumber(item.widthMm)
  const height = parseNumber(item.heightMm)
  const warnings: string[] = []
  if (width > 0 && (width < 100 || width > 10000)) warnings.push('Confira a largura informada.')
  if (height > 0 && (height < 100 || height > 5000)) warnings.push('Confira a altura informada.')
  return warnings
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

function itemToDraft(item?: QuoteItemData, draftId = 'initial-item-1'): DraftItem {
  const environment = item?.environment || 'Cozinha'
  const resolved = item?.furnitureType && item?.furnitureModel
    ? {
        furnitureType: item.furnitureType,
        furnitureModel: item.furnitureModel,
        customFurniture: item.furnitureType === 'Personalizado' ? item.description : '',
      }
    : resolveQuoteFurnitureSelection(environment, item?.description || '')

  return {
    draftId,
    environment,
    environmentName: item?.environmentName?.trim() || environment,
    ...resolved,
    widthMm: item?.width ? String(quoteCentimetersToMillimeters(item.width)) : '',
    heightMm: item?.height ? String(quoteCentimetersToMillimeters(item.height)) : '',
    quantity: item?.quantity ? String(item.quantity) : '1',
    difficulty: safeQuoteDifficulty(item?.difficulty),
    calculationMode: safeQuoteCalculationMode(item?.calculationMode),
    priceProfile: safeQuotePriceProfile(item?.priceProfile),
    manualPrice: moneyToString(item?.manualPrice),
    accessories: item?.accessories || [],
    finish: item?.finish || '',
    notes: item?.notes || '',
    material: item?.material || DEFAULT_QUOTE_MATERIAL,
  }
}

function emptyItem(
  environment = 'Cozinha',
  environmentName = environment,
  draftId = 'initial-item-1',
  priceRules: QuotePriceRule[] = [],
): DraftItem {
  const furnitureGroup = getQuoteFurnitureGroups(environment)[0]
  const suggestedCalculation = getSuggestedCalculation(environment, furnitureGroup.type, furnitureGroup.models[0], 'STANDARD', priceRules)

  return {
    ...itemToDraft(undefined, draftId),
    environment,
    environmentName,
    furnitureType: furnitureGroup.type,
    furnitureModel: furnitureGroup.models[0],
    customFurniture: '',
    ...suggestedCalculation,
  }
}

function toCalculationItem(item: DraftItem) {
  return {
    environment: item.environment,
    environmentName: item.environmentName.trim() || item.environment,
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
    initialData?.items?.length
      ? initialData.items.map((item, index) => itemToDraft(item, item.id || `initial-item-${index + 1}`))
      : [emptyItem()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [priceRules, setPriceRules] = useState<QuotePriceRule[]>([])
  const [materials, setMaterials] = useState<MaterialOption[]>([])
  const [newEnvironmentType, setNewEnvironmentType] = useState(QUOTE_ENVIRONMENT_OPTIONS[0])
  const [collapsedEnvironments, setCollapsedEnvironments] = useState<Set<string>>(() => new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set())
  const [recentSelections, setRecentSelections] = useState<RecentFurnitureSelection[]>([])
  const [recoverableDraft, setRecoverableDraft] = useState<SavedQuoteDraft | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)
  const draftStorageKey = `vertex:quote-draft:${initialData?.id || 'new'}`
  const clientOptions = [...clients]
  if (initialData?.client && !clientOptions.some((client) => client.id === initialData.client?.id)) {
    clientOptions.unshift({ id: initialData.client.id, name: initialData.client.name })
  }

  const currentDraftData = useMemo<SavedQuoteDraft['data']>(() => ({
    clientId,
    title,
    status,
    installationFee,
    discount,
    paymentMethod,
    cardInstallments,
    cardDownPayment,
    cardFeePercent,
    deliveryBusinessDays,
    firstInstallmentDate,
    validUntil,
    notes,
    customerNotes,
    items,
  }), [
    cardDownPayment,
    cardFeePercent,
    cardInstallments,
    clientId,
    customerNotes,
    deliveryBusinessDays,
    discount,
    firstInstallmentDate,
    installationFee,
    items,
    notes,
    paymentMethod,
    status,
    title,
    validUntil,
  ])
  const initialDraftSignature = useRef<string | null>(null)
  if (initialDraftSignature.current === null) initialDraftSignature.current = JSON.stringify(currentDraftData)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(draftStorageKey) || 'null') as unknown
        if (isSavedQuoteDraft(saved)) {
          const serverUpdatedAt = initialData?.updatedAt ? new Date(initialData.updatedAt).getTime() : 0
          if (saved.savedAt > serverUpdatedAt) setRecoverableDraft(saved)
        }

        const recent = JSON.parse(localStorage.getItem('vertex:recent-furniture') || '[]') as unknown
        if (Array.isArray(recent)) {
          setRecentSelections(recent.filter((item): item is RecentFurnitureSelection => (
            Boolean(item) && typeof item === 'object' &&
            typeof (item as RecentFurnitureSelection).environment === 'string' &&
            typeof (item as RecentFurnitureSelection).type === 'string' &&
            typeof (item as RecentFurnitureSelection).model === 'string'
          )).slice(0, 12))
        }
      } catch {
        localStorage.removeItem(draftStorageKey)
      } finally {
        setDraftReady(true)
      }
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [draftStorageKey, initialData?.updatedAt])

  useEffect(() => {
    if (!draftReady || recoverableDraft || saving) return
    if (JSON.stringify(currentDraftData) === initialDraftSignature.current) return
    const timeout = window.setTimeout(() => {
      const savedAt = Date.now()
      localStorage.setItem(draftStorageKey, JSON.stringify({ version: 1, savedAt, data: currentDraftData } satisfies SavedQuoteDraft))
      setDraftSavedAt(savedAt)
    }, 900)
    return () => window.clearTimeout(timeout)
  }, [currentDraftData, draftReady, draftStorageKey, recoverableDraft, saving])

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

  const environmentGroups = useMemo(() => {
    const groups = new Map<string, {
      key: string
      environment: string
      name: string
      indexes: number[]
      subtotal: number
    }>()

    items.forEach((item, index) => {
      const key = environmentGroupKey(item)
      const existing = groups.get(key)
      if (existing) {
        existing.indexes.push(index)
        existing.subtotal += calculated.items[index]?.total || 0
      } else {
        groups.set(key, {
          key,
          environment: item.environment,
          name: item.environmentName.trim() || item.environment,
          indexes: [index],
          subtotal: calculated.items[index]?.total || 0,
        })
      }
    })

    return [...groups.values()]
  }, [calculated.items, items])

  const duplicateItemIds = useMemo(() => {
    const bySignature = new Map<string, string[]>()
    for (const item of items) {
      if (!item.widthMm || !item.heightMm) continue
      const signature = [
        environmentGroupKey(item),
        item.furnitureType,
        item.furnitureModel,
        parseNumber(item.widthMm),
        parseNumber(item.heightMm),
      ].join('::')
      bySignature.set(signature, [...(bySignature.get(signature) || []), item.draftId])
    }
    return new Set([...bySignature.values()].filter((ids) => ids.length > 1).flat())
  }, [items])

  const missingItemCount = items.filter((item) => (
    !itemDescription(item).trim() || parseNumber(item.widthMm) <= 0 || parseNumber(item.heightMm) <= 0
  )).length

  const restoreDraft = () => {
    if (!recoverableDraft) return
    const draft = recoverableDraft.data
    setClientId(draft.clientId)
    setTitle(draft.title)
    setStatus(draft.status)
    setInstallationFee(draft.installationFee)
    setDiscount(draft.discount)
    setPaymentMethod(draft.paymentMethod)
    setCardInstallments(draft.cardInstallments)
    setCardDownPayment(draft.cardDownPayment)
    setCardFeePercent(draft.cardFeePercent)
    setDeliveryBusinessDays(draft.deliveryBusinessDays)
    setFirstInstallmentDate(draft.firstInstallmentDate)
    setValidUntil(draft.validUntil)
    setNotes(draft.notes)
    setCustomerNotes(draft.customerNotes)
    setItems(draft.items.map((item) => ({
      ...item,
      draftId: item.draftId || clientDraftId(),
      environmentName: item.environmentName?.trim() || item.environment,
    })))
    setRecoverableDraft(null)
    setDraftSavedAt(recoverableDraft.savedAt)
  }

  const discardDraft = () => {
    localStorage.removeItem(draftStorageKey)
    setRecoverableDraft(null)
    setDraftSavedAt(null)
  }

  const updateItem = <K extends keyof DraftItem>(index: number, field: K, value: DraftItem[K]) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )))
  }

  const rememberFurnitureSelection = (selection: RecentFurnitureSelection) => {
    setRecentSelections((current) => {
      const next = [selection, ...current.filter((item) => (
        item.environment !== selection.environment || item.type !== selection.type || item.model !== selection.model
      ))].slice(0, 12)
      localStorage.setItem('vertex:recent-furniture', JSON.stringify(next))
      return next
    })
  }

  const updateFurnitureSelection = (index: number, selection: { type: string; model: string }) => {
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const suggestedCalculation = getSuggestedCalculation(
        item.environment,
        selection.type,
        selection.model,
        item.priceProfile,
        priceRules
      )
      return {
        ...item,
        furnitureType: selection.type,
        furnitureModel: selection.model,
        customFurniture: '',
        ...suggestedCalculation,
        accessories: [],
      }
    }))
    rememberFurnitureSelection({
      environment: items[index].environment,
      type: selection.type,
      model: selection.model,
    })
  }

  const updateItemPriceProfile = (index: number, priceProfile: QuotePriceProfile) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index
        ? {
            ...item,
            priceProfile,
            ...getSuggestedCalculation(item.environment, item.furnitureType, item.furnitureModel, priceProfile, priceRules),
          }
        : item
    )))
  }

  const updateEnvironmentName = (groupKey: string, environmentName: string) => {
    setItems((current) => current.map((item) => {
      if (environmentGroupKey(item) !== groupKey) return item
      return { ...item, environmentName }
    }))
  }

  const applyEnvironmentMaterial = (groupKey: string, material: string) => {
    if (!material) return
    const defaultFinish = materials.find((option) => option.name === material)?.defaultFinish
    setItems((current) => current.map((item) => (
      environmentGroupKey(item) === groupKey
        ? { ...item, material, finish: defaultFinish || item.finish }
        : item
    )))
  }

  const applyEnvironmentFinish = (groupKey: string, finish: string) => {
    setItems((current) => current.map((item) => (
      environmentGroupKey(item) === groupKey ? { ...item, finish } : item
    )))
  }

  const applyEnvironmentPriceProfile = (groupKey: string, priceProfile: QuotePriceProfile) => {
    setItems((current) => current.map((item) => (
      environmentGroupKey(item) === groupKey
        ? {
            ...item,
            priceProfile,
            ...getSuggestedCalculation(item.environment, item.furnitureType, item.furnitureModel, priceProfile, priceRules),
          }
        : item
    )))
  }

  const addEnvironment = () => {
    setItems((current) => {
      const environmentName = uniqueEnvironmentName(newEnvironmentType, current)
      return [...current, emptyItem(newEnvironmentType, environmentName, clientDraftId(), priceRules)]
    })
  }

  const addItemToEnvironment = (groupKey: string) => {
    setItems((current) => {
      const groupIndexes = current.flatMap((item, index) => environmentGroupKey(item) === groupKey ? [index] : [])
      const source = current[groupIndexes[0]]
      if (!source) return current
      const nextItem = {
        ...emptyItem(source.environment, source.environmentName, clientDraftId(), priceRules),
        material: source.material,
        finish: source.finish,
        priceProfile: source.priceProfile,
      }
      const next = [...current]
      next.splice(groupIndexes[groupIndexes.length - 1] + 1, 0, nextItem)
      return next
    })
  }

  const duplicateItem = (index: number) => {
    setItems((current) => {
      const source = current[index]
      if (!source || current.length >= 80) return current
      const next = [...current]
      next.splice(index + 1, 0, { ...source, draftId: clientDraftId() })
      return next
    })
  }

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((current) => {
      const source = current[index]
      if (!source) return current
      const groupIndexes = current.flatMap((item, itemIndex) => (
        environmentGroupKey(item) === environmentGroupKey(source) ? [itemIndex] : []
      ))
      const position = groupIndexes.indexOf(index)
      const targetIndex = groupIndexes[position + direction]
      if (targetIndex === undefined) return current
      const next = [...current]
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  const duplicateEnvironment = (groupKey: string) => {
    setItems((current) => {
      const groupItems = current.filter((item) => environmentGroupKey(item) === groupKey)
      if (!groupItems.length || current.length + groupItems.length > 80) return current
      const environmentName = uniqueEnvironmentName(groupItems[0].environment, current)
      return [
        ...current,
        ...groupItems.map((item) => ({ ...item, draftId: clientDraftId(), environmentName })),
      ]
    })
  }

  const removeEnvironment = (groupKey: string) => {
    setItems((current) => {
      const next = current.filter((item) => environmentGroupKey(item) !== groupKey)
      return next.length ? next : [emptyItem()]
    })
  }

  const applyEnvironmentTemplate = (groupKey: string, templateId: string) => {
    if (!templateId) return
    setItems((current) => {
      const groupIndexes = current.flatMap((item, index) => environmentGroupKey(item) === groupKey ? [index] : [])
      const source = current[groupIndexes[0]]
      if (!source) return current
      const template = getQuoteEnvironmentTemplates(source.environment).find((option) => option.id === templateId)
      if (!template) return current

      const existing = new Set(groupIndexes.map((index) => `${current[index].furnitureType}::${current[index].furnitureModel}`))
      const templateItems = template.items
        .filter((item) => !existing.has(`${item.type}::${item.model}`))
        .map((templateItem) => ({
          ...emptyItem(source.environment, source.environmentName, clientDraftId(), priceRules),
          furnitureType: templateItem.type,
          furnitureModel: templateItem.model,
          material: source.material,
          finish: source.finish,
          priceProfile: source.priceProfile,
          ...getSuggestedCalculation(source.environment, templateItem.type, templateItem.model, source.priceProfile, priceRules),
        }))
      if (!templateItems.length) return current

      const replaceEmptyItem = groupIndexes.length === 1 && !source.widthMm && !source.heightMm
      if (replaceEmptyItem) {
        const next = [...current]
        next.splice(groupIndexes[0], 1, ...templateItems)
        return next
      }

      const next = [...current]
      next.splice(groupIndexes[groupIndexes.length - 1] + 1, 0, ...templateItems)
      return next.slice(0, 80)
    })
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

  const toggleEnvironmentCollapsed = (groupKey: string) => {
    setCollapsedEnvironments((current) => {
      const next = new Set(current)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  const toggleItemExpanded = (draftId: string) => {
    setExpandedItems((current) => {
      const next = new Set(current)
      if (next.has(draftId)) next.delete(draftId)
      else next.add(draftId)
      return next
    })
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
    const environmentNames = environmentGroups.map((group) => group.name.trim())
    if (environmentNames.some((name) => !name)) {
      setError('Informe o nome de todos os ambientes.')
      return
    }
    const normalizedEnvironmentNames = environmentNames.map((name) => name.toLocaleLowerCase('pt-BR'))
    if (new Set(normalizedEnvironmentNames).size !== normalizedEnvironmentNames.length) {
      setError('Use um nome diferente para cada ambiente, como "Dormitório casal" e "Dormitório filho".')
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
      localStorage.removeItem(draftStorageKey)
      setDraftSavedAt(null)
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

      {recoverableDraft ? (
        <div className="flex flex-col gap-3 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Existe um rascunho mais recente neste computador.</p>
            <p className="mt-0.5 text-xs text-amber-800">
              Salvo em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(recoverableDraft.savedAt)}.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={discardDraft}>Descartar</Button>
            <Button type="button" size="sm" onClick={restoreDraft}><RotateCcw size={14} /> Recuperar</Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input label="Nome do orçamento" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Cozinha planejada" />
        <ClientSearchSelect label="Cliente" value={clientId} onChange={setClientId} initialOptions={clientOptions} />
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as QuoteStatus)}
          options={(initialData?.status === 'APPROVED' ? [...MANUAL_QUOTE_STATUSES, 'APPROVED' as const] : MANUAL_QUOTE_STATUSES)
            .map((value) => ({ value, label: QUOTE_STATUS_LABELS[value] }))}
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
            O preço muda conforme ambiente, móvel e padrão selecionados. Móvel difícil aumenta 30%; muito difícil, 60%.
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

      <section className="border-y border-[#E8E8E8] bg-[#F7F7F7] py-4">
        <div className="mb-4 flex flex-col gap-3 px-1 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#121212]">Ambientes do orçamento</h3>
            <p className="mt-0.5 text-xs text-[#777]">
              {environmentGroups.length} {environmentGroups.length === 1 ? 'ambiente' : 'ambientes'} · {items.length} {items.length === 1 ? 'móvel' : 'móveis'}
              {missingItemCount > 0 ? ` · ${missingItemCount} sem medidas completas` : ''}
            </p>
          </div>
          <div className="grid grid-cols-[minmax(180px,1fr)_auto] gap-2 lg:w-[420px]">
            <Select
              value={newEnvironmentType}
              onChange={(event) => setNewEnvironmentType(event.target.value)}
              options={QUOTE_ENVIRONMENT_OPTIONS.map((option) => ({ value: option, label: option }))}
              aria-label="Novo ambiente"
            />
            <Button type="button" variant="outline" size="sm" onClick={addEnvironment} disabled={items.length >= 80}>
              <Plus size={14} />
              Ambiente
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {environmentGroups.map((environmentGroup) => {
            const groupItems = environmentGroup.indexes.map((index) => items[index])
            const materialsInGroup = [...new Set(groupItems.map((item) => item.material))]
            const finishesInGroup = [...new Set(groupItems.map((item) => item.finish))]
            const profilesInGroup = [...new Set(groupItems.map((item) => item.priceProfile))]
            const templates = getQuoteEnvironmentTemplates(environmentGroup.environment)
            const collapsed = collapsedEnvironments.has(environmentGroup.key)

            return (
              <article key={environmentGroup.key} className="overflow-visible border border-[#DCDCDC] bg-white">
                <header className="flex flex-col gap-3 bg-[#F2F2F2] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#121212] text-white">
                      <Layers3 size={17} />
                    </div>
                    <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(190px,320px)_auto] sm:items-end sm:gap-3">
                      <label className="min-w-0">
                        <span className="block text-[10px] font-bold uppercase text-[#777]">Nome do ambiente</span>
                        <input
                          value={environmentGroup.name}
                          maxLength={120}
                          onChange={(event) => updateEnvironmentName(environmentGroup.key, event.target.value)}
                          className="mt-0.5 h-8 w-full border-b border-[#BDBDBD] bg-transparent text-sm font-semibold text-[#121212] outline-none focus:border-[#FF6B00]"
                        />
                      </label>
                      <span className="pb-1 text-xs text-[#777]">Tipo: {environmentGroup.environment}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 self-end lg:self-auto">
                    <button type="button" title="Duplicar ambiente" aria-label="Duplicar ambiente" onClick={() => duplicateEnvironment(environmentGroup.key)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#555] hover:bg-white" disabled={items.length + groupItems.length > 80}>
                      <Copy size={15} />
                    </button>
                    <button type="button" title="Excluir ambiente" aria-label="Excluir ambiente" onClick={() => removeEnvironment(environmentGroup.key)} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                    <button type="button" title={collapsed ? 'Mostrar ambiente' : 'Recolher ambiente'} aria-label={collapsed ? 'Mostrar ambiente' : 'Recolher ambiente'} onClick={() => toggleEnvironmentCollapsed(environmentGroup.key)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#555] hover:bg-white">
                      {collapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                    </button>
                  </div>
                </header>

                {!collapsed ? (
                  <>
                    <div className="grid gap-3 border-b border-[#E8E8E8] px-4 py-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.15fr_auto] xl:items-end">
                      <Select
                        label="Material do ambiente"
                        value={materialsInGroup.length === 1 ? materialsInGroup[0] : ''}
                        placeholder={materialsInGroup.length > 1 ? 'Vários materiais' : 'Selecione'}
                        onChange={(event) => applyEnvironmentMaterial(environmentGroup.key, event.target.value)}
                        options={(materials.length ? materials : [{ id: 'default-mdf', name: DEFAULT_QUOTE_MATERIAL, defaultFinish: null, unitCost: DEFAULT_QUOTE_PRICING.materialCostPerM2, active: true }]).map((option) => ({ value: option.name, label: option.name }))}
                      />
                      <Input
                        label="Acabamento do ambiente"
                        value={finishesInGroup.length === 1 ? finishesInGroup[0] : ''}
                        onChange={(event) => applyEnvironmentFinish(environmentGroup.key, event.target.value)}
                        placeholder={finishesInGroup.length > 1 ? 'Vários acabamentos' : 'Ex.: Branco TX'}
                      />
                      <Select
                        label="Padrão do ambiente"
                        value={profilesInGroup.length === 1 ? profilesInGroup[0] : ''}
                        placeholder={profilesInGroup.length > 1 ? 'Vários padrões' : 'Selecione'}
                        onChange={(event) => applyEnvironmentPriceProfile(environmentGroup.key, event.target.value as QuotePriceProfile)}
                        options={getAvailablePriceProfiles(environmentGroup.environment).map((value) => ({ value, label: QUOTE_PRICE_PROFILE_LABELS[value] }))}
                      />
                      {templates.length ? (
                        <Select
                          label="Conjunto rápido"
                          value=""
                          placeholder="Adicionar conjunto..."
                          onChange={(event) => applyEnvironmentTemplate(environmentGroup.key, event.target.value)}
                          options={templates.map((template) => ({ value: template.id, label: template.name }))}
                        />
                      ) : <div />}
                      <Button type="button" variant="outline" size="sm" onClick={() => addItemToEnvironment(environmentGroup.key)} disabled={items.length >= 80}>
                        <Plus size={14} /> Móvel
                      </Button>
                    </div>

                    <div className="divide-y divide-[#E8E8E8]">
                      {environmentGroup.indexes.map((index, groupPosition) => {
                        const item = items[index]
                        const calculatedItem = calculated.items[index]
                        const accessoryOptions = getQuoteFurnitureAccessories(item.environment, item.furnitureType)
                        const automaticPricing = getQuoteAutomaticPricing(item, DEFAULT_QUOTE_PRICING.pricePerM2, priceRules)
                        const areaPrice = automaticPricing.mode === 'AREA_M2' ? automaticPricing.rate : DEFAULT_QUOTE_PRICING.pricePerM2
                        const calculationMeasure = item.calculationMode === 'AREA_M2'
                          ? `${calculatedItem.areaM2.toFixed(2)} m²`
                          : item.calculationMode === 'LINEAR_METER'
                            ? `${((calculatedItem.width / 100) * calculatedItem.quantity).toFixed(2)} m linear`
                            : `${calculatedItem.quantity} un.`
                        const dimensionWarnings = getDimensionWarnings(item)
                        const expanded = expandedItems.has(item.draftId)

                        return (
                          <section key={item.draftId} className="px-4 py-4">
                            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-[#121212]">Móvel {groupPosition + 1}</p>
                                <p className="text-xs text-[#777]">{calculationMeasure} · {formatCurrency(calculatedItem.total)}</p>
                              </div>
                              <div className="flex items-center gap-1 self-end sm:self-auto">
                                <button type="button" title="Mover para cima" aria-label="Mover móvel para cima" disabled={groupPosition === 0} onClick={() => moveItem(index, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#666] hover:bg-[#F5F5F5] disabled:opacity-25"><ChevronUp size={15} /></button>
                                <button type="button" title="Mover para baixo" aria-label="Mover móvel para baixo" disabled={groupPosition === environmentGroup.indexes.length - 1} onClick={() => moveItem(index, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#666] hover:bg-[#F5F5F5] disabled:opacity-25"><ChevronDown size={15} /></button>
                                <button type="button" title="Duplicar móvel" aria-label="Duplicar móvel" onClick={() => duplicateItem(index)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#555] hover:bg-[#F5F5F5]"><Copy size={15} /></button>
                                <button type="button" title="Opções avançadas" aria-label="Opções avançadas" onClick={() => toggleItemExpanded(item.draftId)} className={`flex h-8 w-8 items-center justify-center rounded-lg ${expanded ? 'bg-[#FFF0E5] text-[#D65300]' : 'text-[#555] hover:bg-[#F5F5F5]'}`}><SlidersHorizontal size={15} /></button>
                                <button type="button" title="Remover móvel" aria-label="Remover móvel" onClick={() => removeItem(index)} disabled={items.length === 1} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-25"><Trash2 size={15} /></button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,2fr)_minmax(110px,.7fr)_minmax(110px,.7fr)_90px_minmax(145px,1fr)]">
                              {item.furnitureType === 'Personalizado' ? (
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                                  <FurniturePicker environment={item.environment} furnitureType={item.furnitureType} furnitureModel={item.furnitureModel} recentSelections={recentSelections} onSelect={(selection) => updateFurnitureSelection(index, selection)} />
                                  <Input label="Nome do móvel" value={item.customFurniture} onChange={(event) => updateItem(index, 'customFurniture', event.target.value)} placeholder="Informe o móvel" />
                                </div>
                              ) : (
                                <FurniturePicker environment={item.environment} furnitureType={item.furnitureType} furnitureModel={item.furnitureModel} recentSelections={recentSelections} onSelect={(selection) => updateFurnitureSelection(index, selection)} />
                              )}
                              <Input label="Largura (mm)" inputMode="numeric" value={item.widthMm} onChange={(event) => updateItem(index, 'widthMm', event.target.value)} placeholder="Ex.: 700" />
                              <Input label="Altura (mm)" inputMode="numeric" value={item.heightMm} onChange={(event) => updateItem(index, 'heightMm', event.target.value)} placeholder="Ex.: 2600" />
                              <Input label="Qtd." inputMode="numeric" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                              <Select label="Dificuldade" value={item.difficulty} onChange={(event) => updateItem(index, 'difficulty', event.target.value as QuoteDifficulty)} options={Object.entries(QUOTE_DIFFICULTY_LABELS).map(([value, label]) => ({ value, label }))} />
                            </div>

                            {dimensionWarnings.length || duplicateItemIds.has(item.draftId) ? (
                              <div className="mt-3 flex items-start gap-2 border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                                <span>{[...dimensionWarnings, ...(duplicateItemIds.has(item.draftId) ? ['Existe outro móvel igual com as mesmas medidas neste ambiente.'] : [])].join(' ')}</span>
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-col gap-1 border-l-4 border-[#FF6B00] bg-[#FFF7ED] px-3 py-2 text-xs text-[#8A4200] sm:flex-row sm:items-center sm:justify-between">
                              <span>
                                {automaticPricing.label}: {item.calculationMode === 'AREA_M2'
                                  ? `${formatCurrency(areaPrice)}/m²`
                                  : `${formatCurrency(parseNumber(item.manualPrice))}${item.calculationMode === 'LINEAR_METER' ? '/m linear' : '/un.'}`}
                                {QUOTE_DIFFICULTY_MULTIPLIER[item.difficulty] > 1
                                  ? ` · acréscimo de ${Math.round((QUOTE_DIFFICULTY_MULTIPLIER[item.difficulty] - 1) * 100)}%`
                                  : ''}
                              </span>
                              <strong className="text-sm text-[#121212]">{formatCurrency(calculatedItem.total)}</strong>
                            </div>

                            {expanded ? (
                              <div className="mt-4 space-y-4 border-t border-[#ECECEC] pt-4">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                  <Select label="Padrão de preço" value={item.priceProfile} onChange={(event) => updateItemPriceProfile(index, event.target.value as QuotePriceProfile)} options={getAvailablePriceProfiles(item.environment).map((value) => ({ value, label: QUOTE_PRICE_PROFILE_LABELS[value] }))} />
                                  <Select
                                    label="Forma de cálculo"
                                    value={item.calculationMode}
                                    onChange={(event) => {
                                      const calculationMode = event.target.value as QuoteCalculationMode
                                      updateItem(index, 'calculationMode', calculationMode)
                                      if (calculationMode === 'AREA_M2') updateItem(index, 'manualPrice', '')
                                      else if (automaticPricing.overridesSuggestedMode && automaticPricing.mode === calculationMode) updateItem(index, 'manualPrice', String(automaticPricing.rate))
                                    }}
                                    options={QUOTE_CALCULATION_MODES.map((value) => ({ value, label: QUOTE_CALCULATION_MODE_LABELS[value] }))}
                                  />
                                  {item.calculationMode !== 'AREA_M2' ? (
                                    <Input label={item.calculationMode === 'LINEAR_METER' ? 'Preço por metro' : 'Preço por unidade'} inputMode="decimal" value={item.manualPrice} onChange={(event) => updateItem(index, 'manualPrice', event.target.value)} placeholder="R$ 0,00" />
                                  ) : (
                                    <div className="flex flex-col gap-1.5"><span className="text-sm font-medium text-[#121212]">Preço por m²</span><div className="flex h-10 items-center rounded-lg border border-[#D9D9D9] bg-[#F5F5F5] px-3 text-sm font-semibold text-[#555]">{formatCurrency(areaPrice)}</div></div>
                                  )}
                                  <Select
                                    label="Material deste móvel"
                                    value={item.material}
                                    onChange={(event) => {
                                      const material = materials.find((option) => option.name === event.target.value)
                                      updateItem(index, 'material', event.target.value)
                                      if (!item.finish && material?.defaultFinish) updateItem(index, 'finish', material.defaultFinish)
                                    }}
                                    options={(materials.length ? materials : [{ id: 'default-mdf', name: DEFAULT_QUOTE_MATERIAL, defaultFinish: null, unitCost: DEFAULT_QUOTE_PRICING.materialCostPerM2, active: true }]).map((option) => ({ value: option.name, label: option.name }))}
                                  />
                                  <Input label="Acabamento deste móvel" value={item.finish} onChange={(event) => updateItem(index, 'finish', event.target.value)} placeholder="Branco TX" />
                                </div>

                                <fieldset className="border-t border-[#F0F0F0] pt-3">
                                  <legend className="mb-2 text-sm font-medium text-[#121212]">Adicionais</legend>
                                  <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {accessoryOptions.map((accessory) => (
                                      <label key={accessory} className="flex items-center gap-2 text-sm text-[#555]">
                                        <input type="checkbox" checked={item.accessories.includes(accessory)} onChange={() => toggleAccessory(index, accessory)} className="h-4 w-4 accent-[#FF6B00]" />
                                        <span>{accessory}</span>
                                      </label>
                                    ))}
                                  </div>
                                </fieldset>
                                <Input label="Observação do móvel" value={item.notes} onChange={(event) => updateItem(index, 'notes', event.target.value)} />
                              </div>
                            ) : null}
                          </section>
                        )
                      })}
                    </div>

                    <footer className="flex items-center justify-between gap-4 border-t border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 text-sm">
                      <span className="text-[#666]">Subtotal de {environmentGroup.name}</span>
                      <strong className="text-[#121212]">{formatCurrency(environmentGroup.subtotal)}</strong>
                    </footer>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <span className="text-[#666]">{groupItems.length} {groupItems.length === 1 ? 'móvel' : 'móveis'}</span>
                    <strong>{formatCurrency(environmentGroup.subtotal)}</strong>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Textarea label="Observações internas" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <Textarea label="Mensagem para o cliente" value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} />
      </div>

      <div className="z-30 -mx-2 border-t border-[#D8D8D8] bg-white px-2 pb-1 pt-3 md:sticky md:bottom-0 md:bg-white/95 md:backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#121212] p-4 text-white md:grid-cols-5">
          <div><p className="text-xs text-white/50">Subtotal</p><p className="text-base font-semibold">{formatCurrency(calculated.subtotal)}</p></div>
          <div><p className="text-xs text-white/50">Descontos</p><p className="text-base font-semibold">{formatCurrency(calculated.discount)}</p></div>
          <div><p className="text-xs text-white/50">Custo</p><p className="text-base font-semibold">{formatCurrency(calculated.costTotal)}</p></div>
          <div><p className="text-xs text-white/50">Lucro previsto</p><p className="text-base font-semibold text-emerald-300">{formatCurrency(calculated.profit)}</p></div>
          <div><p className="text-xs text-white/50">Total</p><p className="text-lg font-bold text-[#FFB06B]">{formatCurrency(calculated.total)}</p></div>
        </div>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#777]">
            {draftSavedAt ? `Rascunho salvo neste computador às ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(draftSavedAt)}.` : 'O rascunho será salvo automaticamente neste computador.'}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" loading={saving}>{initialData ? 'Salvar Orçamento' : 'Criar Orçamento'}</Button>
          </div>
        </div>
      </div>
    </form>
  )
}
