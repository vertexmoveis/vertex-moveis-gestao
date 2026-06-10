'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, type ProjectStatus } from '@/types'

interface StatusChartProps {
  data: { status: ProjectStatus; count: number; label: string; color: string }[]
}

const RADIAN = Math.PI / 180
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number }) => {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function StatusChart({ data }: StatusChartProps) {
  const filtered = data.filter((d) => d.count > 0)

  if (filtered.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-[#9E9E9E] text-sm">
        Nenhum dado disponível
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={filtered}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="count"
          labelLine={false}
          label={renderCustomLabel}
        >
          {filtered.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [value, PROJECT_STATUS_LABELS[name as ProjectStatus] || name]}
          contentStyle={{
            background: '#fff',
            border: '1px solid #E8E8E8',
            borderRadius: '10px',
            fontSize: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}
          labelStyle={{ display: 'none' }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: '11px', color: '#121212' }}>
              {PROJECT_STATUS_LABELS[value as ProjectStatus] || value}
            </span>
          )}
          iconSize={8}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
