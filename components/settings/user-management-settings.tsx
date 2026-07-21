'use client'

import { Save, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type ManagedUser = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'VIEWER'
  active: boolean
  lastLoginAt: string | null
  createdAt: string
  password?: string
}

const roleLabels = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  VIEWER: 'Consulta',
} as const

export function UserManagementSettings({ initialUsers }: { initialUsers: ManagedUser[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [draft, setDraft] = useState({ name: '', email: '', password: '', role: 'MANAGER' as ManagedUser['role'] })
  const [savingId, setSavingId] = useState('')
  const [feedback, setFeedback] = useState('')

  const updateUser = <K extends keyof ManagedUser>(id: string, field: K, value: ManagedUser[K]) => {
    setUsers((current) => current.map((user) => user.id === id ? { ...user, [field]: value } : user))
  }

  const createUser = async () => {
    setSavingId('new')
    setFeedback('')
    const response = await fetch('/api/settings/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const data = await response.json().catch(() => ({}))
    setSavingId('')
    if (!response.ok) return setFeedback(data?.error || 'Não foi possível criar o usuário.')
    setUsers((current) => [...current, data])
    setDraft({ name: '', email: '', password: '', role: 'MANAGER' })
    setFeedback('Usuário criado. Ele já pode entrar com a senha informada.')
  }

  const saveUser = async (user: ManagedUser) => {
    setSavingId(user.id)
    setFeedback('')
    const response = await fetch(`/api/settings/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        ...(user.password ? { password: user.password } : {}),
      }),
    })
    const data = await response.json().catch(() => ({}))
    setSavingId('')
    if (!response.ok) return setFeedback(data?.error || 'Não foi possível atualizar o usuário.')
    setUsers((current) => current.map((item) => item.id === user.id ? data : item))
    setFeedback(`Acesso de ${data.name} atualizado. As sessões anteriores foram encerradas.`)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users size={17} className="text-[#FF6B00]" />
          <div>
            <h2 className="text-sm font-semibold text-[#121212]">Usuários e acessos</h2>
            <p className="mt-1 text-xs text-[#777]">Crie funcionários, limite permissões e encerre acessos antigos.</p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        {feedback ? <p className="rounded-lg bg-[#FFF3EA] px-3 py-2 text-xs text-[#A64200]">{feedback}</p> : null}
        <div className="border-l-4 border-[#FF6B00] bg-[#FAFAFA] p-4">
          <p className="mb-3 text-xs font-semibold uppercase text-[#777]">Novo usuário</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr_170px_auto]">
            <Input label="Nome" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            <Input label="E-mail" type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} />
            <Input label="Senha inicial" type="password" minLength={10} value={draft.password} onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))} helperText="Mínimo de 10 caracteres" />
            <label className="block text-sm font-medium text-[#121212]">Função
              <select value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as ManagedUser['role'] }))} className="mt-1 h-10 w-full rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#FF6B00]">
                {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <Button type="button" className="self-end" loading={savingId === 'new'} disabled={!draft.name || !draft.email || draft.password.length < 10} onClick={() => void createUser()}>
              <UserPlus size={15} /> Adicionar
            </Button>
          </div>
        </div>

        <div className="divide-y divide-[#ECECEC] border border-[#E8E8E8]">
          {users.map((user) => (
            <div key={user.id} className="space-y-3 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_170px_1fr_auto]">
                <Input label="Nome" value={user.name} onChange={(event) => updateUser(user.id, 'name', event.target.value)} />
                <Input label="E-mail" type="email" value={user.email} onChange={(event) => updateUser(user.id, 'email', event.target.value)} />
                <label className="block text-sm font-medium text-[#121212]">Função
                  <select value={user.role} onChange={(event) => updateUser(user.id, 'role', event.target.value as ManagedUser['role'])} className="mt-1 h-10 w-full rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#FF6B00]">
                    {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <Input label="Nova senha (opcional)" type="password" minLength={10} value={user.password || ''} onChange={(event) => updateUser(user.id, 'password', event.target.value)} />
                <Button type="button" variant="outline" className="self-end" loading={savingId === user.id} onClick={() => void saveUser(user)}>
                  <Save size={15} /> Salvar
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#777]">
                <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-[#444]">
                  <input type="checkbox" checked={user.active} onChange={(event) => updateUser(user.id, 'active', event.target.checked)} className="h-4 w-4 accent-[#FF6B00]" />
                  Usuário ativo
                </label>
                <span>{user.lastLoginAt ? `Último acesso: ${new Date(user.lastLoginAt).toLocaleString('pt-BR')}` : 'Ainda não acessou'}</span>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
