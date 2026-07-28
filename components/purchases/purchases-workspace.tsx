'use client'

import { useState } from 'react'
import { Boxes, ShoppingCart } from 'lucide-react'
import { InventoryBoard } from './inventory-board'
import { PurchasesBoard, type PurchaseMaterial } from './purchases-board'

export function PurchasesWorkspace({
  initialMaterials,
  limited,
}: {
  initialMaterials: PurchaseMaterial[]
  limited: boolean
}) {
  const [tab, setTab] = useState<'purchases' | 'inventory'>('purchases')

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg border border-[#D9D9D9] bg-white p-1" role="tablist" aria-label="Áreas de compras">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'purchases'}
          onClick={() => setTab('purchases')}
          className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors ${tab === 'purchases' ? 'bg-[#121212] text-white' : 'text-[#555] hover:bg-[#F5F5F5]'}`}
        >
          <ShoppingCart size={14} />
          Compras dos projetos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'inventory'}
          onClick={() => setTab('inventory')}
          className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors ${tab === 'inventory' ? 'bg-[#121212] text-white' : 'text-[#555] hover:bg-[#F5F5F5]'}`}
        >
          <Boxes size={14} />
          Estoque e fornecedores
        </button>
      </div>

      <div role="tabpanel">
        {tab === 'purchases'
          ? <PurchasesBoard initialMaterials={initialMaterials} limited={limited} />
          : <InventoryBoard />}
      </div>
    </div>
  )
}
