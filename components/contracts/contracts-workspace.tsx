'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileSignature,
  FileText,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
} from 'lucide-react'
import { ClientSearchSelect } from '@/components/clients/client-search-select'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import {
  CONTRACT_CENTER_STATUS_LABELS,
  type ContractCenterStatus,
} from '@/lib/contract-center'
import { formatBRLCurrencyInput, parseBRLCurrency } from '@/lib/currency-input'
import type { ContractSourceDocument } from '@/lib/contract-source-document'
import { formatCurrency, formatDate } from '@/lib/utils'

type ContractRow = {
  id: string
  name: string
  clientName: string
  clientPhone: string | null
  managerName: string
  status: ContractCenterStatus
  standalone?: boolean
  contract: null | {
    id: string
    version: number
    publicUrl: string | null
    sentAt: string | null
    viewedAt: string | null
    lastReminderAt: string | null
    reminderCount: number
    signedAt: string | null
    signatureMethod: 'DIGITAL' | 'IN_PERSON' | null
  }
}

type ContractsPayload = {
  items: ContractRow[]
  standaloneItems: ContractRow[]
  standaloneTotal: number
  total: number
  page: number
  totalPages: number
  counts: { all: number; attention: number; waiting: number; signed: number; legacy: number }
}

type StandaloneConversionPreview = {
  title: string
  clientName: string
  value: number
  paymentMethod: 'PIX' | 'CARD'
  downPayment: number
  installmentCount: number
  installmentValue: number
  firstInstallmentDate: string | null
  suggestedPaymentDate: string
  environmentNames: string[]
  deliveryBusinessDays: number
  deliveryDeadlineDate: string | null
}

type StandaloneConversionData = {
  contract: {
    id: string
    status: string
    signedAt: string | null
  }
  preview: StandaloneConversionPreview
}

type StandaloneEditData = {
  id: string
  version: number
  updatedAt: string
  clientName: string
  form: {
    clientId: string
    title: string
    description: string
    value: number
    paymentMethod: 'PIX' | 'CARD'
    downPayment: number
    downPaymentDate: string
    installmentCount: number
    firstInstallmentDate: string
    deliveryBusinessDays: number
    sourceDocument?: ContractSourceDocument
  }
}

const emptyPayload: ContractsPayload = {
  items: [], standaloneItems: [], standaloneTotal: 0, total: 0, page: 1, totalPages: 1,
  counts: { all: 0, attention: 0, waiting: 0, signed: 0, legacy: 0 },
}

function whatsappUrl(row: ContractRow) {
  const digits = (row.clientPhone || '').replace(/\D/g, '')
  const phone = digits.startsWith('55') ? digits : `55${digits}`
  const url = row.contract?.publicUrl || ''
  const subject = row.standalone ? `contrato de ${row.name}` : `contrato do projeto ${row.name}`
  const message = `Olá, ${row.clientName}! O ${subject} está aguardando sua aprovação. Você conseguiu conferir? Se tiver alguma dúvida ou precisar de ajuste, me avise. ${url}`
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const initialStandaloneForm = () => ({
  clientId: '',
  title: '',
  description: '',
  value: '',
  paymentMethod: 'PIX',
  downPayment: '0,00',
  downPaymentDate: localDateValue(),
  installmentCount: '1',
  firstInstallmentDate: localDateValue(),
  deliveryBusinessDays: '30',
  sourceDocument: undefined as ContractSourceDocument | undefined,
})

function statusTone(status: ContractCenterStatus) {
  if (status === 'SIGNED') return 'bg-emerald-50 text-emerald-700'
  if (status === 'SENT' || status === 'VIEWED') return 'bg-blue-50 text-blue-700'
  if (status === 'LEGACY') return 'bg-[#F5F5F5] text-[#666]'
  return 'bg-amber-50 text-amber-800'
}

function reminderIsAvailable(row: ContractRow) {
  if (!['SENT', 'VIEWED'].includes(row.status) || !row.clientPhone || !row.contract?.publicUrl) return false
  if (!row.contract.lastReminderAt) return true
  return Date.now() - new Date(row.contract.lastReminderAt).getTime() >= 24 * 60 * 60 * 1000
}

export function ContractsWorkspace({ sales = false, clientId = '' }: { sales?: boolean; clientId?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const contractId = sales ? params.get('contractId') || '' : ''
  const [payload, setPayload] = useState(emptyPayload)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(sales && params.get('new') === '1')
  const [creating, setCreating] = useState(false)
  const [editingContract, setEditingContract] = useState<{ id: string; updatedAt: string; clientName: string } | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editBlocked, setEditBlocked] = useState(false)
  const [formError, setFormError] = useState('')
  const [correctedContractUrl, setCorrectedContractUrl] = useState('')
  const [form, setForm] = useState(() => ({ ...initialStandaloneForm(), clientId: clientId || params.get('clientId') || '' }))
  const [importMode, setImportMode] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [importConfirmed, setImportConfirmed] = useState(false)
  const importRequest = useRef<{ id: number; controller: AbortController | null }>({ id: 0, controller: null })
  const pdfInput = useRef<HTMLInputElement>(null)
  const [saleData, setSaleData] = useState<StandaloneConversionData | null>(null)
  const [saleLoading, setSaleLoading] = useState(false)
  const [saleSubmitting, setSaleSubmitting] = useState(false)
  const [saleError, setSaleError] = useState('')
  const [saleForm, setSaleForm] = useState({
    paymentConfirmedAt: '',
    entryPaymentMethod: '',
    balancePaymentMethod: 'CARD',
    signedInPerson: false,
    signedInPersonAt: '',
    environmentNames: '',
  })

  const load = useCallback(async (signal?: AbortSignal, selectedContractId = contractId) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (query.trim()) params.set('q', query.trim())
    if (status) params.set('status', status)
    if (sales) params.set('standalone', '1')
    if (clientId) params.set('clientId', clientId)
    if (selectedContractId) params.set('contractId', selectedContractId)
    try {
      const response = await fetch(`/api/contracts?${params}`, { signal })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Não foi possível carregar os contratos.')
      if (!signal?.aborted) setPayload(result)
    } catch (requestError) {
      if ((requestError as Error).name !== 'AbortError') {
        setError((requestError as Error).message)
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [page, query, status, sales, clientId, contractId])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => void load(controller.signal), 180)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [load])

  useEffect(() => () => { importRequest.current.controller?.abort() }, [])

  const clearPendingImport = () => {
    importRequest.current.controller?.abort()
    importRequest.current = { id: importRequest.current.id + 1, controller: null }
    setImportLoading(false)
    setImportWarnings([])
    setImportConfirmed(false)
  }

  const remind = async (row: ContractRow) => {
    if (!row.contract || !row.clientPhone || !row.contract.publicUrl) return
    setBusyId(row.id)
    const popup = window.open(whatsappUrl(row), '_blank', 'noopener,noreferrer')
    try {
      const response = await fetch(row.standalone ? '/api/contracts' : `/api/projects/${row.id}/contracts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: row.contract.id }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Não foi possível registrar o lembrete.')
      await load()
    } catch (requestError) {
      if (popup) popup.close()
      setError((requestError as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const startStandaloneCreate = (fromPDF: boolean) => {
    clearPendingImport()
    setImportMode(fromPDF)
    setEditingContract(null)
    setEditBlocked(false)
    setFormError('')
    setForm({ ...initialStandaloneForm(), clientId: clientId || params.get('clientId') || '' })
    setCreateOpen(true)
  }

  const openStandaloneCreate = () => startStandaloneCreate(false)

  const closeStandalone = () => {
    if (creating || editLoading) return
    clearPendingImport()
    setCreateOpen(false)
  }

  const changeStandaloneClient = (nextClientId: string) => {
    if (nextClientId === form.clientId) return
    clearPendingImport()
    setFormError('')
    if (importMode || form.sourceDocument) {
      setForm({ ...initialStandaloneForm(), clientId: nextClientId })
      if (pdfInput.current) pdfInput.current.value = ''
    } else {
      setForm((current) => ({ ...current, clientId: nextClientId }))
    }
  }

  const importQuotePDF = async (file: File | undefined) => {
    clearPendingImport()
    setFormError('')
    setForm((current) => ({ ...current, title: '', description: '', value: '', sourceDocument: undefined }))
    if (!file) return
    if (!form.clientId) {
      setFormError('Selecione um cliente cadastrado antes de enviar o PDF.')
      return
    }
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) {
      setFormError('Escolha um arquivo PDF de orçamento.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setFormError('O PDF deve ter até 4 MB.')
      return
    }
    const controller = new AbortController()
    const requestId = importRequest.current.id + 1
    importRequest.current = { id: requestId, controller }
    setImportLoading(true)
    try {
      const body = new FormData()
      body.set('clientId', form.clientId)
      body.set('file', file)
      const response = await fetch('/api/contracts/import-pdf', { method: 'POST', body, signal: controller.signal })
      const result = await response.json().catch(() => null)
      if (controller.signal.aborted || importRequest.current.id !== requestId) return
      if (!response.ok) throw new Error(result?.error || 'Não foi possível ler este PDF. Tente outro arquivo.')
      if (result?.sourceDocument?.type !== 'PDF_QUOTE' || typeof result?.sourceDocument?.text !== 'string' || !result?.suggested) {
        throw new Error('A leitura do orçamento está incompleta. Envie o PDF novamente.')
      }
      setForm((current) => ({
        ...current,
        title: typeof result.suggested.title === 'string' ? result.suggested.title : '',
        description: typeof result.suggested.description === 'string' ? result.suggested.description : '',
        value: typeof result.suggested.value === 'number' && Number.isFinite(result.suggested.value)
          ? formatBRLCurrencyInput(result.suggested.value)
          : '',
        sourceDocument: result.sourceDocument,
      }))
      setImportWarnings(Array.isArray(result.warnings) ? result.warnings.filter((warning: unknown) => typeof warning === 'string') : [])
    } catch (requestError) {
      if (!controller.signal.aborted && importRequest.current.id === requestId) setFormError((requestError as Error).message)
    } finally {
      if (!controller.signal.aborted && importRequest.current.id === requestId) setImportLoading(false)
    }
  }

  const openStandaloneEdit = async (row: ContractRow) => {
    if (editLoading || creating) return
    clearPendingImport()
    setImportMode(false)
    setEditingContract({ id: row.id, updatedAt: '', clientName: row.clientName })
    setForm(initialStandaloneForm())
    setFormError('')
    setEditLoading(true)
    setEditBlocked(false)
    setCreateOpen(true)
    setBusyId(row.id)
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(row.id)}`, { cache: 'no-store' })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Não foi possível carregar o contrato para edição.')
      if (result?.id !== row.id || !result?.updatedAt || !result?.form?.clientId) {
        throw new Error('Os dados do contrato estão incompletos. Feche esta janela e tente novamente.')
      }
      const data = result as StandaloneEditData
      setForm({
        clientId: data.form.clientId,
        title: data.form.title,
        description: data.form.description,
        value: formatBRLCurrencyInput(data.form.value),
        paymentMethod: data.form.paymentMethod,
        downPayment: formatBRLCurrencyInput(data.form.downPayment),
        downPaymentDate: data.form.downPaymentDate,
        installmentCount: String(data.form.installmentCount),
        firstInstallmentDate: data.form.firstInstallmentDate,
        deliveryBusinessDays: String(data.form.deliveryBusinessDays),
        sourceDocument: data.form.sourceDocument,
      })
      setImportMode(Boolean(data.form.sourceDocument))
      setEditingContract({ id: data.id, updatedAt: data.updatedAt, clientName: data.clientName })
    } catch (requestError) {
      setFormError((requestError as Error).message)
    } finally {
      setEditLoading(false)
      setBusyId(null)
    }
  }

  const normalizeStandaloneAmount = (field: 'value' | 'downPayment') => {
    setForm((current) => {
      const amount = parseBRLCurrency(current[field])
      return Number.isFinite(amount) && amount >= 0
        ? { ...current, [field]: formatBRLCurrencyInput(amount) }
        : current
    })
  }

  const saveStandalone = async (event: React.FormEvent) => {
    event.preventDefault()
    if (creating || editLoading || editBlocked || importLoading || (editingContract && !editingContract.updatedAt)) return
    if (!form.clientId) {
      setFormError('Selecione o cliente do contrato.')
      return
    }
    if (importMode && (!form.sourceDocument || !importConfirmed)) {
      setFormError('Leia o PDF e confirme a revisão dos dados antes de criar o contrato.')
      return
    }
    if (form.description.trim().length < 5 || form.description.length > 20_000) {
      setFormError('A descrição deve ter entre 5 e 20.000 caracteres. Revise o conteúdo antes de salvar.')
      return
    }
    const value = parseBRLCurrency(form.value)
    const downPayment = form.paymentMethod === 'PIX' ? 0 : parseBRLCurrency(form.downPayment.trim() || '0')
    if (!Number.isFinite(value) || value < 0.01) {
      setFormError('Informe um valor total válido. Ex.: 50.000,00 para cinquenta mil reais.')
      return
    }
    if (!Number.isFinite(downPayment) || downPayment < 0 || downPayment >= value) {
      setFormError('Informe uma entrada válida, menor que o valor total do contrato, ou zero se não houver entrada.')
      return
    }
    setCreating(true)
    setFormError('')
    try {
      const contractForm = { ...form, value, downPayment }
      const response = await fetch(editingContract ? `/api/contracts/${encodeURIComponent(editingContract.id)}` : '/api/contracts', {
        method: editingContract ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingContract ? { ...contractForm, updatedAt: editingContract.updatedAt } : contractForm),
      })
      const result = await response.json().catch(() => null)
      if (editingContract && response.status === 409) setEditBlocked(true)
      if (!response.ok) throw new Error(result?.error || (editingContract ? 'Não foi possível salvar as correções.' : 'Não foi possível criar o contrato avulso.'))
      if (editingContract && (!result?.id || !result?.publicUrl)) {
        setEditBlocked(true)
        throw new Error('Não foi possível localizar o contrato corrigido. Atualize a lista antes de tentar novamente.')
      }
      setCreateOpen(false)
      clearPendingImport()
      setForm(initialStandaloneForm())
      if (editingContract) {
        setCorrectedContractUrl(result.publicUrl)
        setEditingContract(null)
        if (contractId) {
          const nextParams = new URLSearchParams(params.toString())
          nextParams.set('contractId', result.id)
          nextParams.delete('new')
          router.replace(`/dashboard/sales?${nextParams}`, { scroll: false })
        }
        await load(undefined, contractId ? result.id : undefined)
      } else {
        await load()
        if (result?.publicUrl) window.open(result.publicUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (requestError) {
      setFormError((requestError as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const cancelStandalone = async (row: ContractRow) => {
    if (!window.confirm(`Cancelar o contrato avulso "${row.name}"?`)) return
    setBusyId(row.id)
    try {
      const response = await fetch(`/api/contracts?contractId=${encodeURIComponent(row.id)}`, { method: 'DELETE' })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Não foi possível cancelar o contrato.')
      await load()
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const openStandaloneSale = async (row: ContractRow) => {
    setBusyId(row.id)
    setSaleLoading(true)
    setSaleError('')
    try {
      const response = await fetch(`/api/contracts/${encodeURIComponent(row.id)}/convert`)
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Não foi possível preparar a venda.')
      if (result?.alreadyConverted && result?.project?.id) {
        router.push(`/dashboard/projects/${result.project.id}`)
        return
      }
      if (!result?.contract || !result?.preview) throw new Error('Os dados do contrato estão incompletos.')
      const data = result as StandaloneConversionData
      setSaleData(data)
      setSaleForm({
        paymentConfirmedAt: data.preview.suggestedPaymentDate || localDateValue(),
        entryPaymentMethod: '',
        balancePaymentMethod: data.preview.paymentMethod,
        signedInPerson: false,
        signedInPersonAt: '',
        environmentNames: data.preview.environmentNames.join('\n'),
      })
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setSaleLoading(false)
      setBusyId(null)
    }
  }

  const convertStandalone = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!saleData) return
    setSaleError('')
    const formData = new FormData(event.currentTarget as HTMLFormElement)
    const paymentConfirmedAt = String(formData.get('paymentConfirmedAt') || '').trim()
    const signedInPersonAt = String(formData.get('signedInPersonAt') || '').trim()
    if (!paymentConfirmedAt) {
      setSaleError('Informe a data em que a entrada foi recebida.')
      return
    }
    if (saleForm.signedInPerson && !signedInPersonAt) {
      setSaleError('Informe a data real da assinatura presencial.')
      return
    }
    setSaleSubmitting(true)
    try {
      const environmentNames = saleForm.environmentNames
        .split(/\r?\n/)
        .map((name) => name.trim())
        .filter(Boolean)
      const response = await fetch(`/api/contracts/${encodeURIComponent(saleData.contract.id)}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentConfirmedAt,
          entryPaymentMethod: saleForm.entryPaymentMethod || undefined,
          balancePaymentMethod: saleData.preview.paymentMethod === 'CARD'
            ? saleForm.balancePaymentMethod
            : undefined,
          signedInPersonAt: saleForm.signedInPerson
            ? signedInPersonAt
            : undefined,
          environmentNames,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Não foi possível registrar a venda.')
      if (!result?.project?.id) throw new Error('A venda foi registrada, mas o projeto não foi localizado.')
      router.push(`/dashboard/projects/${result.project.id}`)
    } catch (requestError) {
      setSaleError((requestError as Error).message)
    } finally {
      setSaleSubmitting(false)
    }
  }

  return (
    <div className={sales ? "space-y-3" : "flex h-full flex-col"}>
      {!sales && <Header
        title="Contratos"
        subtitle="Acompanhe envios, visualizações, assinaturas e cobranças"
        action={{ label: 'Venda sem orçamento', onClick: () => router.push('/dashboard/sales?new=1') }}
      />}
      <div className={sales ? "space-y-3" : "flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"}>
        {!sales && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#777]">Crie o contrato manualmente ou aproveite um orçamento em PDF.</p>
            <Button variant="outline" onClick={() => startStandaloneCreate(true)}><Upload size={15} /> Importar PDF</Button>
          </div>
        )}
        {!sales && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Precisam de atenção" value={payload.counts.attention} icon={AlertTriangle} tone="amber" />
          <Metric label="Aguardando cliente" value={payload.counts.waiting} icon={MessageCircle} tone="blue" />
          <Metric label="Assinados" value={payload.counts.signed} icon={CheckCircle2} tone="green" />
          <Metric label="Projetos antigos" value={payload.counts.legacy} icon={FileSignature} tone="gray" />
        </div>}
        {sales && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold">Vendas sem orçamento</h2><p className="text-xs text-[#777]">Contratos avulsos em formalização</p></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => startStandaloneCreate(true)}><Upload size={15} /> Importar PDF</Button>
              <Button onClick={openStandaloneCreate}><Plus size={15} /> Venda sem orçamento</Button>
            </div>
          </div>
        )}
        {correctedContractUrl ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p>Contrato corrigido. Confira e compartilhe o novo link com o cliente.</p>
            <a href={correctedContractUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold underline">Abrir contrato corrigido <ExternalLink size={14} /></a>
          </div>
        ) : null}
        {contractId && <Link href="/dashboard/sales" className="text-sm text-orange-700 underline">Ver todos os fechamentos</Link>}
        {sales && <div className="flex flex-wrap gap-2"><input aria-label="Buscar contrato avulso" placeholder="Buscar cliente ou contrato" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} className="h-10 min-w-0 flex-1 rounded-md border border-[#DDD] px-3 text-sm"/><select aria-label="Situação do contrato avulso" value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}} className="h-10 rounded-md border border-[#DDD] px-3 text-sm"><option value="">Todas as situações</option>{Object.entries(CONTRACT_CENTER_STATUS_LABELS).filter(([value]) => ['SENT','VIEWED','SIGNED','EXPIRED'].includes(value)).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>}
        {sales && error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {sales && loading && <p role="status" className="text-sm text-[#777]">Carregando contratos…</p>}
        {sales && !loading && !error && payload.standaloneItems.length === 0 && <p className="rounded-lg border border-[#E5E5E5] bg-white p-5 text-sm text-[#777]">Nenhum contrato avulso nesta visão.</p>}

        {payload.standaloneItems.length > 0 ? (
          <Card>
            <CardBody className="p-0">
              <div className="flex items-center justify-between border-b border-[#ECECEC] px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#121212]">Contratos avulsos</h2>
                  <p className="mt-0.5 text-xs text-[#888]">Criados sem orçamento e sem projeto</p>
                </div>
                <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1 text-xs text-[#666]">{payload.standaloneTotal}</span>
              </div>
              <div className="divide-y divide-[#ECECEC]">
                {payload.standaloneItems.map((row) => {
                  const canRemind = reminderIsAvailable(row)
                  return (
                    <div key={row.id} className="grid gap-3 px-4 py-4 hover:bg-[#FAFAFA] md:grid-cols-[minmax(190px,1.4fr)_minmax(130px,1fr)_150px] md:items-center 2xl:grid-cols-[minmax(190px,1.4fr)_minmax(130px,1fr)_150px_auto]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#121212]">{row.name}</p>
                        <p className="mt-1 truncate text-xs text-[#777]">{row.clientName} · {row.managerName}</p>
                      </div>
                      <div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(row.status)}`}>{CONTRACT_CENTER_STATUS_LABELS[row.status]}</span>
                        <p className="mt-1 text-[11px] text-[#999]">Contrato avulso{row.contract?.version ? ` · Versão ${row.contract.version}` : ''}</p>
                      </div>
                      <div className="text-xs text-[#777]">
                        {row.contract?.signedAt
                          ? `${row.contract.signatureMethod === 'IN_PERSON' ? 'Assinado presencialmente' : 'Aceito digitalmente'} em ${formatDate(row.contract.signedAt)}`
                          : row.contract?.viewedAt
                            ? `Visto em ${formatDate(row.contract.viewedAt)}`
                            : `Enviado em ${formatDate(row.contract?.sentAt || null)}`}
                        {row.contract?.reminderCount ? <p className="mt-1">{row.contract.reminderCount} lembrete{row.contract.reminderCount !== 1 ? 's' : ''}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 md:col-span-3 2xl:col-span-1">
                        {['SENT', 'VIEWED', 'EXPIRED'].includes(row.status) && !row.contract?.signedAt ? (
                          <button type="button" disabled={busyId === row.id || editLoading || creating} onClick={() => void openStandaloneEdit(row)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F5F5F5] disabled:opacity-50"><Pencil size={14} /> Editar</button>
                        ) : null}
                        <a href={`/api/contracts/${row.id}/document`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F5F5F5]"><FileText size={14} /> PDF</a>
                        {canRemind ? (
                          <button type="button" disabled={busyId === row.id} onClick={() => void remind(row)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#FF6B00] px-3 text-xs font-semibold text-[#FF6B00] hover:bg-orange-50 disabled:opacity-50"><Send size={14} /> Lembrar</button>
                        ) : null}
                        {row.contract?.publicUrl ? (
                          <a href={row.contract.publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#121212] px-3 text-xs font-semibold text-white hover:bg-[#292929]">Abrir <ExternalLink size={13} /></a>
                        ) : null}
                        <button
                          type="button"
                          disabled={busyId === row.id || saleLoading || !['SENT','VIEWED','SIGNED'].includes(row.status)}
                          onClick={() => sales ? void openStandaloneSale(row) : router.push(`/dashboard/sales?contractId=${encodeURIComponent(row.id)}`)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-600 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} /> {sales ? 'Confirmar venda' : 'Continuar fechamento'}
                        </button>
                        {row.status !== 'SIGNED' ? (
                          <button type="button" title="Cancelar contrato" aria-label="Cancelar contrato" disabled={busyId === row.id} onClick={() => void cancelStandalone(row)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14} /></button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardBody>
          </Card>
        ) : null}

        {!sales && <Card>
          <CardBody className="p-0">
            <div className="border-b border-[#ECECEC] px-4 py-3">
              <h2 className="text-sm font-semibold text-[#121212]">Contratos dos projetos</h2>
              <p className="mt-0.5 text-xs text-[#888]">Gerados a partir dos projetos vendidos</p>
            </div>
            <div className="flex flex-col gap-3 border-b border-[#ECECEC] p-4 sm:flex-row sm:items-center">
              <label className="relative min-w-0 flex-1">
                <Search size={16} className="absolute left-3 top-3 text-[#999]" />
                <input
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setPage(1) }}
                  placeholder="Buscar projeto ou cliente"
                  className="h-10 w-full rounded-lg border border-[#D9D9D9] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#FF6B00]"
                />
              </label>
              <select
                value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1) }}
                aria-label="Filtrar por status"
                className="h-10 rounded-lg border border-[#D9D9D9] bg-white px-3 text-sm"
              >
                <option value="">Todos os status</option>
                {Object.entries(CONTRACT_CENTER_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {error ? <p className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {loading ? (
              <div className="space-y-2 p-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-[#F5F5F5]" />)}</div>
            ) : payload.items.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <FileSignature className="mx-auto text-[#C8C8C8]" />
                <p className="mt-3 text-sm font-semibold text-[#333]">Nenhum contrato encontrado</p>
                <p className="mt-1 text-xs text-[#888]">Os contratos dos projetos aparecerão aqui.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#ECECEC]">
                {payload.items.map((row) => {
                  const canRemind = reminderIsAvailable(row)
                  return (
                    <div key={row.id} className="grid gap-3 px-4 py-4 hover:bg-[#FAFAFA] md:grid-cols-[minmax(190px,1.4fr)_minmax(130px,1fr)_150px_auto] md:items-center">
                      <div className="min-w-0">
                        <Link href={`/dashboard/projects/${row.id}#contrato`} className="truncate text-sm font-semibold text-[#121212] hover:text-[#FF6B00]">{row.name}</Link>
                        <p className="mt-1 truncate text-xs text-[#777]">{row.clientName} · {row.managerName}</p>
                      </div>
                      <div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(row.status)}`}>{CONTRACT_CENTER_STATUS_LABELS[row.status]}</span>
                        {row.contract?.version ? <p className="mt-1 text-[11px] text-[#999]">Versão {row.contract.version}</p> : null}
                      </div>
                      <div className="text-xs text-[#777]">
                        {row.contract?.signedAt
                          ? `${row.contract.signatureMethod === 'IN_PERSON' ? 'Assinado presencialmente' : 'Aceito digitalmente'} em ${formatDate(row.contract.signedAt)}`
                          : row.contract?.viewedAt
                            ? `Visto em ${formatDate(row.contract.viewedAt)}`
                            : row.contract?.sentAt
                              ? `Enviado em ${formatDate(row.contract.sentAt)}`
                              : 'Ainda não enviado'}
                        {row.contract?.reminderCount ? <p className="mt-1">{row.contract.reminderCount} lembrete{row.contract.reminderCount !== 1 ? 's' : ''}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {row.status === 'SIGNED' && row.contract ? (
                          <a href={`/api/projects/${row.id}/contracts/${row.contract.id}/document`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D9D9D9] px-3 text-xs font-semibold hover:bg-[#F5F5F5]">PDF <ExternalLink size={13} /></a>
                        ) : null}
                        {canRemind ? (
                          <button type="button" disabled={busyId === row.id} onClick={() => void remind(row)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#FF6B00] px-3 text-xs font-semibold text-[#FF6B00] hover:bg-orange-50 disabled:opacity-50"><MessageCircle size={14} /> Lembrar</button>
                        ) : null}
                        <Link href={`/dashboard/projects/${row.id}#contrato`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#121212] px-3 text-xs font-semibold text-white hover:bg-[#292929]">Abrir <ArrowRight size={13} /></Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[#ECECEC] px-4 py-3">
              <p className="text-xs text-[#777]">{payload.total} contrato{payload.total !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9D9D9] disabled:opacity-40"><ArrowLeft size={14} /></button>
                <span className="flex h-8 items-center px-2 text-xs text-[#666]">{page} de {payload.totalPages}</span>
                <button type="button" aria-label="Próxima página" disabled={page >= payload.totalPages} onClick={() => setPage((value) => value + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D9D9D9] disabled:opacity-40"><ArrowRight size={14} /></button>
              </div>
            </div>
          </CardBody>
        </Card>}
        {sales && <div className="flex items-center justify-between text-xs text-[#777]"><span>{payload.standaloneTotal} contratos · página {page}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1 || loading} onClick={()=>setPage(page-1)}>Anterior</Button><Button variant="outline" disabled={page * 20 >= payload.standaloneTotal || loading} onClick={()=>setPage(page+1)}>Próxima</Button></div></div>}
      </div>

      <Modal
        open={Boolean(saleData)}
        onClose={() => {
          if (!saleSubmitting) {
            setSaleData(null)
            setSaleError('')
          }
        }}
        title="Confirmar venda do contrato"
        size="lg"
      >
        {saleData ? (
          <form onSubmit={convertStandalone} className="space-y-5">
            <div className="rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] p-4">
              <p className="text-sm font-semibold text-[#121212]">{saleData.preview.title}</p>
              <p className="mt-1 text-xs text-[#666]">Cliente: {saleData.preview.clientName}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#999]">Valor da venda</p>
                  <p className="mt-1 text-sm font-semibold text-[#121212]">{formatCurrency(saleData.preview.value)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#999]">Entrada</p>
                  <p className="mt-1 text-sm font-semibold text-[#121212]">{formatCurrency(saleData.preview.downPayment)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#999]">Parcelamento</p>
                  <p className="mt-1 text-sm font-semibold text-[#121212]">
                    {saleData.preview.paymentMethod === 'PIX'
                      ? 'Pagamento por Pix'
                      : `${saleData.preview.installmentCount}x de ${formatCurrency(saleData.preview.installmentValue)} ${saleForm.balancePaymentMethod === 'BOLETO' ? 'em boletos' : 'no cartão'}`}
                  </p>
                </div>
              </div>
            </div>

            {!saleData.contract.signedAt && !saleForm.signedInPerson ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                O cliente já visualizou este contrato, mas não há assinatura registrada. Marque abaixo se existe uma via física assinada; caso contrário, a produção continuará aguardando a assinatura.
              </div>
            ) : null}

            {saleError ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saleError}</div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Data em que a entrada foi recebida *"
                name="paymentConfirmedAt"
                type="date"
                max={localDateValue()}
                value={saleForm.paymentConfirmedAt}
                onChange={(event) => setSaleForm((current) => ({ ...current, paymentConfirmedAt: event.target.value }))}
                required
              />
              {saleData.preview.paymentMethod === 'CARD' && saleData.preview.downPayment > 0 ? (
                <Select
                  label="Como a entrada foi recebida? *"
                  value={saleForm.entryPaymentMethod}
                  onChange={(event) => setSaleForm((current) => ({ ...current, entryPaymentMethod: event.target.value }))}
                  options={[
                    { value: '', label: 'Selecione' },
                    { value: 'PIX', label: 'Pix' },
                    { value: 'CARTAO', label: 'Cartão' },
                    { value: 'DINHEIRO', label: 'Dinheiro' },
                    { value: 'BOLETO', label: 'Boleto' },
                    { value: 'TRANSFERENCIA', label: 'Transferência' },
                  ]}
                  required
                />
              ) : null}
            </div>

            {saleData.preview.paymentMethod === 'CARD' ? (
              <Select
                label="Como será pago o saldo? *"
                value={saleForm.balancePaymentMethod}
                onChange={(event) => setSaleForm((current) => ({ ...current, balancePaymentMethod: event.target.value }))}
                options={[
                  { value: 'CARD', label: 'Cartão parcelado' },
                  { value: 'BOLETO', label: 'Boleto parcelado' },
                ]}
                required
              />
            ) : null}

            {!saleData.contract.signedAt ? (
              <div className="space-y-3 rounded-lg border border-[#E3E3E3] p-4">
                <label className="flex cursor-pointer items-start gap-3 text-sm text-[#222]">
                  <input
                    type="checkbox"
                    checked={saleForm.signedInPerson}
                    onChange={(event) => setSaleForm((current) => ({
                      ...current,
                      signedInPerson: event.target.checked,
                    }))}
                    className="mt-0.5 h-4 w-4 accent-[#FF6B00]"
                  />
                  <span>
                    <strong className="block">O contrato já foi assinado presencialmente</strong>
                    <span className="mt-1 block text-xs leading-5 text-[#777]">
                      Este é um lançamento administrativo. Não será criado IP, dispositivo ou aceite eletrônico.
                    </span>
                  </span>
                </label>
                {saleForm.signedInPerson ? (
                  <Input
                    label="Data real da assinatura presencial *"
                    name="signedInPersonAt"
                    type="date"
                    max={localDateValue()}
                    value={saleForm.signedInPersonAt}
                    onChange={(event) => setSaleForm((current) => ({ ...current, signedInPersonAt: event.target.value }))}
                    required
                  />
                ) : null}
              </div>
            ) : null}

            <Textarea
              label="Ambientes do projeto (um por linha) *"
              value={saleForm.environmentNames}
              onChange={(event) => setSaleForm((current) => ({ ...current, environmentNames: event.target.value }))}
              rows={7}
              required
            />

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
              O contrato original será preservado e vinculado ao novo projeto. Valores e vencimentos serão mantidos. {saleForm.balancePaymentMethod !== saleData.preview.paymentMethod
                ? saleForm.signedInPerson
                  ? 'A versão online anterior ficará no histórico e uma nova versão, com a condição da via física, será registrada como assinada presencialmente.'
                  : 'A divergência de pagamento será registrada e exigirá uma nova versão do contrato antes da produção.'
                : 'A condição de pagamento será preservada como está no documento.'}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#ECECEC] pt-4">
              <Button type="button" variant="outline" onClick={() => setSaleData(null)} disabled={saleSubmitting}>Cancelar</Button>
              <Button type="submit" loading={saleSubmitting}><CheckCircle2 size={15} /> Registrar venda</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={createOpen} onClose={closeStandalone} title={editingContract ? 'Editar contrato avulso' : importMode ? 'Criar contrato a partir de PDF' : 'Venda sem orçamento'} size="lg">
        <form onSubmit={saveStandalone} className="space-y-5">
          <div className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-3 text-xs leading-5 text-[#8A3A00]">
            {editingContract
              ? 'Ao salvar, será criada uma nova versão. O link anterior será substituído; confira e compartilhe o novo link com o cliente.'
              : importMode
                ? 'Selecione um cliente cadastrado e envie o PDF do orçamento, por exemplo do GestãoClick. Confira os dados extraídos e defina o pagamento antes de criar o contrato. A criação manual continua disponível em Venda sem orçamento.'
              : 'Este contrato será criado diretamente para o cliente, sem orçamento e sem projeto. Ele não aparecerá na Produção.'}
          </div>

          {formError ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div> : null}
          {editBlocked ? <p className="text-xs leading-5 text-[#777]">Feche esta janela e abra Editar novamente para carregar a situação atual do contrato.</p> : null}
          {editLoading ? <p role="status" className="text-sm text-[#777]">Carregando os dados do contrato…</p> : null}

          {(!editingContract || editingContract.updatedAt) && <fieldset disabled={creating || editLoading || editBlocked} className="space-y-5">

          <ClientSearchSelect
            key={editingContract?.id || 'new-contract'}
            value={form.clientId}
            onChange={changeStandaloneClient}
            initialOptions={editingContract ? [{ id: form.clientId, name: editingContract.clientName }] : []}
            label="Cliente *"
          />

          {importMode && (
            <div className="space-y-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
              <Input
                ref={pdfInput}
                label={form.sourceDocument ? 'Trocar PDF do orçamento' : 'PDF do orçamento *'}
                type="file"
                accept="application/pdf,.pdf"
                disabled={!form.clientId}
                onChange={(event) => void importQuotePDF(event.target.files?.[0])}
                helperText={form.clientId ? 'Até 4 MB. A leitura preenche uma sugestão para você revisar; o contrato só será criado ao salvar.' : 'Primeiro selecione o cliente cadastrado acima. Se ele ainda não existe, cadastre-o em Clientes.'}
              />
              {importLoading ? <p role="status" className="text-sm text-[#777]">Lendo o orçamento em PDF…</p> : null}
              {form.sourceDocument ? (
                <>
                  <p role="status" className="break-words text-xs text-[#555]">Orçamento lido: <strong>{form.sourceDocument.fileName}</strong> · {form.sourceDocument.pageCount} página{form.sourceDocument.pageCount !== 1 ? 's' : ''}. Confira abaixo os itens, medidas e valores.</p>
                  {importWarnings.length > 0 ? (
                    <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                      <p className="font-semibold">Pontos para conferir</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4">{importWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
                    </div>
                  ) : null}
                  <details className="text-xs text-[#666]">
                    <summary className="cursor-pointer font-medium">Ver texto completo extraído do PDF</summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[#E5E5E5] bg-white p-3 font-sans leading-5">{form.sourceDocument.text}</pre>
                  </details>
                </>
              ) : null}
            </div>
          )}

          {(!importMode || form.sourceDocument) && <fieldset disabled={importLoading} className="space-y-5">

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Serviço contratado *"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ex.: Móveis planejados da cozinha"
              required
            />
            <Input
              label="Valor total (R$) *"
              type="text"
              inputMode="decimal"
              value={form.value}
              onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
              onBlur={() => normalizeStandaloneAmount('value')}
              placeholder="Ex.: 50.000,00"
              helperText={Number.isFinite(parseBRLCurrency(form.value)) && parseBRLCurrency(form.value) > 0
                ? `Valor informado: ${formatCurrency(parseBRLCurrency(form.value))}`
                : 'Ex.: 50.000,00 = cinquenta mil reais.'}
              required
            />
          </div>

          <Textarea
            label="Descrição do que está sendo contratado *"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Descreva os móveis, ambientes, materiais, acabamentos e o que está incluído."
            rows={importMode ? 8 : 4}
            error={form.description.length > 20_000 ? 'A descrição ultrapassa 20.000 caracteres. Reduza o conteúdo sem remover os itens necessários.' : undefined}
            required
          />
          <p className={`-mt-3 text-right text-xs ${form.description.length > 20_000 ? 'text-red-600' : 'text-[#777]'}`}>{form.description.length.toLocaleString('pt-BR')} / 20.000 caracteres</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Forma de pagamento *"
              value={form.paymentMethod}
              onChange={(event) => setForm((current) => ({
                ...current,
                paymentMethod: event.target.value,
                installmentCount: event.target.value === 'PIX' ? '1' : current.installmentCount,
                downPayment: event.target.value === 'PIX' ? '0,00' : current.downPayment,
              }))}
              options={[
                { value: 'PIX', label: 'Pix' },
                { value: 'CARD', label: 'Cartão parcelado' },
              ]}
            />
            <Input
              label="Prazo de entrega (dias úteis) *"
              type="number"
              min="1"
              max="365"
              value={form.deliveryBusinessDays}
              onChange={(event) => setForm((current) => ({ ...current, deliveryBusinessDays: event.target.value }))}
              required
            />
          </div>

          {form.paymentMethod === 'CARD' ? (
            <div className="grid gap-4 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 sm:grid-cols-2">
              <Input
                label="Entrada (R$)"
                type="text"
                inputMode="decimal"
                value={form.downPayment}
                onChange={(event) => setForm((current) => ({ ...current, downPayment: event.target.value }))}
                onBlur={() => normalizeStandaloneAmount('downPayment')}
                placeholder="Ex.: 15.000,00"
                helperText={Number.isFinite(parseBRLCurrency(form.downPayment)) && parseBRLCurrency(form.downPayment) >= 0
                  ? `Entrada informada: ${formatCurrency(parseBRLCurrency(form.downPayment))}`
                  : 'Ex.: 15.000,00 = quinze mil reais. Sem entrada, informe 0,00.'}
              />
              <Input
                label="Data da entrada"
                type="date"
                value={form.downPaymentDate}
                onChange={(event) => setForm((current) => ({ ...current, downPaymentDate: event.target.value }))}
                required
              />
              <Input
                label="Quantidade de parcelas *"
                type="number"
                min="1"
                max="24"
                value={form.installmentCount}
                onChange={(event) => setForm((current) => ({ ...current, installmentCount: event.target.value }))}
                required
              />
              <Input
                label="Vencimento da primeira parcela *"
                type="date"
                value={form.firstInstallmentDate}
                onChange={(event) => setForm((current) => ({ ...current, firstInstallmentDate: event.target.value }))}
                required
              />
            </div>
          ) : (
            <Input
              label="Data do pagamento por Pix *"
              type="date"
              value={form.firstInstallmentDate}
              onChange={(event) => setForm((current) => ({ ...current, firstInstallmentDate: event.target.value }))}
              required
            />
          )}
          {importMode && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#E3E3E3] p-4 text-sm leading-5 text-[#222]">
              <input type="checkbox" checked={importConfirmed} onChange={(event) => setImportConfirmed(event.target.checked)} required className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF6B00]" />
              <span>Conferi os itens, medidas, materiais, valores e condições de pagamento do contrato.</span>
            </label>
          )}
          </fieldset>}
          </fieldset>}

          <div className="flex justify-end gap-2 border-t border-[#ECECEC] pt-4">
            <Button type="button" variant="outline" onClick={closeStandalone} disabled={creating || editLoading}>Cancelar</Button>
            <Button type="submit" loading={creating} disabled={editLoading || editBlocked || importLoading || Boolean(editingContract && !editingContract.updatedAt) || form.description.length > 20_000 || Boolean(importMode && (!form.sourceDocument || !importConfirmed))}>{editingContract ? <Pencil size={15} /> : <Plus size={15} />} {editingContract ? 'Salvar correções' : 'Criar contrato e abrir link'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof FileSignature; tone: 'amber' | 'blue' | 'green' | 'gray' }) {
  const colors = { amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', green: 'bg-emerald-50 text-emerald-700', gray: 'bg-[#F5F5F5] text-[#666]' }
  return (
    <Card><CardBody className="flex items-center gap-3 p-4"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors[tone]}`}><Icon size={17} /></span><span><strong className="block text-xl text-[#121212]">{value}</strong><span className="text-xs text-[#777]">{label}</span></span></CardBody></Card>
  )
}
