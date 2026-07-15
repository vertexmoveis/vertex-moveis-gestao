'use client'

import { useState } from 'react'
import { DatabaseBackup } from 'lucide-react'
import { Button } from '@/components/ui/button'

type BackupResult = {
  success?: boolean
  fileName?: string
  secondaryPath?: string | null
  retentionDays?: number
  verified?: boolean
  restoreTested?: boolean
  removed?: number
  error?: string
}

export function BackupButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const createBackup = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/backup', { method: 'POST' })
      const data = (await response.json()) as BackupResult

      if (!response.ok) {
        setMessage(data.error || 'Não foi possível criar o backup.')
        return
      }

      const details = [
        `Backup criado: ${data.fileName}`,
        data.verified ? 'verificado' : '',
        data.restoreTested ? 'restauração testada' : '',
        data.secondaryPath ? 'cópia secundária criada' : '',
      ].filter(Boolean)
      setMessage(`${details.join(' · ')}${data.removed ? ` · ${data.removed} antigo(s) removido(s)` : ''}`)
    } catch {
      setMessage('Não foi possível criar o backup.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-[#121212]">Backup seguro do banco</p>
        <p className="text-xs text-[#9E9E9E]">Cria uma cópia consistente do SQLite, testa a restauração e guarda 30 dias.</p>
        <p className="mt-1 text-xs text-[#9E9E9E]">Uma segunda cópia é criada quando BACKUP_SECONDARY_DIR estiver configurado.</p>
        {message && <p className="mt-2 text-xs font-medium text-[#FF6B00]">{message}</p>}
      </div>
      <Button type="button" variant="outline" loading={loading} onClick={createBackup}>
        <DatabaseBackup size={15} />
        Fazer backup
      </Button>
    </div>
  )
}
