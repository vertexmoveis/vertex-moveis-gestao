'use client'

import { useState } from 'react'
import { Building2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { CompanyProfileData } from '@/lib/company-profile'

type EditableCompanyProfile = Pick<
  CompanyProfileData,
  | 'tradeName'
  | 'legalName'
  | 'document'
  | 'phone'
  | 'email'
  | 'instagram'
  | 'googleReviewUrl'
  | 'street'
  | 'number'
  | 'complement'
  | 'neighborhood'
  | 'city'
  | 'state'
  | 'zipCode'
  | 'defaultDeliveryBusinessDays'
  | 'quoteReminderDays'
  | 'leadNoResponseDays'
  | 'leadCloseSuggestionDays'
  | 'weeklyProductionCapacity'
>

export function CompanyProfileSettings({ initialProfile }: { initialProfile: CompanyProfileData }) {
  const [profile, setProfile] = useState<EditableCompanyProfile>({
    tradeName: initialProfile.tradeName,
    legalName: initialProfile.legalName,
    document: initialProfile.document,
    phone: initialProfile.phone,
    email: initialProfile.email,
    instagram: initialProfile.instagram,
    googleReviewUrl: initialProfile.googleReviewUrl,
    street: initialProfile.street,
    number: initialProfile.number,
    complement: initialProfile.complement,
    neighborhood: initialProfile.neighborhood,
    city: initialProfile.city,
    state: initialProfile.state,
    zipCode: initialProfile.zipCode,
    defaultDeliveryBusinessDays: initialProfile.defaultDeliveryBusinessDays,
    quoteReminderDays: initialProfile.quoteReminderDays,
    leadNoResponseDays: initialProfile.leadNoResponseDays,
    leadCloseSuggestionDays: initialProfile.leadCloseSuggestionDays,
    weeklyProductionCapacity: initialProfile.weeklyProductionCapacity,
  })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const update = (field: keyof EditableCompanyProfile, value: string | number) => {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  const save = async () => {
    setSaving(true)
    setFeedback('')
    try {
      const response = await fetch('/api/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Não foi possível salvar os dados da empresa.')
      setProfile({
        tradeName: data.tradeName,
        legalName: data.legalName,
        document: data.document,
        phone: data.phone,
        email: data.email,
        instagram: data.instagram,
        googleReviewUrl: data.googleReviewUrl,
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        defaultDeliveryBusinessDays: data.defaultDeliveryBusinessDays,
        quoteReminderDays: data.quoteReminderDays,
        leadNoResponseDays: data.leadNoResponseDays,
        leadCloseSuggestionDays: data.leadCloseSuggestionDays,
        weeklyProductionCapacity: data.weeklyProductionCapacity,
      })
      setFeedback('Dados da empresa atualizados nos próximos orçamentos.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar os dados da empresa.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 size={17} className="text-[#FF6B00]" />
          <div>
            <h2 className="text-sm font-semibold text-[#121212]">Dados da empresa nos orçamentos</h2>
            <p className="mt-1 text-xs text-[#777]">Informações exibidas na proposta comercial e no orçamento simples.</p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input label="Nome fantasia" value={profile.tradeName} onChange={(event) => update('tradeName', event.target.value)} />
          <Input label="Razão social" value={profile.legalName || ''} onChange={(event) => update('legalName', event.target.value)} />
          <Input label="CNPJ" value={profile.document || ''} onChange={(event) => update('document', event.target.value)} />
          <Input label="Telefone" value={profile.phone || ''} onChange={(event) => update('phone', event.target.value)} />
          <Input label="E-mail" type="email" value={profile.email || ''} onChange={(event) => update('email', event.target.value)} />
          <Input
            label="Instagram da Vertex"
            value={profile.instagram || ''}
            onChange={(event) => update('instagram', event.target.value)}
            placeholder="@usuario ou instagram.com/usuario"
          />
          <Input
            label="Link de avaliação no Google"
            type="url"
            value={profile.googleReviewUrl || ''}
            onChange={(event) => update('googleReviewUrl', event.target.value)}
            placeholder="https://g.page/r/.../review"
          />
          <Input
            label="Prazo padrão (dias úteis)"
            type="number"
            min={1}
            max={365}
            value={profile.defaultDeliveryBusinessDays}
            onChange={(event) => update('defaultDeliveryBusinessDays', Number(event.target.value) || 30)}
          />
        </div>
        <div className="border-t border-[#ECECEC] pt-4">
          <p className="mb-1 text-xs font-semibold uppercase text-[#777]">Acompanhamento comercial</p>
          <p className="mb-3 text-xs text-[#777]">
            Define quando o CRM avisa sobre orçamentos e negociações sem resposta.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              label="Lembrar orçamento após (dias)"
              type="number"
              min={1}
              max={30}
              value={profile.quoteReminderDays}
              onChange={(event) => update('quoteReminderDays', Number(event.target.value) || 3)}
            />
            <Input
              label="Marcar sem retorno após (dias)"
              type="number"
              min={1}
              max={365}
              value={profile.leadNoResponseDays}
              onChange={(event) => update('leadNoResponseDays', Number(event.target.value) || 30)}
            />
            <Input
              label="Sugerir encerramento após (dias)"
              type="number"
              min={1}
              max={730}
              value={profile.leadCloseSuggestionDays}
              onChange={(event) => update('leadCloseSuggestionDays', Number(event.target.value) || 90)}
            />
          </div>
        </div>
        <div className="border-t border-[#ECECEC] pt-4">
          <p className="mb-1 text-xs font-semibold uppercase text-[#777]">Capacidade da produção</p>
          <p className="mb-3 text-xs text-[#777]">
            Quantidade máxima de projetos com entrega prevista na mesma semana.
          </p>
          <div className="max-w-xs">
            <Input
              label="Pontos por semana"
              type="number"
              min={1}
              max={50}
              value={profile.weeklyProductionCapacity}
              onChange={(event) => update('weeklyProductionCapacity', Number(event.target.value) || 4)}
            />
          </div>
        </div>
        <div className="border-t border-[#ECECEC] pt-4">
          <p className="mb-3 text-xs font-semibold uppercase text-[#777]">Endereço da empresa</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2"><Input label="Rua" value={profile.street || ''} onChange={(event) => update('street', event.target.value)} /></div>
            <Input label="Número" value={profile.number || ''} onChange={(event) => update('number', event.target.value)} />
            <Input label="Complemento" value={profile.complement || ''} onChange={(event) => update('complement', event.target.value)} />
            <Input label="Bairro" value={profile.neighborhood || ''} onChange={(event) => update('neighborhood', event.target.value)} />
            <Input label="Cidade" value={profile.city || ''} onChange={(event) => update('city', event.target.value)} />
            <Input label="Estado" maxLength={2} value={profile.state || ''} onChange={(event) => update('state', event.target.value.toUpperCase())} />
            <Input label="CEP" value={profile.zipCode || ''} onChange={(event) => update('zipCode', event.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-[#ECECEC] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-sm ${feedback.startsWith('Dados') ? 'text-emerald-700' : 'text-red-700'}`}>{feedback}</p>
          <Button type="button" loading={saving} onClick={() => void save()}>
            <Save size={16} />
            Salvar dados
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
