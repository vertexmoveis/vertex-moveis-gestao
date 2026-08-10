'use client'

import { ExternalLink, FileText } from 'lucide-react'
import { trackPublicQuotePdf } from '@/lib/public-quote-engagement'

export function PublicQuotePdfLink({
  token,
  href,
  label,
  ariaLabel,
}: {
  token: string
  href: string
  label: string
  ariaLabel: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
      onClick={() => trackPublicQuotePdf(token)}
      className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-lg bg-[#FF6B00] px-5 py-3 text-center text-base font-bold text-white shadow-sm transition-colors hover:bg-[#E85F00] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFB780] sm:text-lg"
    >
      <FileText size={22} className="shrink-0" />
      <span>{label}</span>
      <ExternalLink size={18} className="shrink-0" />
    </a>
  )
}
