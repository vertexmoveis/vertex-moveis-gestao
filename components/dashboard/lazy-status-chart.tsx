'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import type { ProjectStatus } from '@/types'

type StatusChartData = {
  status: ProjectStatus
  count: number
  label: string
  color: string
}

const DeferredStatusChart = dynamic(
  () => import('@/components/dashboard/status-chart').then((module) => module.StatusChart),
  { ssr: false }
)

export function LazyStatusChart({ data }: { data: StatusChartData[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = containerRef.current
    if (!element || visible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '200px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [visible])

  return (
    <div ref={containerRef} className="min-h-[220px]">
      {visible ? (
        <DeferredStatusChart data={data} />
      ) : (
        <div className="flex h-[220px] items-center justify-center">
          <div className="h-32 w-32 animate-pulse rounded-full border-[22px] border-[#F0F0F0]" />
        </div>
      )}
    </div>
  )
}
