import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { WorkshopStockBoard } from '@/components/purchases/workshop-stock-board'
import { requireRole } from '@/lib/security'
import { workshopStockRoles } from '@/lib/workshop-stock'

export default async function StockPage() {
  const auth = await requireRole([...workshopStockRoles])
  if (!auth.ok) redirect('/dashboard')

  return (
    <div className="flex h-full flex-col">
      <Header title="Estoque" userName={auth.user.name || ''} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <WorkshopStockBoard />
      </div>
    </div>
  )
}
