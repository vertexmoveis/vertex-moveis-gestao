import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { Header } from '@/components/layout/header'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getProjectFinancialReadiness, getProjectContractReadiness } from '@/lib/project-workflow'
import { technicalApprovalReady } from '@/lib/technical-approval'

export default async function ClosingsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [session, params] = await Promise.all([getServerSession(authOptions), searchParams])
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) return null
  const page = Math.max(1, Number.parseInt(params.page || '1') || 1)
  const quoteScope = { archivedAt: null, status: 'APPROVED', convertedProjectId: null, ...(user.role === 'ADMIN' ? {} : { createdById: user.id }) }
  const projectScope = { archivedAt: null, stage: { in: ['PENDING_START', 'MEASUREMENT', 'DESIGN', 'PROJECT_READY'] }, ...(user.role === 'ADMIN' ? {} : { managerId: user.id }) }
  const [quotes, projects, quoteCount, projectCount] = await Promise.all([
    prisma.quote.findMany({ where: quoteScope, orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 20,
      select: { id: true, title: true, variationName: true, total: true, approvedAt: true, client: { select: { name: true } } },
    }),
    prisma.project.findMany({ where: projectScope, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 20,
      include: { client: { select: { name: true } }, manager: { select: { name: true } },
        files: { select: { id: true, category: true, securityStatus: true, expiresAt: true } },
        payments: { select: { type: true, amount: true, dueDate: true, paidAt: true } },
        contracts: { orderBy: { version: 'desc' }, take: 1, select: { status: true, expiresAt: true, signedAt: true } },
      },
    }),
    prisma.quote.count({ where: quoteScope }), prisma.project.count({ where: projectScope }),
  ])
  return <div className="flex h-full flex-col">
    <Header title="Fechamentos" subtitle="Propostas aceitas e vendas em preparação" />
    <div className="space-y-5 p-4 md:p-6">
      <nav aria-label="Orçamentos" className="flex flex-wrap gap-3 text-sm font-semibold"><Link className="rounded-lg border bg-white px-4 py-2" href="/dashboard/quotes/requests">Solicitações</Link><Link className="rounded-lg border bg-white px-4 py-2" href="/dashboard/quotes">Propostas</Link><span aria-current="page" className="rounded-lg bg-orange-100 px-4 py-2 text-orange-900">Fechamentos</span></nav>
      <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border bg-white p-5"><p className="text-sm text-[#666]">Propostas aceitas para formalizar</p><p className="mt-2 text-3xl font-bold">{quoteCount}</p></div><div className="rounded-xl border bg-white p-5"><p className="text-sm text-[#666]">Projetos em preparação</p><p className="mt-2 text-3xl font-bold">{projectCount}</p></div></div>
      <p className="text-sm text-[#666]">A negociação continua na Konekto. Confira a opção aceita e registre a venda. Contrato, recebimento e aprovação técnica são acompanhados separadamente.</p>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-3"><h2 className="font-bold">Prontos para registrar a venda</h2>{quotes.length === 0 && <p className="rounded-xl border bg-white p-5 text-sm text-[#666]">Nenhuma proposta aceita nesta página.</p>}{quotes.map(quote => <Link href={`/dashboard/quotes/${quote.id}`} key={quote.id} className="block space-y-2 rounded-xl border bg-white p-5 hover:border-orange-400"><p className="font-semibold">{quote.title}</p><p className="text-sm text-[#666]">{quote.client.name} · {quote.variationName}</p><p className="font-bold">{formatCurrency(Number(quote.total))}</p><p className="text-xs text-[#777]">Aceite: {quote.approvedAt ? formatDate(quote.approvedAt) : 'a conferir'}</p><p className="text-sm font-semibold text-orange-700">Conferir proposta e fechar venda →</p></Link>)}</section>
        <section className="space-y-3"><h2 className="font-bold">Acompanhar a preparação</h2>{projects.length === 0 && <p className="rounded-xl border bg-white p-5 text-sm text-[#666]">Nenhum projeto em preparação nesta página.</p>}{projects.map(project => {
          const financial = getProjectFinancialReadiness(project)
          const latest = project.contracts[0]
          const contractStatus = latest?.expiresAt && latest.expiresAt < new Date() && !latest.signedAt ? 'EXPIRED' : latest?.status || 'NONE'
          const contract = getProjectContractReadiness({ createdAt: project.createdAt, requirement: project.contractRequirement as 'REQUIRED' | 'OPTIONAL_LEGACY' | 'WAIVED', contractStatus: contractStatus as 'NONE' | 'DRAFT' | 'SENT' | 'SIGNED' | 'VOID' | 'EXPIRED', revisionRequiredAt: project.contractRevisionRequiredAt, waivedReason: project.contractWaivedReason })
          const technical = technicalApprovalReady(project)
          const pending = [!financial.ready && financial.label, !contract.ready && contract.label, !technical && 'Aprovação técnica pendente', project.productionBlockedAt && project.productionBlockReason].filter(Boolean)
          return <Link href={`/dashboard/projects/${project.id}`} key={project.id} className="block space-y-2 rounded-xl border bg-white p-5 hover:border-orange-400"><p className="font-semibold">{project.name}</p><p className="text-sm text-[#666]">{project.client.name} · {project.manager?.name || 'Responsável a definir'}</p><div className="flex flex-wrap gap-2">{pending.map((label, index) => <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-900" key={index}>{label}</span>)}</div><p className="text-xs text-[#666]">{project.deliveryDeadlineDate ? `Prazo registrado: ${formatDate(project.deliveryDeadlineDate)}` : 'Prazo aguardando o marco de início'}</p><p className="text-sm font-semibold text-orange-700">{pending.length ? 'Resolver pendências' : 'Conferir preparação e liberar produção'} →</p></Link>
        })}</section>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><Link href="/dashboard/sales/history" className="text-[#666] underline">Consultar indicadores comerciais anteriores</Link><div className="flex gap-4">{page > 1 && <Link href={`/dashboard/sales?page=${page - 1}`}>← Anterior</Link>}<span>Página {page}</span>{page * 20 < Math.max(quoteCount, projectCount) && <Link href={`/dashboard/sales?page=${page + 1}`}>Próxima →</Link>}</div></div>
    </div>
  </div>
}
