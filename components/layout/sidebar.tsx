'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Calendar,
  Calculator,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clientes', icon: Users },
  { href: '/dashboard/quotes', label: 'Orçamentos', icon: Calculator },
  { href: '/dashboard/projects', label: 'Projetos', icon: FolderOpen },
  { href: '/dashboard/production', label: 'Produção', icon: Kanban },
  { href: '/dashboard/calendar', label: 'Calendário', icon: Calendar },
  { href: '/dashboard/financeiro', label: 'Financeiro', icon: Wallet, adminOnly: true },
]

const bottomItems = [
  { href: '/dashboard/settings', label: 'Configurações', icon: Settings },
]

interface SidebarProps {
  userName?: string
  userEmail?: string
  userRole?: string
}

export function Sidebar({ userName, userEmail, userRole }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const expanded = !collapsed || mobileOpen

  const closeMobileMenu = () => setMobileOpen(false)

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-4 z-[60] inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8E8E8] bg-white text-[#121212] shadow-sm transition-colors hover:bg-[#F5F5F5] lg:hidden"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={closeMobileMenu}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col bg-[#121212] shadow-2xl transition-[transform,width] duration-300 ease-in-out lg:relative lg:inset-auto lg:z-auto lg:translate-x-0 lg:shadow-none',
          mobileOpen && 'translate-x-0',
          collapsed ? 'lg:w-16' : 'lg:w-60'
        )}
      >
        <div className={cn('flex items-center gap-3 border-b border-white/10 px-4 py-5', !expanded && 'justify-center px-2')}>
          <div className={cn('flex shrink-0 items-center justify-center', expanded ? 'h-10 w-12' : 'h-8 w-10')}>
            <Image
              src="/vertex-symbol.png"
              alt="Vertex Móveis"
              width={64}
              height={44}
              className={cn('h-auto drop-shadow-sm', expanded ? 'w-10' : 'w-8')}
              priority
            />
          </div>
          {expanded && (
            <div className="min-w-0">
              <span className="block text-sm font-bold leading-tight text-white">Vertex</span>
              <span className="text-xs font-medium text-[#FF6B00]">Móveis</span>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Fechar menu"
          onClick={closeMobileMenu}
          className="absolute right-3 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X size={18} />
        </button>
        <button
          type="button"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          onClick={() => setCollapsed((current) => !current)}
          className="absolute right-3 top-6 z-10 hidden h-7 w-7 items-center justify-center rounded-full border border-[#D9D9D9] bg-white shadow-sm transition-colors hover:bg-[#F5F5F5] lg:flex"
        >
          {collapsed ? <ChevronRight size={12} className="text-[#121212]" /> : <ChevronLeft size={12} className="text-[#121212]" />}
        </button>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4 scrollbar-none">
          {expanded && <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-widest text-white/30">Menu</p>}
          {navItems.filter((item) => !item.adminOnly || userRole === 'ADMIN').map((item) => {
            const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                title={!expanded ? item.label : undefined}
                onClick={closeMobileMenu}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  !expanded && 'justify-center px-2',
                  isActive ? 'bg-[#FF6B00] text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon size={18} className="shrink-0" />
                {expanded && <span className="truncate">{item.label}</span>}
                {isActive && expanded && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/80" />}
              </Link>
            )
          })}
        </nav>

        <div className="space-y-0.5 border-t border-white/10 px-2 pb-4 pt-4">
          {bottomItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!expanded ? item.label : undefined}
                onClick={closeMobileMenu}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  !expanded && 'justify-center px-2',
                  isActive ? 'bg-[#FF6B00] text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon size={18} className="shrink-0" />
                {expanded && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}

          <div className={cn('mt-3 border-t border-white/10 pt-3', expanded ? 'px-1' : 'flex flex-col items-center gap-2')}>
            {expanded && (
              <div className="mb-2 px-2">
                <p className="truncate text-xs font-medium text-white">{userName}</p>
                <p className="truncate text-[10px] text-white/40">{userEmail}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              title={!expanded ? 'Sair' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400',
                !expanded && 'justify-center px-2'
              )}
            >
              <LogOut size={18} className="shrink-0" />
              {expanded && <span>Sair</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
