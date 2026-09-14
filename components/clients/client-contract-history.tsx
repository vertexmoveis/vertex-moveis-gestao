'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useJsonResource } from '@/components/use-json-resource'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

type History = { total: number; items: { id: string; title: string; createdAt: string; status: string; converted: boolean; href: string | null }[] }

const emptyHistory: History = { total: 0, items: [] }

export function ClientContractHistory({ clientId }: { clientId: string }) {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const { data, loading, error } = useJsonResource(`/api/clients/${clientId}/contracts?page=${page}`, emptyHistory, revision)
  return <section className="space-y-3 rounded-lg border border-[#E5E5E5] bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Vendas sem orçamento</h3><Link className="text-sm text-orange-700" href={`/dashboard/sales?new=1&clientId=${encodeURIComponent(clientId)}`}>Nova venda sem orçamento</Link></div>
    {error ? <p role="alert">{error} <Button variant="outline" onClick={() => setRevision(n => n + 1)}>Tentar novamente</Button></p> : loading ? <p role="status" className="text-sm text-[#777]">Carregando…</p> : data.items.length === 0 ? <p className="text-sm text-[#777]">Nenhum contrato avulso registrado.</p> : <div className="divide-y divide-[#EEE]">{data.items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-[#777]">{item.status} · {formatDate(item.createdAt)}{item.converted ? ' · Projeto criado' : ''}</p></div>{item.href && <Link className="text-sm text-orange-700" href={item.href}>{item.converted ? 'Ver projeto' : 'Continuar fechamento'}</Link>}</div>)}</div>}
    {data.total > 10 && <div className="flex items-center justify-between text-xs"><span>{data.total} contratos · página {page}</span><div className="flex gap-2"><Button variant="outline" disabled={page === 1 || loading} onClick={() => setPage(n => n - 1)}>Anterior</Button><Button variant="outline" disabled={page * 10 >= data.total || loading} onClick={() => setPage(n => n + 1)}>Próxima</Button></div></div>}
  </section>
}
