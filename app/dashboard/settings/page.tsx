import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Header } from '@/components/layout/header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { name?: string; email?: string; role?: string }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Configuracoes"
        subtitle="Gerencie sua conta e preferencias"
        userName={user?.name || ''}
      />

      <div className="flex-1 p-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#121212]">Minha Conta</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center gap-4">
              <Avatar name={user?.name || 'U'} size="lg" />
              <div>
                <p className="text-base font-bold text-[#121212]">{user?.name}</p>
                <p className="text-sm text-[#9E9E9E]">{user?.email}</p>
                <div className="mt-1">
                  <Badge color={user?.role === 'ADMIN' ? 'orange' : 'blue'}>
                    {user?.role === 'ADMIN' ? 'Administrador' : 'Gerente'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#121212]">Sobre o Sistema</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {[
                { label: 'Sistema', value: 'Vertex Moveis - Gestao' },
                { label: 'Versao', value: '1.0.0' },
                { label: 'Desenvolvido por', value: 'Vertex Moveis' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-[#F5F5F5] last:border-0">
                  <span className="text-sm text-[#9E9E9E]">{item.label}</span>
                  <span className="text-sm font-medium text-[#121212]">{item.value}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
