import Link from 'next/link'
import { ArrowRight, CircleDollarSign } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'

type ProfitabilityBucket = {
  label: string
  revenue: number
  estimatedCost: number
  actualCost: number
  profit: number
  margin: number
  projects: number
}

export type ProfitabilityData = {
  projects: Array<{
    id: string
    name: string
    clientName: string
    revenue: number
    estimatedCost: number
    actualCost: number
    profit: number
    margin: number
    hasActualCosts: boolean
  }>
  byEnvironment: ProfitabilityBucket[]
  byFurniture: ProfitabilityBucket[]
  totalProjects: number
  actualCostProjects: number
}

function marginClass(value: number) {
  if (value < 0) return 'text-red-600'
  if (value < 25) return 'text-amber-700'
  return 'text-emerald-700'
}

function BucketList({ title, rows }: { title: string; rows: ProfitabilityBucket[] }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-[#6B7280]">{title}</h3>
        <span className="text-[11px] text-[#9E9E9E]">Custo ajustado distribuído</span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-[#FAFAFA] px-3 py-5 text-center text-xs text-[#9E9E9E]">
          Nenhum item de orçamento vinculado neste período.
        </p>
      ) : (
        <div className="divide-y divide-[#F0F0F0] border-y border-[#F0F0F0]">
          {rows.slice(0, 6).map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#121212]">{row.label}</p>
                <p className="text-[11px] text-[#9E9E9E]">
                  {row.projects} projeto{row.projects !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-[#121212]">{formatCurrency(row.revenue)}</p>
                <p className="text-[10px] text-[#9E9E9E]">vendido</p>
              </div>
              <div className="w-16 text-right">
                <p className={cn('text-xs font-bold', marginClass(row.margin))}>{row.margin}%</p>
                <p className="text-[10px] text-[#9E9E9E]">{formatCurrency(row.profit)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function ProfitabilityReport({ data }: { data: ProfitabilityData }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CircleDollarSign size={18} className="text-[#FF6B00]" />
            <div>
              <h2 className="text-sm font-semibold text-[#121212]">Rentabilidade real</h2>
              <p className="mt-0.5 text-xs text-[#9E9E9E]">
                Valor vendido comparado aos materiais e despesas registrados.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#6B7280]">
            {data.actualCostProjects}/{data.totalProjects} projetos com custo real
          </span>
        </div>
      </CardHeader>
      <CardBody>
        {data.projects.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#9E9E9E]">Nenhum projeto vendido neste período.</p>
        ) : (
          <div className="grid gap-7 xl:grid-cols-[1.15fr_0.85fr]">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-[#6B7280]">Projetos do período</h3>
              <div className="divide-y divide-[#F0F0F0] border-y border-[#F0F0F0]">
                {data.projects.slice(0, 8).map((project) => (
                  <Link
                    key={project.id}
                    href={`/dashboard/projects/${project.id}`}
                    className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#121212] group-hover:text-[#FF6B00]">
                        {project.name}
                      </p>
                      <p className="truncate text-[11px] text-[#9E9E9E]">
                        {project.clientName} · {project.hasActualCosts ? 'custo real informado' : 'somente custo previsto'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-[#121212]">{formatCurrency(project.profit)}</p>
                      <p className="text-[10px] text-[#9E9E9E]">
                        custo {formatCurrency(project.actualCost)}
                      </p>
                    </div>
                    <div className="flex w-16 items-center justify-end gap-1">
                      <span className={cn('text-xs font-bold', marginClass(project.margin))}>{project.margin}%</span>
                      <ArrowRight size={12} className="text-[#BDBDBD] group-hover:text-[#FF6B00]" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
            <div className="space-y-7">
              <BucketList title="Por ambiente" rows={data.byEnvironment} />
              <BucketList title="Por tipo de móvel" rows={data.byFurniture} />
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
