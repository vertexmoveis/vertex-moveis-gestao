'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  Kanban,
  Calendar,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clientes', icon: Users },
  { href: '/dashboard/projects', label: 'Projetos', icon: FolderOpen },
  { href: '/dashboard/production', label: 'Produção', icon: Kanban },
  { href: '/dashboard/calendar', label: 'Calendário', icon: Calendar },
]

const bottomItems = [
  { href: '/dashboard/settings', label: 'Configurações', icon: Settings },
]

interface SidebarProps {
  userName?: string
  userEmail?: string
}

export function Sidebar({ userName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-[#121212] transition-all duration-300 ease-in-out flex-shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-white/10',
        collapsed && 'justify-center px-2'
      )}>
        <div className="w-8 h-8 bg-[#FF6B00] rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-white font-bold text-sm leading-tight block">Vertex</span>
            <span className="text-[#FF6B00] text-xs font-medium">Móveis</span>
          </div>
        )}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-white border border-[#D9D9D9] rounded-full flex items-center justify-center shadow-sm hover:bg-[#F5F5F5] transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={12} className="text-[#121212]" /> : <ChevronLeft size={12} className="text-[#121212]" />}
      </button>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto scrollbar-none">
        {!collapsed && (
          <p className="text-[10px] uppercase tracking-widest text-white/30 px-3 mb-2 font-medium">Menu</p>
        )}
        {navItems.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-[#FF6B00] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-4 space-y-0.5 border-t border-white/10 pt-4">
        {bottomItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-[#FF6B00] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}

        {/* User */}
        <div className={cn(
          'mt-3 pt-3 border-t border-white/10',
          collapsed ? 'flex flex-col items-center gap-2' : 'px-1'
        )}>
          {!collapsed && (
            <div className="px-2 mb-2">
              <p className="text-white text-xs font-medium truncate">{userName}</p>
              <p className="text-white/40 text-[10px] truncate">{userEmail}</p>
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title={collapsed ? 'Sair' : undefined}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150',
              collapsed && 'justify-center px-2'
            )}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}
