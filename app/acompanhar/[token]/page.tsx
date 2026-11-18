import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowDown, ArrowUpRight, Armchair, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3, Hammer, Layers3, MapPin, PencilRuler, ShieldCheck, Truck } from 'lucide-react'
import { prisma } from '@/lib/db'
import { formatDateOnly } from '@/lib/date-only'
import { deliveryForecastMonthLabel } from '@/lib/delivery-forecast'
import { environmentWorkflowLabel, environmentWorkflowTone, getEnvironmentWorkflowStage } from '@/lib/environment-workflow'
import { hashProjectPortalToken } from '@/lib/project-portal'
import { PublicInstallationActions } from '@/components/projects/public-installation-actions'
import { PublicProjectSupport } from '@/components/projects/public-project-support'
import { canOpenPublicWarranty, warrantyDeadline } from '@/lib/project-portal-support'
import {
  normalizeProductionStage,
  PRODUCTION_STAGE_FLOW,
  PRODUCTION_STAGE_DESCRIPTIONS,
  PRODUCTION_STAGE_LABELS,
  type ProductionStage,
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
          deliveryForecastMonth: true,
          estimatedEndDate: true,
          actualEndDate: true,
          warrantyEndsAt: true,
          satisfactionRating: true,
          updatedAt: true,
          client: { select: { name: true } },
          environments: {
            orderBy: { position: 'asc' },
            select: { id: true, name: true, status: true, workflowStage: true, updatedAt: true },
          },
          installationSchedules: {
            where: { status: { in: ['SCHEDULED', 'CONFIRMED', 'ON_ROUTE', 'IN_PROGRESS'] } },
            orderBy: { scheduledStart: 'asc' },
            take: 1,
            select: { id: true, scheduledStart: true, status: true },
          },
          warrantyTickets: {
            orderBy: { openedAt: 'desc' },
            take: 10,
            select: { id: true, title: true, status: true, openedAt: true, resolution: true },
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
  const deadline = project.deliveryDeadlineDate || project.estimatedEndDate
  const installation = project.installationSchedules[0]
  const warrantyEnd = warrantyDeadline(project)
  const lastUpdated = new Date(Math.max(project.updatedAt.getTime(), ...project.environments.map(environment => environment.updatedAt.getTime())))
  const forecast = deliveryForecastMonthLabel(project.deliveryForecastMonth) || (deadline ? formatDateOnly(deadline) : 'A confirmar')
  const phases = [
    { label: 'Projeto', icon: PencilRuler, lastStage: 'SENDING_TO_PRODUCTION' },
    { label: 'Fabricação', icon: Hammer, lastStage: 'PRODUCTION_READY' },
    { label: 'Entrega', icon: Truck, lastStage: 'INSTALLATION' },
    { label: 'Concluído', icon: CheckCircle2, lastStage: 'COMPLETED' },
  ] as const
  const currentPhase = phases.findIndex(phase => stageIndex <= PRODUCTION_STAGE_FLOW.indexOf(phase.lastStage))

  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#242820]">
      <a href="#seu-projeto" className="skip-link">Ir para o acompanhamento</a>
      <header className="border-b border-[#E8E5DE] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex items-center gap-3.5">
            <Image src="/vertex-symbol.png" alt="Vertex Móveis" width={54} height={38} priority className="h-auto w-10 sm:w-12" />
            <div>
              <p className="text-sm font-bold tracking-tight sm:text-base">Vertex Móveis</p>
              <p className="mt-0.5 text-[11px] text-[#73796C] sm:text-xs">Móveis planejados</p>
            </div>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-[#E8E5DE] px-3 py-2 text-[11px] font-medium text-[#656C5F] sm:px-4 sm:text-xs"><ShieldCheck size={14} aria-hidden="true" /><span>Área do cliente</span></span>
        </div>
      </header>

      <div id="seu-projeto" className="mx-auto max-w-6xl scroll-mt-6 space-y-6 px-4 pb-8 pt-5 sm:px-8 sm:pb-12 sm:pt-8">
        <section aria-label="Seu projeto" className="relative isolate overflow-hidden rounded-[28px] bg-[#1C211B] p-6 text-white sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-40 -z-10 h-[440px] w-[440px] rotate-[-25deg] rounded-[80px] border border-white/[0.07]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-28 -z-10 h-[440px] w-[440px] rotate-[-25deg] rounded-[80px] border border-white/[0.05]" />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-12">
            <div className="min-w-0">
              <p className="mb-7 flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D7DDCE]"><span aria-hidden="true" className="h-1.5 w-5 rounded-full bg-[#FF7B24]" />Seu projeto, de perto</p>
              <p className="break-words text-sm text-[#D1D7C9]">Olá, {project.client.name}</p>
              <h1 className="mt-2 max-w-[22ch] break-words text-3xl font-semibold leading-[1.15] tracking-tight sm:text-[42px]">{project.name}</h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-[#C0C8B7]">Cada detalhe do seu projeto, do primeiro desenho à instalação.</p>
              <div className="mt-7 flex items-start gap-3 border-t border-white/10 pt-5">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FF7B24]/15 text-[#FFAD76]"><Clock3 size={18} aria-hidden="true" /></span>
                <div><p className="text-[11px] font-medium text-[#C0C8B7]">Etapa atual do pedido</p><p className="mt-1 text-lg font-semibold text-white">{PRODUCTION_STAGE_LABELS[stage]}</p></div>
              </div>
            </div>
            <div className="flex flex-col justify-end">
              <div className="rounded-[22px] border border-white/15 bg-white/[0.06] p-5 sm:p-6">
                <div className="flex items-center gap-2.5 text-[#D7DDCE]"><CalendarDays size={18} className="text-[#FFAD76]" aria-hidden="true" /><p className="text-xs font-medium">{project.actualEndDate ? 'Entrega realizada' : 'Previsão de entrega'}</p></div>
                <p className="mt-4 text-xl font-semibold leading-8 tracking-tight sm:text-2xl">{project.actualEndDate ? formatDateOnly(project.actualEndDate) : forecast}</p>
                <p className="mt-3 text-xs leading-5 text-[#C0C8B7]">{project.actualEndDate ? 'Seu projeto foi finalizado. Obrigado por escolher a Vertex.' : project.deliveryForecastMonth ? 'O dia exato ainda será definido com você.' : deadline ? 'Acompanhe as atualizações da entrega por aqui.' : 'A equipe vai informar a previsão por aqui.'}</p>
              </div>
              {project.environments.length > 0 ? <a href="#ambientes" className="mt-4 inline-flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[#FF7B24] px-4 py-3 text-sm font-semibold text-[#1C211B] transition-colors hover:bg-[#FF964F]">Ver meus ambientes<ArrowDown size={17} aria-hidden="true" /></a> : null}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-1 text-xs text-[#687160]">
          <p className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#79866E]" />Atualizado em {formatDateOnly(lastUpdated)}</p>
          <p>Informações atualizadas pela equipe Vertex</p>
        </div>

        {project.environments.length > 0 ? (
          <section id="ambientes" aria-labelledby="ambientes-titulo" className="scroll-mt-6 rounded-3xl border border-[#E8E5DE] bg-white p-5 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A6348]">Ambiente por ambiente</p><h2 id="ambientes-titulo" className="mt-2 text-xl font-semibold tracking-tight">Ambientes</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#6D7467]">Cada espaço tem seu próprio ritmo. Veja em qual etapa está cada um.</p></div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#F4F3EE] px-3 py-2 text-xs font-medium text-[#59624F]"><Layers3 size={14} aria-hidden="true" />{completedEnvironments} de {project.environments.length} {project.environments.length === 1 ? 'ambiente concluído' : 'ambientes concluídos'}</span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {project.environments.map((environment, index) => {
                const roomStage = getEnvironmentWorkflowStage(environment)
                return (
                  <article key={environment.id} className="min-w-0 rounded-2xl border border-[#EAE7E0] bg-[#FBFAF7] p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl border border-[#E8E5DE] bg-white text-[#7C876F]"><Armchair size={20} aria-hidden="true" /></span><span aria-hidden="true" className="text-xs tabular-nums text-[#8A9282]">{String(index + 1).padStart(2, '0')}</span></div>
                    <h3 className="break-words text-base font-semibold leading-6">{environment.name}</h3>
                    <span className={`mt-3 inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${environmentWorkflowTone(environment)}`}>{roomStage === 'COMPLETED' ? <Check size={13} className="shrink-0" aria-hidden="true" /> : <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />}{environmentWorkflowLabel(environment)}</span>
                    <p className="mt-3 text-xs leading-5 text-[#6D7467]">{roomStage ? PRODUCTION_STAGE_DESCRIPTIONS[roomStage] : 'A equipe vai informar a etapa deste ambiente por aqui.'}</p>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="andamento-titulo" className="rounded-3xl border border-[#E8E5DE] bg-white p-5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A6348]">Do desenho à entrega</p><h2 id="andamento-titulo" className="mt-2 text-xl font-semibold tracking-tight">Andamento geral</h2></div>
            <span className="rounded-full border border-[#E8E5DE] px-3 py-2 text-xs font-medium text-[#687160]">Etapa {stageIndex + 1} de {PRODUCTION_STAGE_FLOW.length}</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-label="Fases do pedido">
            {phases.map((phase, index) => {
              const Icon = phase.icon
              const previous = index < currentPhase
              const current = index === currentPhase
              return <div key={phase.label} className={`rounded-2xl border p-3 sm:p-4 ${current ? 'border-[#F3B78F] bg-[#FFF3E8]' : previous ? 'border-[#DDE7D4] bg-[#F4F8F0]' : 'border-[#ECEAE4] bg-[#FAFAF7]'}`}>
                <div className={`mb-3 flex items-center justify-between ${current ? 'text-[#B24D08]' : previous ? 'text-[#587443]' : 'text-[#7C8573]'}`}><Icon size={20} aria-hidden="true" />{previous ? <Check size={14} aria-hidden="true" /> : <span className="text-[10px] font-medium">{current ? 'Agora' : 'A seguir'}</span>}</div>
                <p className="text-sm font-semibold">{phase.label}</p>
              </div>
            })}
          </div>
          <p className="mt-5 text-sm leading-6 text-[#6D7467]">{PRODUCTION_STAGE_DESCRIPTIONS[stage]}{project.environments.length > 1 ? ' Os ambientes podem estar em etapas diferentes.' : ''}</p>
          <details className="group mt-5 border-t border-[#ECE9E2] pt-2">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-2 text-sm font-semibold text-[#424C38] focus-visible:outline-offset-4 [&::-webkit-details-marker]:hidden">Ver todas as etapas<ChevronDown size={17} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
            <ol className="mt-3 grid gap-x-6 pb-2 sm:grid-cols-2">
              {PRODUCTION_STAGE_FLOW.map((flowStage, index) => {
                const previous = index < stageIndex
                const current = index === stageIndex
                return <li key={flowStage} aria-current={current ? 'step' : undefined} className={`flex items-center gap-3 border-b border-[#EFEEE8] py-3 text-xs ${current ? 'font-bold text-[#AE4905]' : previous ? 'text-[#587443]' : 'text-[#6F7866]'}`}><span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold tabular-nums ${current ? 'bg-[#FF7B24] text-[#1C211B]' : previous ? 'bg-[#EDF3E7] text-[#587443]' : 'bg-[#F0F1EC] text-[#78816F]'}`}>{previous || (current && stage === 'COMPLETED') ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</span><span>{PRODUCTION_STAGE_LABELS[flowStage]}</span>{current ? <span className="ml-auto rounded-full bg-[#FFF0E2] px-2 py-1 text-[10px] font-medium">Atual</span> : null}</li>
              })}
            </ol>
          </details>
        </section>

        {installation ? (
          <section className="rounded-3xl border border-[#DCE7D4] bg-[#F8FBF5] p-5 sm:p-8">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#E8F1E0] text-[#587443]"><MapPin size={20} aria-hidden="true" /></span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Instalação agendada</h2>
                <p className="mt-2 text-sm text-[#555]">
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                    timeZone: 'America/Sao_Paulo',
                  }).format(installation.scheduledStart)}
                </p>
              </div>
            </div>
            <PublicInstallationActions token={token} status={installation.status} />
          </section>
        ) : null}

        {project.actualEndDate ? (
          <section className="rounded-3xl border border-[#DCE7D4] bg-[#F1F7EB] p-5 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#E0EDD5] text-[#4D7133]"><CheckCircle2 size={24} aria-hidden="true" /></span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[#3F5E2B]">Projeto concluído</h2>
                <p className="mt-1 text-sm leading-6 text-[#587443]">Finalizado em {formatDateOnly(project.actualEndDate)}. Agora é hora de aproveitar seu novo espaço.</p>
              </div>
            </div>
          </section>
        ) : null}

        <PublicProjectSupport
          token={token}
          canOpenWarranty={canOpenPublicWarranty(project)}
          warrantyLabel={warrantyEnd ? `Garantia até ${formatDateOnly(warrantyEnd)}` : null}
          tickets={project.warrantyTickets.map((ticket) => ({
            ...ticket,
            openedAt: ticket.openedAt.toISOString(),
          })) as Parameters<typeof PublicProjectSupport>[0]['tickets']}
          canRate={Boolean(project.actualEndDate && !project.satisfactionRating)}
          satisfactionRating={project.satisfactionRating}
        />

        <footer className="flex flex-col items-center gap-3 px-4 pb-2 pt-4 text-center text-xs leading-5 text-[#687160]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#424C38]">Feito com cuidado, pela Vertex<ArrowUpRight size={13} aria-hidden="true" /></span>
          <p className="max-w-md">Este link é pessoal. Em caso de dúvida, fale diretamente com a Vertex Móveis.</p>
        </footer>
      </div>
    </main>
  )
}
