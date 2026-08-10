'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, MessageSquareText } from 'lucide-react'

export function PostSaleReviewButton({
  projectId,
  href,
  contacted,
}: {
  projectId: string
  href: string
  contacted: boolean
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const registerContact = async () => {
    if (contacted || saving) return
    setSaving(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/post-sale`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacted: true }),
      })
      if (response.ok) router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => void registerContact()}
      className="inline-flex items-center gap-1.5 border border-[#FF6B00] px-3 py-2 text-xs font-semibold text-[#B84A00]"
    >
      {contacted ? <Check size={14} /> : <MessageSquareText size={14} />}
      {contacted ? 'Enviar novamente' : saving ? 'Registrando...' : 'Pedir avaliação'}
    </a>
  )
}
