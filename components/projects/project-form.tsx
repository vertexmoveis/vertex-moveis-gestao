'use client'

import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { ClientSearchSelect } from '@/components/clients/client-search-select'
import {
  normalizeProductionStage,
  PROJECT_STATUS_LABELS,
  PRODUCTION_STAGE_FLOW,
  PRODUCTION_STAGE_LABELS,
  type ProductionStage,
} from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  calculateProjectProductionDates,
  DEFAULT_DELIVERY_BUSINESS_DAYS,
  DEFAULT_PRODUCTION_REMINDER_BUSINESS_DAYS,
} from '@/lib/business-days'
import { useState } from 'react'

const schema = z.object({
  clientId: z.string().min(1, 'Selecione um cliente'),
  name: z.string().min(1, 'Nome obrigatório'),
  room: z.string().optional(),
  environments: z.string().optional(),
  status: z.string().min(1),
  stage: z.string().min(1),
  approvalDate: z.string().optional(),
  paymentConfirmedAt: z.string().optional(),
  deliveryBusinessDays: z.string().optional(),
  productionReminderBusinessDays: z.string().optional(),
  startDate: z.string().optional(),
  estimatedEndDate: z.string().optional(),
  value: z.string().optional(),
  productionCost: z.string().optional(),
  downPayment: z.string().optional(),
  downPaymentDate: z.string().optional(),
  installmentCount: z.string().optional(),
  firstInstallmentDate: z.string().optional(),
  managerId: z.string().optional(),
  internalNotes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Client { id: string; name: string }
interface User { id: string; name: string }

interface ProjectFormProps {
  clients: Client[]
  managers: User[]
  initialData?: Partial<Record<keyof FormData, string | null> & { id: string }>
  onSubmit: (data: FormData) => Promise<void>
  onCancel: () => void
}

export function ProjectForm({ clients, managers, initialData, onSubmit, onCancel }: ProjectFormProps) {
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const defaultStage = initialData?.stage
    ? normalizeProductionStage(initialData.stage as ProductionStage)
    : 'PENDING_START'

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: initialData?.clientId || '',
      name: initialData?.name || '',
      room: initialData?.room || '',
      environments: initialData?.environments || initialData?.room || '',
      status: initialData?.status || 'APPROVED',
      stage: defaultStage,
      approvalDate: initialData?.approvalDate || '',
      paymentConfirmedAt: initialData?.paymentConfirmedAt || '',
      deliveryBusinessDays: initialData?.deliveryBusinessDays || String(DEFAULT_DELIVERY_BUSINESS_DAYS),
      productionReminderBusinessDays: initialData?.productionReminderBusinessDays || String(DEFAULT_PRODUCTION_REMINDER_BUSINESS_DAYS),
      startDate: initialData?.startDate || '',
      estimatedEndDate: initialData?.estimatedEndDate || '',
      value: initialData?.value || '',
      productionCost: initialData?.productionCost || '',
      downPayment: initialData?.downPayment || '',
      downPaymentDate: initialData?.downPaymentDate || '',
      installmentCount: initialData?.installmentCount || '',
      firstInstallmentDate: initialData?.firstInstallmentDate || '',
      managerId: initialData?.managerId || '',
      internalNotes: initialData?.internalNotes || '',
    },
  })

  const handleFormSubmit = async (data: FormData) => {
    setLoading(true)
    setSubmitError('')
    try {
      const environments = data.environments || data.room || ''
      await onSubmit({ ...data, room: environments, environments })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível salvar o projeto.')
    } finally {
      setLoading(false)
    }
  }

  const statusOptions = Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label }))
  const stageOptions = PRODUCTION_STAGE_FLOW.map((value) => ({ value, label: PRODUCTION_STAGE_LABELS[value] }))
  const managerOptions = managers.map((m) => ({ value: m.id, label: m.name }))
  const [watchedValue, watchedProductionCost, watchedDownPayment, watchedInstallmentCount] = useWatch({
    control,
    name: ['value', 'productionCost', 'downPayment', 'installmentCount'],
  })
  const [watchedApprovalDate, watchedPaymentConfirmedAt, watchedDeliveryBusinessDays, watchedReminderBusinessDays] = useWatch({
    control,
    name: ['approvalDate', 'paymentConfirmedAt', 'deliveryBusinessDays', 'productionReminderBusinessDays'],
  })
  const value = Number(watchedValue || 0)
  const productionCost = Number(watchedProductionCost || 0)
  const downPayment = Math.min(Number(watchedDownPayment || 0), Number.isFinite(value) ? value : 0)
  const installmentCount = Math.max(Math.floor(Number(watchedInstallmentCount || 0)), 0)
  const remaining = Math.max((Number.isFinite(value) ? value : 0) - (Number.isFinite(downPayment) ? downPayment : 0), 0)
  const installmentValue = installmentCount > 0 ? remaining / installmentCount : 0
  const profit = Math.max(Number.isFinite(value) ? value : 0, 0) - Math.max(Number.isFinite(productionCost) ? productionCost : 0, 0)
  const deliveryBusinessDays = Math.max(Math.floor(Number(watchedDeliveryBusinessDays || DEFAULT_DELIVERY_BUSINESS_DAYS)), 1)
  const reminderBusinessDays = Math.max(Math.floor(Number(watchedReminderBusinessDays || DEFAULT_PRODUCTION_REMINDER_BUSINESS_DAYS)), 1)
  const productionDates = calculateProjectProductionDates({
    approvalDate: watchedPaymentConfirmedAt || watchedApprovalDate,
    deliveryBusinessDays,
    reminderBusinessDays,
  })

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Controller
            control={control}
            name="clientId"
            render={({ field }) => (
              <ClientSearchSelect
                label="Cliente *"
                value={field.value}
                onChange={field.onChange}
                initialOptions={clients}
                error={errors.clientId?.message}
              />
            )}
          />
        </div>
        <div className="col-span-2">
          <Input
            label="Nome do Projeto *"
            placeholder="Ex: Cozinha Completa"
            error={errors.name?.message}
            {...register('name')}
          />
        </div>
        <input type="hidden" {...register('room')} />
        <div className="col-span-2">
          <Textarea
            label="Ambientes do projeto"
            placeholder={'Ex:\nCozinha\nDormitório 1\nDormitório 2\nBanheiro'}
            rows={4}
            {...register('environments')}
          />
          <p className="mt-1 text-[11px] text-[#9E9E9E]">
            Separe por linha ou vírgula. Cada ambiente terá status próprio no projeto.
          </p>
        </div>
        <Input
          label="Confirmação do pagamento"
          type="date"
          {...register('paymentConfirmedAt')}
        />
        <Input
          label="Valor (R$)"
          type="number"
          step="0.01"
          placeholder="0,00"
          {...register('value')}
        />
        <Input
          label="Custo previsto (R$)"
          type="number"
          step="0.01"
          placeholder="0,00"
          {...register('productionCost')}
        />
        <Input
          label="Entrada (R$)"
          type="number"
          step="0.01"
          placeholder="0,00"
          {...register('downPayment')}
        />
        <Input label="Data da entrada" type="date" {...register('downPaymentDate')} />
        <Input
          label="Parcelas"
          type="number"
          step="1"
          min="0"
          placeholder="0"
          {...register('installmentCount')}
        />
        <Input label="Data da primeira parcela" type="date" {...register('firstInstallmentDate')} />
        <div className="col-span-2 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <p className="text-[#9E9E9E]">Lucro previsto</p>
              <p className={`mt-1 font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(profit)}</p>
            </div>
            <div>
              <p className="text-[#9E9E9E]">Restante</p>
              <p className="mt-1 font-semibold text-[#121212]">{formatCurrency(remaining)}</p>
            </div>
            <div>
              <p className="text-[#9E9E9E]">Valor da parcela</p>
              <p className="mt-1 font-semibold text-[#121212]">{formatCurrency(installmentValue)}</p>
            </div>
            <div>
              <p className="text-[#9E9E9E]">Condição</p>
              <p className="mt-1 font-semibold text-[#121212]">
                {downPayment > 0 ? `${formatCurrency(downPayment)} + ` : ''}{installmentCount}x
              </p>
            </div>
          </div>
        </div>
        <Select label="Status" options={statusOptions} {...register('status')} />
        <Select label="Etapa de Produção" options={stageOptions} {...register('stage')} />
        <Input label="Aprovação do cartão" type="date" {...register('approvalDate')} />
        <Input
          label="Prazo (dias úteis)"
          type="number"
          min="1"
          step="1"
          {...register('deliveryBusinessDays')}
        />
        <input type="hidden" {...register('productionReminderBusinessDays')} />
        <div className="col-span-2 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[#9E9E9E]">Entrega calculada</p>
              <p className="mt-1 font-semibold text-[#121212]">
                {productionDates.deliveryDeadlineDate ? formatDate(productionDates.deliveryDeadlineDate) : '-'}
              </p>
            </div>
            <div>
              <p className="text-[#9E9E9E]">Cobrar início</p>
              <p className="mt-1 font-semibold text-[#121212]">
                {productionDates.productionStartReminderDate ? formatDate(productionDates.productionStartReminderDate) : '-'}
              </p>
            </div>
          </div>
        </div>
        <Input label="Data de início" type="date" {...register('startDate')} />
        <Input label="Previsão manual" type="date" {...register('estimatedEndDate')} />
        <div className="col-span-2">
          <Select
            label="Responsável"
            options={managerOptions}
            placeholder="Selecione o responsável"
            {...register('managerId')}
          />
        </div>
        <div className="col-span-2">
          <Textarea
            label="Notas Internas"
            placeholder="Observações sobre o projeto..."
            {...register('internalNotes')}
          />
        </div>
      </div>

      {submitError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {initialData?.id ? 'Salvar Alterações' : 'Criar Projeto'}
        </Button>
      </div>
    </form>
  )
}
