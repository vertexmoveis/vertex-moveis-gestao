import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { CalendarDays, CheckCircle2, Clock3, MapPin, PackageCheck } from 'lucide-react'
import { prisma } from '@/lib/db'
import { formatDateOnly } from '@/lib/date-only'
import { hashProjectPortalToken } from '@/lib/project-portal'
import {
  normalizeProductionStage,
  PRODUCTION_STAGE_FLOW,
  PRODUCTION_STAGE_LABELS,
  PROJECT_ENVIRONMENT_STATUS_LABELS,
  type ProductionStage,
  type ProjectEnvironmentStatus,
} from '@/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Acompanhe seu projeto | Vertex Móveis',
  robots: { index: false, follow: false },
}

function safeStage(value: string): ProductionStage {
  return PRODUCTION_STAGE_FLOW.includes(value as ProductionStage)
    ? normalizeProductionStage(value as ProductionStage)
    : 'PENDING_START'
}

function statusTone(status: ProjectEnvironmentStatus) {
  if (status === 'COMPLETED' || status === 'INSTALLED') return 'bg-emerald-50 text-emerald-700'
  if (status === 'READY') return 'bg-blue-50 text-blue-700'
  if (status === 'IN_PROGRESS') return 'bg-orange-50 text-orange-700'
  return 'bg-[#F5F5F5] text-[#666]'
}

export default async function ProjectTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 32 || token.length > 100) notFound()

  const access = await prisma.projectPortalAccess.findFirst({
    where: {
      tokenHash: hashProjectPortalToken(token),
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      project: { archivedAt: null },
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          room: true,
          stage: true,
          deliveryDeadlineDate: true,
          estimatedEndDate: true,
          actualEndDate: true,
          updatedAt: true,
          client: { select: { name: true } },
          environments: {
            orderBy: { position: 'asc' },
            select: { id: true, name: true, status: true },
          },
          installationSchedules: {
            where: { status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] } },
            orderBy: { scheduledStart: 'asc' },
            take: 1,
            select: { scheduledStart: true, status: true },
          },
        },
      },
    },
  })
  if (!access) notFound()

  await prisma.projectPortalAccess.update({
    where: { id: access.id },
    data: { lastViewedAt: new Date() },
  }).catch(() => undefined)

  const project = access.project
  const stage = safeStage(project.stage)
  const stageIndex = PRODUCTION_STAGE_FLOW.indexOf(stage)
  const completedEnvironments = project.environments.filter((environment) => (
    environment.status === 'COMPLETED' || environment.status === 'INSTALLED'
  )).length
  const progress = project.environments.length > 0
    ? Math.round((completedEnvironments / project.environments.length) * 100)
    : Math.round((Math.max(stageIndex, 0) / (PRODUCTION_STAGE_FLOW.length - 1)) * 100)
  const deadline = project.deliveryDeadlineDate || project.estimatedEndDate
  const installation = project.installationSchedules[0]

  return (
    <main className="min-h-screen bg-[#F4F4F2] text-[#121212]">
      <header className="border-b border-[#E4E4E4] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/vertex-symbol.png" alt="Vertex Móveis" width={54} height={38} priority className="h-auto w-11" />
            <div>
              <p className="text-sm font-extrabold">Vertex Móveis</p>
              <p className="text-xs text-[#777]">Acompanhamento do projeto</p>
            </div>
          </div>
          <span className="text-xs text-[#777]">Atualizado em {formatDateOnly(project.updatedAt)}</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
        <section className="border-l-4 border-[#FF6B00] bg-white px-5 py-6 sm:px-7">
          <p className="text-xs font-bold uppercase text-[#FF6B00]">Olá, {project.client.name}</p>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{project.name}</h1>
          <p className="mt-2 text-sm leading-6 text-[#666]">
            Aqui você acompanha o andamento do seu móvel planejado até a instalação.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="bg-white p-4">
            <div className="flex items-center gap-2 text-[#777]"><Clock3 size={16} /><span className="text-xs font-semibold">Etapa atual</span></div>
            <p className="mt-3 text-base font-extrabold">{PRODUCTION_STAGE_LABELS[stage]}</p>
          </div>
          <div className="bg-white p-4">
            <div className="flex items-center gap-2 text-[#777]"><CalendarDays size={16} /><span className="text-xs font-semibold">Previsão</span></div>
            <p className="mt-3 text-base font-extrabold">{deadline ? formatDateOnly(deadline) : 'A confirmar'}</p>
          </div>
          <div className="bg-white p-4">
            <div className="flex items-center gap-2 text-[#777]"><PackageCheck size={16} /><span className="text-xs font-semibold">Progresso</span></div>
            <p className="mt-3 text-base font-extrabold">{progress}%</p>
          </div>
        </section>

        <section className="bg-white p-5 sm:p-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold">Andamento geral</h2>
              <p className="mt-1 text-xs text-[#777]">As etapas são atualizadas pela equipe da Vertex</p>
            </div>
            <strong className="text-sm text-[#FF6B00]">{progress}%</strong>
          </div>
          <div className="mt-4 h-2 overflow-hidden bg-[#ECECEC]">
            <div className="h-full bg-[#FF6B00]" style={{ width: `${progress}%` }} />
          </div>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {PRODUCTION_STAGE_FLOW.map((flowStage, index) => {
              const completed = index < stageIndex || stage === 'COMPLETED'
              const current = index === stageIndex && stage !== 'COMPLETED'
              return (
                <li key={flowStage} className={`flex items-center gap-2 border px-3 py-3 text-xs font-semibold ${current ? 'border-[#FF6B00] bg-[#FFF7F1] text-[#B84A00]' : completed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#E8E8E8] text-[#888]'}`}>
                  {completed ? <CheckCircle2 size={15} /> : <span className={`h-2.5 w-2.5 rounded-full ${current ? 'bg-[#FF6B00]' : 'bg-[#D9D9D9]'}`} />}
                  {PRODUCTION_STAGE_LABELS[flowStage]}
                </li>
              )
            })}
          </ol>
        </section>

        {project.environments.length > 0 ? (
          <section className="bg-white p-5 sm:p-7">
            <h2 className="text-base font-extrabold">Ambientes</h2>
            <div className="mt-4 divide-y divide-[#ECECEC] border border-[#E8E8E8]">
              {project.environments.map((environment) => {
                const status = environment.status as ProjectEnvironmentStatus
                return (
                  <div key={environment.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <p className="min-w-0 truncate text-sm font-semibold">{environment.name}</p>
                    <span className={`shrink-0 px-2 py-1 text-xs font-semibold ${statusTone(status)}`}>
                      {PROJECT_ENVIRONMENT_STATUS_LABELS[status] || 'Em andamento'}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        {installation ? (
          <section className="border-l-4 border-emerald-500 bg-white p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <MapPin size={20} className="mt-0.5 text-emerald-600" />
              <div>
                <h2 className="text-base font-extrabold">Instalação agendada</h2>
                <p className="mt-2 text-sm text-[#555]">
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                    timeZone: 'America/Sao_Paulo',
                  }).format(installation.scheduledStart)}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {project.actualEndDate ? (
          <section className="border-l-4 border-emerald-500 bg-emerald-50 p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={22} className="text-emerald-600" />
              <div>
                <h2 className="text-base font-extrabold text-emerald-900">Projeto concluído</h2>
                <p className="mt-1 text-sm text-emerald-800">Finalizado em {formatDateOnly(project.actualEndDate)}.</p>
              </div>
            </div>
          </section>
        ) : null}

        <footer className="py-4 text-center text-xs text-[#888]">
          Este link é pessoal. Em caso de dúvida, fale diretamente com a Vertex Móveis.
        </footer>
      </div>
    </main>
  )
}
