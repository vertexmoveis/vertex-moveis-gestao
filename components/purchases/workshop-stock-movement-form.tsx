'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import {
  formatWorkshopStockQuantity,
  isCountedStockUnit,
  workshopStockMovementKinds,
  workshopStockMovementLabels,
  workshopStockUnitLabel,
  type WorkshopStockItemView,
  type WorkshopStockMovementInput,
  type WorkshopStockMovementKind,
  type WorkshopStockPurchaseLine,
} from '@/lib/workshop-stock'
import {
  parseWorkshopStockQuantity,
  workshopStockCountLimit,
  workshopStockQuantityLimit,
} from './workshop-stock-form-quantity'

const movementOptions = workshopStockMovementKinds.map((value) => ({
  value,
  label: value === 'COUNT' ? 'Contagem física' : workshopStockMovementLabels[value],
}))
const purchaseLineLimit = 30

type MovementFormCallbacks = {
  busy: boolean
  onSubmit: (input: WorkshopStockMovementInput) => void
  onCancel: () => void
}

type QuantityFieldsProps = {
  item?: WorkshopStockItemView
  quantity: string
  packaged: boolean
  allowPackages: boolean
  label: string
  onQuantityChange: (quantity: string) => void
  onPackageChange: (packaged: boolean) => void
}

function QuantityFields({
  item,
  quantity,
  packaged,
  allowPackages,
  label,
  onQuantityChange,
  onPackageChange,
}: QuantityFieldsProps) {
  const packageSize = allowPackages ? item?.unitsPerPackage : null
  const amount = parseWorkshopStockQuantity(quantity)
  const packageMode = Boolean(packageSize && packaged)

  return (
    <>
      <Input
        label={label}
        value={quantity}
        onChange={(event) => onQuantityChange(event.target.value)}
        inputMode={packageMode || (item && isCountedStockUnit(item.unit)) ? 'numeric' : 'decimal'}
        helperText={item && !packageSize ? workshopStockUnitLabel(item.unit) : undefined}
        required
      />
      {item && packageSize && (
        <Select
          label="Unidade da entrada"
          value={packageMode ? 'package' : 'stock'}
          onChange={(event) => onPackageChange(event.target.value === 'package')}
          options={[
            { value: 'stock', label: workshopStockUnitLabel(item.unit) },
            { value: 'package', label: `Caixa com ${formatWorkshopStockQuantity(packageSize, item.unit)}` },
          ]}
        />
      )}
      {item && packageMode && packageSize && amount && Number.isInteger(amount) ? (
        <p className="self-end pb-2 text-sm font-medium text-[#555]">Entrada de {formatWorkshopStockQuantity(amount * packageSize, item.unit)}.</p>
      ) : null}
    </>
  )
}

function itemQuantityError(
  amount: number | null,
  item: WorkshopStockItemView,
  { allowZero, packaged }: { allowZero: boolean; packaged: boolean },
) {
  if (amount === null || (!allowZero && amount <= 0)) {
    return allowZero ? 'Informe uma quantidade contada válida.' : 'Informe uma quantidade maior que zero, com até três casas decimais.'
  }
  if (packaged && !Number.isInteger(amount)) return 'Informe um número inteiro de caixas.'
  if (!packaged && isCountedStockUnit(item.unit) && !Number.isInteger(amount)) return 'Informe uma quantidade inteira para esta unidade.'
  if (packaged && amount * (item.unitsPerPackage ?? 0) > workshopStockCountLimit) {
    return 'A quantidade da entrada ultrapassa o limite de estoque.'
  }
  return ''
}

export function WorkshopStockMovementForm({
  item,
  initialKind = 'WITHDRAWAL',
  busy,
  onSubmit,
  onCancel,
}: MovementFormCallbacks & {
  item: WorkshopStockItemView
  initialKind?: WorkshopStockMovementKind
}) {
  const [kind, setKind] = useState(initialKind)
  const [quantity, setQuantity] = useState('')
  const [packaged, setPackaged] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const isPurchase = kind === 'PURCHASE'
  const isCount = kind === 'COUNT'
  const needsReason = isCount || kind === 'LOSS'
  const quantityLabel = isCount ? 'Quantidade contada' : 'Quantidade'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    const amount = parseWorkshopStockQuantity(quantity, isCount ? workshopStockCountLimit : workshopStockQuantityLimit)
    const packages = Boolean(isPurchase && packaged && item.unitsPerPackage)
    const validationError = itemQuantityError(amount, item, { allowZero: isCount, packaged: packages })
    if (validationError || amount === null) return setError(validationError)
    if (needsReason && !reason.trim()) return setError('Informe o motivo do movimento.')

    onSubmit({
      action: 'RECORD_MOVEMENT',
      kind,
      itemId: item.id,
      quantity: amount,
      packaged: packages,
      expectedStockQuantity: isCount ? item.stockQuantity : undefined,
      expectedUnitsPerPackage: packages ? item.unitsPerPackage ?? undefined : undefined,
      supplier: isPurchase ? supplier.trim() || null : null,
      reason: reason.trim() || null,
      reference: reference.trim() || null,
    })
  }

  return (
    <form aria-label="Movimentar material" onSubmit={submit} className="space-y-4">
      <p className="text-sm text-[#555]">Saldo atual de {formatWorkshopStockQuantity(item.stockQuantity, item.unit)}.</p>
      <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Select
          label="Tipo de movimento"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as WorkshopStockMovementKind)
            setError('')
          }}
          options={movementOptions}
        />
        <QuantityFields
          item={item}
          label={quantityLabel}
          quantity={quantity}
          packaged={packaged}
          allowPackages={isPurchase}
          onQuantityChange={setQuantity}
          onPackageChange={setPackaged}
        />
        {isCount && <p className="text-sm text-[#555] sm:col-span-2">Informe o total encontrado na contagem. O sistema calcula o ajuste em relação ao saldo atual.</p>}
        {isPurchase && <Input label="Fornecedor" value={supplier} onChange={(event) => setSupplier(event.target.value)} maxLength={160} />}
        <Input label={isPurchase ? 'Referência da compra ou nota' : 'Referência ou obra'} value={reference} onChange={(event) => setReference(event.target.value)} maxLength={160} />
        <div className="sm:col-span-2">
          <Textarea rows={2} label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required={needsReason} />
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="min-h-10" disabled={busy} onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="min-h-10" loading={busy}>Registrar movimento</Button>
      </div>
    </form>
  )
}

type PurchaseLine = {
  key: number
  itemId: string
  quantity: string
  packaged: boolean
}

function blankLine(key: number): PurchaseLine {
  return { key, itemId: '', quantity: '', packaged: false }
}

export function WorkshopStockPurchaseForm({
  items,
  busy,
  onSubmit,
  onCancel,
}: MovementFormCallbacks & { items: WorkshopStockItemView[] }) {
  const [lines, setLines] = useState(() => [blankLine(1)])
  const [supplier, setSupplier] = useState('')
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const nextKey = useRef(2)
  const activeItems = items.filter((item) => item.active)
  const itemsById = new Map(activeItems.map((item) => [item.id, item]))
  const selectedItems = new Set(lines.map((line) => line.itemId))
  const canAddLine = lines.length < Math.min(purchaseLineLimit, activeItems.length)

  function updateLine(key: number, update: Partial<Omit<PurchaseLine, 'key'>>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...update } : line))
  }

  function addLine() {
    const line = blankLine(nextKey.current)
    nextKey.current++
    setLines((current) => [...current, line])
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    const purchaseLines: WorkshopStockPurchaseLine[] = []
    for (const line of lines) {
      const item = itemsById.get(line.itemId)
      if (!item) return setError('Escolha o material em todas as linhas.')
      const amount = parseWorkshopStockQuantity(line.quantity)
      const packaged = Boolean(line.packaged && item.unitsPerPackage)
      const validationError = itemQuantityError(amount, item, { allowZero: false, packaged })
      if (validationError || amount === null) return setError(`${item.name} — ${validationError}`)
      purchaseLines.push({
        itemId: item.id,
        quantity: amount,
        packaged,
        expectedUnitsPerPackage: packaged ? item.unitsPerPackage ?? undefined : undefined,
      })
    }

    onSubmit({
      action: 'RECORD_PURCHASE_BATCH',
      lines: purchaseLines,
      supplier: supplier.trim() || null,
      reference: reference.trim() || null,
      reason: reason.trim() || null,
    })
  }

  return (
    <form aria-label="Registrar compra" onSubmit={submit} className="space-y-4">
      <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Input label="Fornecedor" value={supplier} onChange={(event) => setSupplier(event.target.value)} maxLength={160} />
        <Input label="Referência da compra ou nota" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={160} />
      </fieldset>
      {lines.map((line, index) => {
        const item = itemsById.get(line.itemId)
        const options = activeItems
          .filter((candidate) => candidate.id === line.itemId || !selectedItems.has(candidate.id))
          .map((candidate) => ({ value: candidate.id, label: [candidate.name, candidate.code].filter(Boolean).join(' · ') }))

        return (
          <fieldset key={line.key} disabled={busy} className="grid min-w-0 gap-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-medium text-[#121212]">Item {index + 1}</legend>
            <Select label="Material" placeholder="Escolha o material" options={options} value={line.itemId} onChange={(event) => updateLine(line.key, { itemId: event.target.value, packaged: false })} required />
            <QuantityFields
              item={item}
              label="Quantidade comprada"
              quantity={line.quantity}
              packaged={line.packaged}
              allowPackages
              onQuantityChange={(quantity) => updateLine(line.key, { quantity })}
              onPackageChange={(packaged) => updateLine(line.key, { packaged })}
            />
            {lines.length > 1 && (
              <Button type="button" variant="ghost" size="sm" className="min-h-9 justify-self-start" aria-label={`Remover item ${index + 1}`} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>
                Remover item
              </Button>
            )}
          </fieldset>
        )
      })}
      <Button type="button" variant="outline" className="min-h-10" disabled={busy || !canAddLine} onClick={addLine}>Adicionar item à compra</Button>
      <Textarea rows={2} label="Observação da compra" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} disabled={busy} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="min-h-10" disabled={busy} onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="min-h-10" disabled={activeItems.length === 0} loading={busy}>Registrar compra</Button>
      </div>
    </form>
  )
}
