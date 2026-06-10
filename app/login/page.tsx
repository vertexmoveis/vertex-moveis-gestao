'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Building2, Lock, Mail, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Email ou senha incorretos')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      if (data.credentials) {
        setEmail(data.credentials.email)
        setPassword(data.credentials.password)
        setError('')
        alert('Dados de exemplo criados! Clique em Entrar para continuar.')
      } else if (data.alreadySeeded) {
        setEmail('admin@vertexmoveis.com.br')
        setPassword('admin123')
      }
    } catch {
      setError('Erro ao criar dados de exemplo')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#121212] via-[#1a1a1a] to-[#121212] flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, #FF6B00 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FF6B00] rounded-2xl mb-4 shadow-lg shadow-orange-500/30">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Vertex Móveis</h1>
          <p className="text-white/50 text-sm mt-1">Sistema de Gestão</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-8 py-8">
            <h2 className="text-lg font-bold text-[#121212] mb-1">Bem-vindo de volta</h2>
            <p className="text-sm text-[#9E9E9E] mb-6">Entre com suas credenciais</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#D9D9D9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent transition-all"
                />
              </div>

              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
                <input
                  type="password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#D9D9D9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent transition-all"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg text-xs">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full h-10">
                Entrar
              </Button>
            </form>
          </div>

          <div className="px-8 pb-6">
            <div className="border-t border-[#F0F0F0] pt-4">
              <p className="text-xs text-[#9E9E9E] text-center mb-3">Primeiro acesso?</p>
              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding}
                className="w-full py-2 text-xs font-medium text-[#FF6B00] border border-[#FF6B00]/20 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors disabled:opacity-50"
              >
                {seeding ? 'Criando dados...' : 'Criar dados de exemplo'}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          © {new Date().getFullYear()} Vertex Móveis. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
