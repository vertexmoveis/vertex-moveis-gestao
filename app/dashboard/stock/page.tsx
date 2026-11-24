import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { WorkshopStockBoard } from '@/components/purchases/workshop-stock-board'
import { authOptions } from '@/lib/auth'

export default async function StockPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string; name?: string } | undefined
  if (user?.role !== 'ADMIN') redirect('/dashboard')

  return (
    <div className="flex h-full flex-col">
      <Header title="Estoque" userName={user.name || ''} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <WorkshopStockBoard />
      </div>
    </div>
  )
}
