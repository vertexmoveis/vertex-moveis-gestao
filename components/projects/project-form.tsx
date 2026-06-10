'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { PROJECT_STATUS_LABELS, PRODUCTION_STAGE_LABELS, type ProjectStatus, type ProductionStage } from '@/types'
import { useState } from 'react'

const schema = z.object({
  clientId: z.string().min(1, 'Selecione um cliente'),
  name: z.string().min(1, 'Nome obrigatório'),
  room: z.string().optional(),
  status: z.string().min(1),
  stage: z.string().min(1),
  startDate: z.string().optional(),
  estimatedEndDate: z.string().optional(),
  value: z.string().optional(),
  managerId: z.string().optional(),
  internalNotes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Client { id: string; name: string }
interface User { id: string; name: string }

interface ProjectFormProps {
  clients: Client[]
  managers: User[]
  initialData?: Partial<FormData & { id: string }>
  onSubmit: (data: FormData) => Promise<void>
  onCancel: () => void
}

export function ProjectForm({ clients, managers, initialData, onSubmit, onCancel }: ProjectFormProps) {
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: initialData?.clientId || '',
      name: initialData?.name || '',
      room: initialData?.room || '',
      status: initialData?.status || 'APPROVED',
      stage: initialData?.stage || 'PENDING_START',
      startDate: initialData?.startDate || '',
      estimatedEndDate: initialData?.estimatedEndDate || '',
      value: initialData?.value || '',
      managerId: initialData?.managerId || '',
      internalNotes: initialData?.internalNotes || '',
    },
  })

  const handleFormSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await onSubmit(data)
    } finally {
      setLoading(false)
    }
  }

  const statusOptions = Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label }))
  const stageOptions = Object.entries(PRODUCTION_STAGE_LABELS).map(([value, label]) => ({ value, label }))
  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }))
  const managerOptions = managers.map((m) => ({ value: m.id, label: m.name }))

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Select
            label="Cliente *"
            options={clientOptions}
            placeholder="Selecione o cliente"
            error={errors.clientId?.message}
            {...register('clientId')}
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
        <Input label="Ambiente" placeholder="Ex: Cozinha, Quarto..." {...register('room')} />
        <Input
          label="Valor (R$)"
          type="number"
          step="0.01"
          placeholder="0,00"
          {...register('value')}
        />
        <Select label="Status" options={statusOptions} {...register('status')} />
        <Select label="Etapa de Produção" options={stageOptions} {...register('stage')} />
        <Input label="Data de Início" type="date" {...register('startDate')} />
        <Input label="Previsão de Entrega" type="date" {...register('estimatedEndDate')} />
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
