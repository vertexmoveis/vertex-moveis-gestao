'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { technicalFileSnapshot, technicalApprovalReady, type TechnicalFile } from '@/lib/technical-approval'
import { dateOnlyKeyInTimeZone } from '@/lib/date-only'

type Props = { projectId: string; files: (TechnicalFile & { name?: string })[]; workflowVersion: number;
  approvalDate?: string | null; technicalApprovedAt: string | null; technicalApprovalSnapshot: string | null;
  technicalApprovalCustomer: string | null; technicalApprovalEvidence: string | null; canWrite: boolean; onUpdated: () => void }
export function ProjectTechnicalApproval(props: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ready = technicalApprovalReady(props)
  const files = props.files.filter(file => file.category === 'TECHNICAL_PROJECT')
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaving(true)
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const response = await fetch(`/api/projects/${props.projectId}/technical-approval`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, snapshot: technicalFileSnapshot(props.files) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Falha ao registrar aprovação.')
      setEditing(false); props.onUpdated()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Falha ao registrar.') }
    finally { setSaving(false) }
  }
  return <section id="aprovacao-tecnica" className="space-y-3 rounded-xl border bg-white p-5">
    <h2 className="font-bold">Aprovação técnica</h2>
    <p className={`text-sm ${ready ? 'text-emerald-700' : 'text-amber-800'}`}>{props.workflowVersion < 2 ? 'Projeto anterior: regra de aprovação preservada.' : ready ? `Versão técnica aprovada por ${props.technicalApprovalCustomer}.` : props.technicalApprovedAt ? 'Os arquivos foram alterados ou estão indisponíveis. Confira a nova versão e registre novo aceite.' : 'Aguardando o aceite dos desenhos e medidas pelo cliente.'}</p>
    <p className="text-xs text-[#666]">O aceite comercial do orçamento fica separado. Este registro identifica os arquivos técnicos aprovados e quem confirmou o aceite do cliente.</p>
    {files.length > 0 ? <ul className="space-y-1 text-sm">{files.map(file => <li key={file.id}>{file.name || file.id}</li>)}</ul> : <p className="text-sm">Anexe o projeto técnico na área de arquivos.</p>}
    {props.technicalApprovalEvidence && <p className="whitespace-pre-wrap text-sm text-[#555]">Registro anterior: {props.technicalApprovalEvidence}</p>}
    {props.canWrite && !editing && <Button variant="outline" disabled={!files.length} onClick={() => setEditing(true)}>{ready ? 'Registrar novo aceite' : 'Registrar aceite do cliente'}</Button>}
    {editing && <form onSubmit={submit} className="space-y-3 border-t pt-3">
      <Input name="customer" label="Nome de quem aprovou pelo cliente" required minLength={3} maxLength={160} />
      <Input name="approvedAt" label="Data do aceite técnico" type="date" required max={dateOnlyKeyInTimeZone(new Date())} defaultValue={dateOnlyKeyInTimeZone(new Date())} />
      <Textarea name="evidence" label="Onde está a confirmação e qual versão foi aprovada?" placeholder="Ex.: mensagem de confirmação na Konekto, referência e desenhos conferidos." required minLength={15} maxLength={3000} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2"><Button type="submit" loading={saving}>Registrar aprovação técnica</Button><Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(false)}>Cancelar</Button></div>
    </form>}
  </section>
}
