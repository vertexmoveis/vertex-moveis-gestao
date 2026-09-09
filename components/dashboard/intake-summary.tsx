import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requestScope } from '@/lib/quote-requests'
import { toDateOnlyUtc, dateOnlyKeyInTimeZone } from '@/lib/date-only'

export async function IntakeSummary({ user }: { user: { id?: string; role?: string } }) {
  if (!user.id) return null
  const scope = requestScope({ id: user.id, role: user.role || 'VIEWER' })
  const [requests, overdue, approved] = await Promise.all([
    prisma.quoteRequest.count({ where: { ...scope, status: { notIn: ['READY', 'CANCELLED'] } } }),
    prisma.quoteRequest.count({ where: { ...scope, status: { notIn: ['READY', 'CANCELLED'] }, dueDate: { lt: toDateOnlyUtc(dateOnlyKeyInTimeZone(new Date()))! } } }),
    prisma.quote.count({ where: { archivedAt: null, status: 'APPROVED', convertedProjectId: null, ...(user.role === 'ADMIN' ? {} : { createdById: user.id }) } }),
  ])
  return <section aria-label="Orçamentos e fechamentos" className="grid gap-3 md:grid-cols-3">
    {[{ label: 'Solicitações para preparar', count: requests, href: '/dashboard/quotes/requests' }, { label: 'Orçamentos com retorno atrasado', count: overdue, href: '/dashboard/quotes/requests?overdue=1' }, { label: 'Propostas aceitas para fechar', count: approved, href: '/dashboard/sales' }].map(item => <Link key={item.href} href={item.href} className="rounded-xl border border-orange-200 bg-orange-50 p-5 hover:border-orange-500"><p className="text-sm text-orange-950">{item.label}</p><p className="mt-2 text-3xl font-bold text-orange-950">{item.count}</p></Link>)}
  </section>
}
