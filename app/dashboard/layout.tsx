import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || !(session.user as { id?: string } | undefined)?.id) redirect('/login')

  return (
    <div className="fixed inset-0 flex min-h-[100dvh] overflow-clip bg-[#F5F5F5] print:static print:h-auto print:min-h-screen print:overflow-visible">
      <Sidebar
        userName={session.user?.name || ''}
        userEmail={session.user?.email || ''}
        userRole={(session.user as { role?: string })?.role || ''}
      />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-none print:overflow-visible">
        {children}
      </main>
    </div>
  )
}
