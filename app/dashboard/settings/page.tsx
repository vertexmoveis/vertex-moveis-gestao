import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Header } from '@/components/layout/header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { BackupButton } from '@/components/settings/backup-button'
import { PricingMaterialsSettings } from '@/components/settings/pricing-materials-settings'
import { OperationsResourcesSettings } from '@/components/settings/operations-resources-settings'
import { prisma } from '@/lib/db'
import { ensureDefaultQuoteSettings, serializeQuotePriceRule } from '@/lib/quote-price-rules'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { name?: string; email?: string; role?: string }
  const isAdmin = user?.role === 'ADMIN'
  const canCreateLocalBackup = process.env.VERCEL !== '1'
  if (isAdmin) await ensureDefaultQuoteSettings(prisma)
  const [priceRules, materials, resources] = isAdmin
    ? await Promise.all([
        prisma.quotePriceRule.findMany({ orderBy: [{ active: 'desc' }, { environment: 'asc' }, { name: 'asc' }] }),
        prisma.materialCatalogItem.findMany({ orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }] }),
        prisma.operationalResource.findMany({ orderBy: [{ type: 'asc' }, { active: 'desc' }, { name: 'asc' }] }),
      ])
    : [[], [], []]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Configurações"
        subtitle="Gerencie sua conta e preferências"
        userName={user?.name || ''}
      />

      <div className="flex-1 p-4 sm:p-6 max-w-6xl space-y-6">
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

        {isAdmin && (
          <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#121212]">Backup</h2>
          </CardHeader>
          <CardBody>
              {canCreateLocalBackup ? (
                <BackupButton />
              ) : (
                <p className="text-sm text-[#6B7280]">
                  A copia local e criada pelo computador da Vertex. O botao manual fica disponivel somente na instalacao local.
                </p>
              )}
          </CardBody>
          </Card>
        )}

        {isAdmin && (
          <PricingMaterialsSettings
            initialPriceRules={priceRules.map(serializeQuotePriceRule)}
            initialMaterials={materials.map((material) => ({ ...material, updatedAt: material.updatedAt.toISOString() }))}
          />
        )}

        {isAdmin && (
          <OperationsResourcesSettings
            initialResources={resources.flatMap((resource) => (
              resource.type === 'TEAM' || resource.type === 'VEHICLE'
                ? [{ id: resource.id, name: resource.name, type: resource.type, active: resource.active }]
                : []
            ))}
          />
        )}

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[#121212]">Sobre o Sistema</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {[
                { label: 'Sistema', value: 'Vertex Móveis - Gestão' },
                { label: 'Versão', value: '1.0.0' },
                { label: 'Desenvolvido por', value: 'Vertex Móveis' },
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
