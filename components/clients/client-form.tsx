'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { useState } from 'react'

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name || '',
      phone: initialData?.phone || '',
      whatsapp: initialData?.whatsapp || '',
      email: initialData?.email || '',
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

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Input
        label="Nome Completo *"
        placeholder="Nome do cliente"
        error={errors.name?.message}
        {...register('name')}
      />
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
      <Input label="Endereço" placeholder="Rua, número, bairro, cidade" {...register('address')} />
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
