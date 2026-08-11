import Link from 'next/link'
import { Building2, Calculator, ShieldCheck, UserRound, Users, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SettingsSection = 'conta' | 'empresa' | 'orcamentos' | 'equipe' | 'sistema'

const items: ReadonlyArray<{
  key: SettingsSection
  label: string
  icon: LucideIcon
  adminOnly?: boolean
}> = [
  { key: 'conta', label: 'Minha conta', icon: UserRound },
  { key: 'empresa', label: 'Empresa', icon: Building2, adminOnly: true },
  { key: 'orcamentos', label: 'Orçamentos', icon: Calculator, adminOnly: true },
  { key: 'equipe', label: 'Equipe', icon: Users, adminOnly: true },
  { key: 'sistema', label: 'Sistema', icon: ShieldCheck, adminOnly: true },
]

export function SettingsTabs({ active, isAdmin }: { active: SettingsSection; isAdmin: boolean }) {
  return (
    <nav aria-label="Áreas das configurações" className="sticky top-0 z-20 overflow-x-auto border-b border-[#E5E5E5] bg-[#F5F5F5]/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-6xl min-w-max gap-1">
        {items.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const Icon = item.icon
          const selected = active === item.key
          return (
            <Link
              key={item.key}
              href={`/dashboard/settings?secao=${item.key}`}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                'inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors',
                selected ? 'border-[#FF6B00] text-[#121212]' : 'border-transparent text-[#777] hover:text-[#121212]',
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
