'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { useState } from 'react'

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  document: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface ClientFormProps {
  initialData?: Partial<Record<keyof FormData, string | null> & { id: string }>
  onSubmit: (data: FormData) => Promise<void>
  onCancel: () => void
}

export function ClientForm({ initialData, onSubmit, onCancel }: ClientFormProps) {
  const [loading, setLoading] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)

  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name || '',
      document: initialData?.document || '',
      phone: initialData?.phone || '',
      whatsapp: initialData?.whatsapp || '',
      email: initialData?.email || '',
      street: initialData?.street || '',
      number: initialData?.number || '',
      neighborhood: initialData?.neighborhood || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      zipCode: initialData?.zipCode || '',
      address: initialData?.address || '',
      notes: initialData?.notes || '',
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

  const zipCodeRegister = register('zipCode')

  const fetchCep = async (value: string) => {
    const cep = value.replace(/\D/g, '')
    if (cep.length !== 8) return

    setLoadingCep(true)
    try {
      const response = await fetch(`/api/cep?cep=${cep}`)
      if (!response.ok) return

      const data = await response.json() as {
        street?: string
        neighborhood?: string
        city?: string
        state?: string
        zipCode?: string
      }
      if (data.street) setValue('street', data.street)
      if (data.neighborhood) setValue('neighborhood', data.neighborhood)
      if (data.city) setValue('city', data.city)
      if (data.state) setValue('state', data.state)
      if (data.zipCode) setValue('zipCode', data.zipCode)
    } finally {
      setLoadingCep(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Input
        label="Nome Completo *"
        placeholder="Nome do cliente"
        error={errors.name?.message}
        {...register('name')}
      />
      <Input label="CPF / CNPJ" placeholder="000.000.000-00 ou 00.000.000/0000-00" {...register('document')} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Telefone" placeholder="(11) 99999-9999" {...register('phone')} />
        <Input label="WhatsApp" placeholder="(11) 99999-9999" {...register('whatsapp')} />
      </div>
      <Input
        label="Email"
        type="email"
        placeholder="cliente@email.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <div className="space-y-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3">
        <p className="text-sm font-semibold text-[#121212]">Endereço</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
          <Input label="Rua" placeholder="Rua, avenida..." {...register('street')} />
          <Input label="Número" placeholder="123" {...register('number')} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Bairro" placeholder="Bairro" {...register('neighborhood')} />
          <Input label="Cidade" placeholder="Cidade" {...register('city')} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
          <Input label="Estado" placeholder="SP" maxLength={2} {...register('state')} />
          <Input
            label={loadingCep ? 'CEP (buscando...)' : 'CEP'}
            placeholder="00000-000"
            {...zipCodeRegister}
            onBlur={(event) => {
              zipCodeRegister.onBlur(event)
              fetchCep(event.target.value)
            }}
          />
        </div>
        <Input label="Complemento / referência" placeholder="Apartamento, bloco, ponto de referência..." {...register('address')} />
      </div>
      <Textarea
        label="Observações"
        placeholder="Preferências, observações importantes..."
        {...register('notes')}
      />

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {initialData?.id ? 'Salvar Alterações' : 'Cadastrar Cliente'}
        </Button>
      </div>
    </form>
  )
}
