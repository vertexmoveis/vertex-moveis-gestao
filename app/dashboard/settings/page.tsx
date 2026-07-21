import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Header } from '@/components/layout/header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { BackupButton } from '@/components/settings/backup-button'
import { PricingMaterialsSettings } from '@/components/settings/pricing-materials-settings'
import { OperationsResourcesSettings } from '@/components/settings/operations-resources-settings'
import { CompanyProfileSettings } from '@/components/settings/company-profile-settings'
import { UserManagementSettings } from '@/components/settings/user-management-settings'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID, serializeCompanyProfile } from '@/lib/company-profile'
import { ensureDefaultQuoteSettings, serializeQuotePriceRule } from '@/lib/quote-price-rules'
import { CheckCircle2, DatabaseBackup, TriangleAlert } from 'lucide-react'

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(value)
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  VIEWER: 'Consulta',
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { name?: string; email?: string; role?: string }
  const isAdmin = user?.role === 'ADMIN'
  const canCreateLocalBackup = process.env.VERCEL !== '1'
  if (isAdmin) await ensureDefaultQuoteSettings(prisma)
  const databaseTime = isAdmin
    ? (await prisma.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS now`)[0]?.now || new Date(0)
    : new Date(0)
  const errorWindowStart = new Date(databaseTime.getTime() - 24 * 60 * 60 * 1000)
  const [priceRules, materials, resources, managedUsers] = isAdmin
    ? await Promise.all([
        prisma.quotePriceRule.findMany({ orderBy: [{ active: 'desc' }, { environment: 'asc' }, { name: 'asc' }] }),
        prisma.materialCatalogItem.findMany({ orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }] }),
        prisma.operationalResource.findMany({ orderBy: [{ type: 'asc' }, { active: 'desc' }, { name: 'asc' }] }),
        prisma.user.findMany({
          orderBy: [{ active: 'desc' }, { name: 'asc' }],
          select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true },
        }),
      ])
    : [[], [], [], []]
  const companyProfile = isAdmin
    ? await prisma.companyProfile.findUnique({ where: { id: COMPANY_PROFILE_ID } })
    : null
  const [latestBackup, recentErrorCount, recentErrors] = isAdmin
    ? await Promise.all([
        prisma.systemEvent.findFirst({
          where: { type: { in: ['BACKUP_SUCCESS', 'BACKUP_FAILURE'] } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.systemEvent.count({
          where: { severity: 'ERROR', createdAt: { gte: errorWindowStart } },
        }),
        prisma.systemEvent.findMany({
          where: { severity: 'ERROR' },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { id: true, source: true, message: true, createdAt: true },
        }),
      ])
    : [null, 0, []]
  const backupDetails = latestBackup?.details && typeof latestBackup.details === 'object' && !Array.isArray(latestBackup.details)
    ? latestBackup.details as Record<string, unknown>
    : {}
  const backupRecent = latestBackup
    ? databaseTime.getTime() - latestBackup.createdAt.getTime() < 36 * 60 * 60 * 1000
    : false
  const secondaryCopied = backupDetails.secondaryCopied === true
  const backupHealthy = latestBackup?.type === 'BACKUP_SUCCESS' && backupRecent && secondaryCopied

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
                    {roleLabels[user?.role || ''] || 'Usuário'}
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
                  A cópia local é criada pelo computador da Vertex. O botão manual fica disponível somente na instalação local.
                </p>
              )}
          </CardBody>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#121212]">Saúde do sistema</h2>
                  <p className="mt-1 text-xs text-[#777]">Backup, cópia externa e erros recentes</p>
                </div>
                {backupHealthy
                  ? <CheckCircle2 size={20} className="text-emerald-600" aria-label="Sistema protegido" />
                  : <TriangleAlert size={20} className="text-amber-600" aria-label="Sistema requer atenção" />}
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className={`border-l-4 p-3 ${backupHealthy ? 'border-emerald-500 bg-emerald-50' : 'border-amber-500 bg-amber-50'}`}>
                  <div className="flex items-center gap-2"><DatabaseBackup size={15} /><p className="text-xs font-semibold">Último backup</p></div>
                  <p className="mt-2 text-sm font-bold">{latestBackup ? formatTimestamp(latestBackup.createdAt) : 'Ainda não registrado'}</p>
                  <p className="mt-1 text-xs text-[#666]">{latestBackup?.type === 'BACKUP_SUCCESS' ? `${backupDetails.encrypted === true ? 'Criptografado, ' : ''}restaurado e conferido` : 'Verifique a execução diária'}</p>
                </div>
                <div className="border-l-4 border-blue-500 bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-blue-800">Segunda cópia</p>
                  <p className="mt-2 text-sm font-bold text-blue-900">{secondaryCopied ? 'OneDrive confirmado' : 'Pendente'}</p>
                  <p className="mt-1 text-xs text-blue-800/70">Retenção de {Number(backupDetails.retentionDays) || 30} dias</p>
                </div>
                <div className={`border-l-4 p-3 ${recentErrorCount === 0 ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'}`}>
                  <p className="text-xs font-semibold">Erros nas últimas 24h</p>
                  <p className="mt-2 text-sm font-bold">{recentErrorCount}</p>
                  <p className="mt-1 text-xs text-[#666]">Falhas registradas pelo servidor</p>
                </div>
              </div>
              {recentErrors.length > 0 ? (
                <div className="divide-y divide-[#ECECEC] border border-[#E8E8E8]">
                  {recentErrors.map((event) => (
                    <div key={event.id} className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[150px_130px_1fr]">
                      <span className="text-[#777]">{formatTimestamp(event.createdAt)}</span>
                      <span className="font-semibold text-[#121212]">{event.source}</span>
                      <span className="min-w-0 break-words text-red-700">{event.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>
        )}

        {isAdmin && (
          <CompanyProfileSettings initialProfile={serializeCompanyProfile(companyProfile)} />
        )}

        {isAdmin && (
          <UserManagementSettings
            initialUsers={managedUsers.flatMap((managedUser) => (
              managedUser.role === 'ADMIN' || managedUser.role === 'MANAGER' || managedUser.role === 'VIEWER'
                ? [{
                    ...managedUser,
                    role: managedUser.role,
                    lastLoginAt: managedUser.lastLoginAt?.toISOString() || null,
                    createdAt: managedUser.createdAt.toISOString(),
                  }]
                : []
            ))}
          />
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
