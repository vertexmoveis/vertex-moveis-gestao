import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { ContractsWorkspace } from '@/components/contracts/contracts-workspace'
import { getServerSession } from 'next-auth'
import { Header } from '@/components/layout/header'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getProjectFinancialReadiness, getProjectContractReadiness } from '@/lib/project-workflow'
import { technicalApprovalReady } from '@/lib/technical-approval'

export default async function ClosingsPage({ searchParams }: { searchParams: Promise<{ page?: string; quoteId?: string; clientId?: string; new?: string; contractId?: string; origin?: string; situation?: string }> }) {
  const [session, params] = await Promise.all([getServerSession(authOptions), searchParams])
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) return null
  const page = Math.max(1, Number.parseInt(params.page || '1') || 1)
  const origin = params.origin === 'quote' || params.origin === 'direct' ? params.origin : ''
  const situation = params.situation === 'formalization' || params.situation === 'preparation' ? params.situation : ''
  const showQuotes = origin !== 'direct' && situation !== 'preparation'
  const showDirect = origin !== 'quote' && situation !== 'preparation'
  const showProjects = situation !== 'formalization'
  const pageHref = (nextPage: number) => { const next = new URLSearchParams(); for (const [key,value] of Object.entries(params)) if (value) next.set(key,value); next.set('page',String(nextPage)); return `/dashboard/sales?${next}` }
  const quoteScope = { ...(params.quoteId ? { id: params.quoteId } : {}), ...(params.clientId ? { clientId: params.clientId } : {}), archivedAt: null, status: 'APPROVED', convertedProjectId: null, ...(user.role === 'ADMIN' ? {} : { createdById: user.id }) }
  const projectScope: Prisma.ProjectWhereInput = { ...(origin === 'quote' ? { sourceQuote: { isNot: null } } : origin === 'direct' ? { sourceQuote: { is: null } } : {}), ...(params.clientId ? { clientId: params.clientId } : {}), archivedAt: null, stage: { in: ['PENDING_START', 'MEASUREMENT', 'DESIGN', 'PROJECT_READY'] }, ...(user.role === 'ADMIN' ? {} : { managerId: user.id }) }
  const [quotes, projects, quoteCount, projectCount] = await Promise.all([
    prisma.quote.findMany({ where: quoteScope, orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 20,
      select: { id: true, title: true, variationName: true, total: true, approvedAt: true, client: { select: { name: true } } },
    }),
    prisma.project.findMany({ where: projectScope, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 20,
      include: { sourceQuote: { select: { id: true } }, client: { select: { name: true } }, manager: { select: { name: true } },
        files: { select: { id: true, category: true, securityStatus: true, expiresAt: true } },
        payments: { select: { type: true, amount: true, dueDate: true, paidAt: true } },
        contracts: { orderBy: { version: 'desc' }, take: 1, select: { status: true, expiresAt: true, signedAt: true } },
      },
    }),
    prisma.quote.count({ where: quoteScope }), prisma.project.count({ where: projectScope }),
  ])
  return <div className="flex min-h-full flex-col">
    <Header title="Fechamentos" subtitle="Propostas aceitas e vendas em preparação" />
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-[#666]">Formalize a venda e acompanhe as pendências para iniciar o projeto.</p>
        <Link href="/dashboard/contracts" className="text-orange-700 underline">Central de contratos</Link>
      </div>
      <form className="flex flex-wrap items-end gap-3" action="/dashboard/sales">
        {params.clientId && <input type="hidden" name="clientId" value={params.clientId}/>}
        <label className="text-xs text-[#666]">Origem<select name="origin" defaultValue={origin} className="mt-1 block h-10 rounded-md border border-[#DDD] bg-white px-3 text-sm"><option value="">Todas</option><option value="quote">Orçamento aprovado</option><option value="direct">Venda sem orçamento</option></select></label>
        <label className="text-xs text-[#666]">Situação<select name="situation" defaultValue={situation} className="mt-1 block h-10 rounded-md border border-[#DDD] bg-white px-3 text-sm"><option value="">Todas</option><option value="formalization">Em formalização</option><option value="preparation">Projeto em preparação</option></select></label>
        <button className="h-10 rounded-md border border-[#DDD] bg-white px-4 text-sm" type="submit">Aplicar filtros</button>
        {!showDirect && <Link href={`/dashboard/sales?new=1${params.clientId ? `&clientId=${encodeURIComponent(params.clientId)}` : ''}`} className="ml-auto rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Venda sem orçamento</Link>}
      </form>
      {params.quoteId && <Link href="/dashboard/sales" className="inline-block text-sm text-orange-700 underline">Ver todos os fechamentos</Link>}
      {showDirect && <ContractsWorkspace key={`${params.clientId || ""}:${params.new || ""}:${params.contractId || ""}`} sales clientId={params.clientId || ''} />}
      <div className={`grid gap-5 ${showQuotes && showProjects ? "xl:grid-cols-2" : ""}`}>
        <section hidden={!showQuotes} className="space-y-3"><h2 className="font-bold">Orçamentos aprovados <span className="text-sm font-normal text-[#777]">({quoteCount})</span></h2>{quotes.length === 0 && <p className="rounded-xl border bg-white p-5 text-sm text-[#666]">Nenhuma proposta aceita nesta página.</p>}{quotes.map(quote => <Link href={`/dashboard/quotes/${quote.id}`} key={quote.id} className="block space-y-2 rounded-xl border bg-white p-5 hover:border-orange-400"><p className="font-semibold">{quote.title}</p><p className="text-sm text-[#666]">{quote.client.name} · {quote.variationName}</p><p className="font-bold">{formatCurrency(Number(quote.total))}</p><p className="text-xs text-[#777]">Aceite: {quote.approvedAt ? formatDate(quote.approvedAt) : 'a conferir'}</p><p className="text-sm font-semibold text-orange-700">Conferir proposta e fechar venda →</p></Link>)}</section>
        <section hidden={!showProjects} className="space-y-3"><h2 className="font-bold">Projetos em preparação <span className="text-sm font-normal text-[#777]">({projectCount})</span></h2>{projects.length === 0 && <p className="rounded-xl border bg-white p-5 text-sm text-[#666]">Nenhum projeto em preparação nesta página.</p>}{projects.map(project => {
          const financial = getProjectFinancialReadiness(project)
          const latest = project.contracts[0]
          const contractStatus = latest?.expiresAt && latest.expiresAt < new Date() && !latest.signedAt ? 'EXPIRED' : latest?.status || 'NONE'
          const contract = getProjectContractReadiness({ createdAt: project.createdAt, requirement: project.contractRequirement as 'REQUIRED' | 'OPTIONAL_LEGACY' | 'WAIVED', contractStatus: contractStatus as 'NONE' | 'DRAFT' | 'SENT' | 'SIGNED' | 'VOID' | 'EXPIRED', revisionRequiredAt: project.contractRevisionRequiredAt, waivedReason: project.contractWaivedReason })
          const technical = technicalApprovalReady(project)
          const pending = [!financial.ready && financial.label, !contract.ready && contract.label, !technical && 'Aprovação técnica pendente', project.productionBlockedAt && project.productionBlockReason].filter(Boolean)
          return <Link href={`/dashboard/projects/${project.id}`} key={project.id} className="block space-y-2 rounded-xl border bg-white p-5 hover:border-orange-400"><p className="font-semibold">{project.name}</p><p className="text-sm text-[#666]">{project.client.name} · {project.sourceQuote ? "Orçamento aprovado" : "Venda sem orçamento"}</p><p className="text-xs text-[#777]">{project.manager?.name || 'Responsável a definir'}</p><div className="flex flex-wrap gap-2">{pending.map((label, index) => <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-900" key={index}>{label}</span>)}</div><p className="text-xs text-[#666]">{project.deliveryDeadlineDate ? `Prazo registrado: ${formatDate(project.deliveryDeadlineDate)}` : 'Prazo aguardando o marco de início'}</p><p className="text-sm font-semibold text-orange-700">{pending.length ? 'Resolver pendências' : 'Conferir preparação e liberar produção'} →</p></Link>
        })}</section>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><Link href="/dashboard/sales/history" className="text-[#666] underline">Consultar indicadores comerciais anteriores</Link><div className="flex gap-4">{page > 1 && <Link href={pageHref(page - 1)}>← Anterior</Link>}<span>Página {page}</span>{page * 20 < Math.max(showQuotes ? quoteCount : 0, showProjects ? projectCount : 0) && <Link href={pageHref(page + 1)}>Próxima →</Link>}</div></div>
    </div>
  </div>
}
