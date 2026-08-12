import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { AlertTriangle, ExternalLink, Headphones, MessageSquareText, Star } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PostSaleReviewButton } from '@/components/post-sale/post-sale-review-button'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatDateOnly } from '@/lib/date-only'
import { COMPANY_PROFILE_ID, serializeCompanyProfile } from '@/lib/company-profile'
import { buildPostSaleWhatsAppHref, resolveGoogleReviewUrl } from '@/lib/post-sale-message'
import type { Prisma } from '@prisma/client'

type SessionUser = { id?: string; role?: string }

function stars(value: number | null) {
  return value ? `${'★'.repeat(value)}${'☆'.repeat(5 - value)}` : 'Sem avaliação'
}

export default async function PostSalePage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const session = await getServerSession(authOptions)
  const user = (session?.user || {}) as SessionUser
  const { filter, page: pageParam } = await searchParams
  const projectScope = user.role === 'ADMIN' ? {} : { managerId: user.id || '__sem_usuario__' }
  const attentionOnly = filter === 'attention'
  const page = Math.max(1, Number.parseInt(pageParam || '1', 10) || 1)
  const pageSize = 30
  const projectWhere: Prisma.ProjectWhereInput = {
    ...projectScope,
    archivedAt: null,
    ...(attentionOnly ? { satisfactionRating: { lte: 2 } } : {
      OR: [
        { stage: 'COMPLETED' },
        { warrantyTickets: { some: { status: { notIn: ['RESOLVED', 'CANCELED'] } } } },
        { satisfactionRespondedAt: { not: null } },
      ],
    }),
  }
  const now = new Date()
  const [projects, projectTotal, openTickets, overdueTickets, pendingFollowUps, storedCompany] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        actualEndDate: true,
        postSaleFollowUpAt: true,
        postSaleContactedAt: true,
        warrantyEndsAt: true,
        satisfactionRating: true,
        satisfactionComment: true,
        client: { select: { name: true, whatsapp: true, phone: true } },
        warrantyTickets: {
          where: { status: { notIn: ['RESOLVED', 'CANCELED'] } },
          select: { id: true, dueAt: true },
        },
      },
      orderBy: [{ satisfactionRespondedAt: 'desc' }, { actualEndDate: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.project.count({ where: projectWhere }),
    prisma.warrantyTicket.count({ where: { status: { notIn: ['RESOLVED', 'CANCELED'] }, project: { ...projectScope, archivedAt: null } } }),
    prisma.warrantyTicket.count({ where: { status: { notIn: ['RESOLVED', 'CANCELED'] }, dueAt: { lt: now }, project: { ...projectScope, archivedAt: null } } }),
    prisma.project.count({ where: { ...projectScope, archivedAt: null, stage: 'COMPLETED', postSaleFollowUpAt: { lte: new Date() }, postSaleContactedAt: null } }),
    prisma.companyProfile.findUnique({ where: { id: COMPANY_PROFILE_ID } }),
  ])
  const company = serializeCompanyProfile(storedCompany)
  const googleReviewUrl = resolveGoogleReviewUrl(company)
  const rated = projects.filter((project) => project.satisfactionRating)
  const average = rated.length ? rated.reduce((sum, project) => sum + (project.satisfactionRating || 0), 0) / rated.length : 0
  const totalPages = Math.max(1, Math.ceil(projectTotal / pageSize))
  const pageHref = (target: number) => `/dashboard/post-sale?${new URLSearchParams({ ...(attentionOnly ? { filter: 'attention' } : {}), page: String(target) })}`

  return (
    <>
      <Header title="Pós-venda" subtitle="Acompanhamento, satisfação e assistência depois da instalação" />
      <main className="space-y-5 p-4 sm:p-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Headphones} label="Assistências abertas" value={openTickets} tone="orange" />
          <Metric icon={MessageSquareText} label="Retornos pendentes" value={pendingFollowUps} tone="blue" />
          <Metric icon={AlertTriangle} label="Garantias vencidas" value={overdueTickets} tone="red" />
          <Metric icon={Star} label="Média de satisfação" value={rated.length ? average.toFixed(1).replace('.', ',') : '-'} tone="green" />
        </section>

        <section className="overflow-hidden border border-[#E2E2E2] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E8E8] px-5 py-4">
            <div>
              <h2 className="text-sm font-bold">Clientes após a entrega</h2>
              <p className="mt-1 text-xs text-[#777]">Envie a mensagem pronta e peça a avaliação no Google.</p>
            </div>
            <div className="flex gap-2 text-xs font-semibold">
              <Link href="/dashboard/post-sale" className={`border px-3 py-2 ${!attentionOnly ? 'border-[#FF6B00] text-[#B84A00]' : 'border-[#DDD] text-[#666]'}`}>Todos</Link>
              <Link href="/dashboard/post-sale?filter=attention" className={`border px-3 py-2 ${attentionOnly ? 'border-red-400 text-red-700' : 'border-[#DDD] text-[#666]'}`}>Precisa de atenção</Link>
            </div>
          </div>
          {projects.length ? (
            <div className="divide-y divide-[#ECECEC]">
              {projects.map((project) => {
                const needsFollowUp = Boolean(project.postSaleFollowUpAt && !project.postSaleContactedAt && project.postSaleFollowUpAt <= new Date())
                const phone = project.client.whatsapp || project.client.phone || ''
                const postSaleHref = buildPostSaleWhatsAppHref({
                  phone,
                  clientName: project.client.name,
                  projectName: project.name,
                  companyName: company.tradeName,
                  googleReviewUrl,
                })
                return (
                  <div key={project.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(220px,1.4fr)_160px_180px_minmax(180px,1fr)_auto] lg:items-center">
                    <div><Link href={`/dashboard/projects/${project.id}`} className="text-sm font-bold hover:text-[#FF6B00]">{project.name}</Link><p className="mt-1 text-xs text-[#777]">{project.client.name}</p></div>
                    <div className="text-xs"><p className="text-[#888]">Entrega</p><p className="mt-1 font-semibold">{project.actualEndDate ? formatDateOnly(project.actualEndDate) : 'Não registrada'}</p></div>
                    <div className="text-xs"><p className="text-[#888]">Satisfação</p><p className={`mt-1 font-bold ${project.satisfactionRating && project.satisfactionRating <= 2 ? 'text-red-600' : 'text-emerald-700'}`}>{stars(project.satisfactionRating)}</p></div>
                    <div className="text-xs">
                      <p className="font-semibold">
                        {project.warrantyTickets.length
                          ? `${project.warrantyTickets.length} assistência(s) aberta(s)`
                          : project.postSaleContactedAt
                            ? `Contato realizado em ${formatDateOnly(project.postSaleContactedAt)}`
                            : needsFollowUp
                              ? 'Retorno pós-venda pendente'
                              : 'Acompanhamento em dia'}
                      </p>
                      {project.satisfactionComment ? <p className="mt-1 line-clamp-2 text-[#777]">“{project.satisfactionComment}”</p> : null}
                    </div>
                    <div className="flex gap-2">
                      {postSaleHref ? (
                        <PostSaleReviewButton
                          projectId={project.id}
                          href={postSaleHref}
                          contacted={Boolean(project.postSaleContactedAt)}
                        />
                      ) : null}
                      <Link href={`/dashboard/projects/${project.id}`} className="bg-[#121212] px-3 py-2 text-xs font-semibold text-white">Abrir</Link>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <p className="px-5 py-12 text-center text-sm text-[#888]">Nenhum cliente neste filtro.</p>}
          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-[#E8E8E8] px-5 py-4 text-xs">
              <p className="text-[#777]">Página {page} de {totalPages} · {projectTotal} clientes</p>
              <div className="flex gap-2">
                {page > 1 ? <Link href={pageHref(page - 1)} className="border border-[#D9D9D9] px-3 py-2 font-semibold">Anterior</Link> : null}
                {page < totalPages ? <Link href={pageHref(page + 1)} className="border border-[#D9D9D9] px-3 py-2 font-semibold">Próxima</Link> : null}
              </div>
            </div>
          ) : null}
        </section>
        <section className="flex flex-wrap items-center justify-between gap-3 border border-[#E2E2E2] bg-white px-5 py-4 text-xs">
          <div>
            <p className="font-semibold">Link usado na mensagem de avaliação</p>
            <p className="mt-1 text-[#777]">{company.googleReviewUrl ? 'Link direto do Google configurado.' : 'Usando a busca da Vertex no Google até o link direto ser configurado.'}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={googleReviewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-[#D9D9D9] px-3 py-2 font-semibold">
              Conferir link <ExternalLink size={13} />
            </a>
            <Link href="/dashboard/settings" className="bg-[#121212] px-3 py-2 font-semibold text-white">Configurar</Link>
          </div>
        </section>
      </main>
    </>
  )
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Star; label: string; value: string | number; tone: 'orange' | 'blue' | 'red' | 'green' }) {
  const tones = { orange: 'bg-orange-50 text-orange-700', blue: 'bg-blue-50 text-blue-700', red: 'bg-red-50 text-red-700', green: 'bg-emerald-50 text-emerald-700' }
  return <div className="flex items-center justify-between border border-[#E2E2E2] bg-white p-4"><div><p className="text-xs font-semibold text-[#888]">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p></div><div className={`grid h-10 w-10 place-items-center ${tones[tone]}`}><Icon size={19} /></div></div>
}
