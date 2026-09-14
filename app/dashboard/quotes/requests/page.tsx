import { redirect } from 'next/navigation'
export default async function QuoteRequestsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const old = await searchParams
  const params = new URLSearchParams({ view:'all' })
  for (const key of ['q','status','clientId','page']) if (typeof old[key]==='string') params.set(key,old[key])
  if (old.overdue==='1') params.set('attention','late')
  if (typeof old.id==='string') params.set('requestId',old.id)
  redirect(`/dashboard/quotes?${params}`)
}
