'use client'

import { useState } from 'react'
import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
          <div className="mb-4 flex justify-center">
            <Image
              src="/vertex-symbol.png"
              alt="Vertex Móveis"
              width={96}
              height={64}
              priority
              className="h-auto w-20 drop-shadow-lg"
            />
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

        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          © {new Date().getFullYear()} Vertex Móveis. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
