'use client'

import { RefreshCw } from 'lucide-react'

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-[#F5F5F5] p-6">
      <div className="max-w-sm text-center">
        <p className="text-lg font-bold text-[#121212]">Não foi possível carregar esta tela</p>
        <p className="mt-2 text-sm leading-6 text-[#777]">Atualize a página ou tente novamente em alguns instantes.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#FF6B00] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#E05A00]"
        >
          <RefreshCw size={16} />
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
