import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ContractAcceptanceActions } from '@/components/contracts/contract-acceptance-actions'
import { prisma } from '@/lib/db'
import {
  hashProjectContractToken,
  parseProjectContractSnapshot,
} from '@/lib/project-contracts'
import { formatDateOnly } from '@/lib/date-only'
import { formatCurrency } from '@/lib/utils'
import { isValidPublicToken } from '@/lib/public-access'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Contrato | Vertex Móveis',
  robots: { index: false, follow: false },
}

function contractState(contract: {
  status: string
  expiresAt: Date | null
  signedAt: Date | null
  voidedAt: Date | null
}) {
  if (contract.voidedAt || contract.status === 'VOID') {
    return 'Este contrato foi cancelado. Solicite um novo link à Vertex Móveis.'
  }
  if (contract.expiresAt && contract.expiresAt < new Date() && !contract.signedAt) {
    return 'Este contrato expirou. Solicite um novo link à Vertex Móveis.'
  }
  return null
}

function UnavailableContract({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#EFEFEC] px-4 py-10">
      <section className="w-full max-w-lg overflow-hidden rounded-lg border border-[#E2E0DC] bg-white shadow-[0_20px_60px_rgba(18,18,18,0.10)]">
        <div className="h-2 bg-[#FF6B00]" />
        <div className="px-6 py-8 sm:px-10">
          <div className="flex items-center gap-3">
            <Image src="/vertex-symbol.png" alt="Vertex Móveis" width={48} height={34} className="h-9 w-auto" priority />
            <div>
              <p className="font-extrabold text-[#121212]">Vertex Móveis</p>
              <p className="text-xs text-[#777]">Contrato de fornecimento</p>
            </div>
          </div>
          <h1 className="mt-8 text-xl font-extrabold text-[#121212]">Contrato indisponível</h1>
          <p className="mt-3 text-sm leading-6 text-[#5E5E5E]">{message}</p>
          <p className="mt-6 border-t border-[#ECE9E5] pt-5 text-xs leading-5 text-[#777]">
            Os dados pessoais e as condições comerciais foram ocultados por segurança.
          </p>
        </div>
      </section>
    </main>
  )
}

export default async function PublicContractPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!isValidPublicToken(token)) notFound()

  const contract = await prisma.projectContract.findUnique({
    where: { tokenHash: hashProjectContractToken(token) },
  })
  if (!contract) notFound()
  const unavailableMessage = contractState(contract)
  if (unavailableMessage) return <UnavailableContract message={unavailableMessage} />

  const snapshot = parseProjectContractSnapshot(contract.snapshot)
  if (!snapshot) notFound()

  const paymentRows = snapshot.payment.schedule.length > 0
    ? snapshot.payment.schedule
    : Array.from({ length: snapshot.payment.installmentCount }, (_, index) => ({
        number: index + 1,
        type: 'INSTALLMENT',
        amount: snapshot.payment.installmentValue,
        dueDate: index === 0 && snapshot.payment.firstInstallmentDate
          ? snapshot.payment.firstInstallmentDate
          : '',
      }))

  return (
    <main className="min-h-screen bg-[#EFEFEC] px-3 py-5 print:bg-white print:p-0 sm:px-6 sm:py-10">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-[#E2E0DC] bg-white shadow-[0_20px_60px_rgba(18,18,18,0.10)] print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div className="h-2 bg-[#FF6B00]" />
        <header className="flex flex-col gap-5 border-b border-[#ECE9E5] px-6 py-7 sm:flex-row sm:items-start sm:justify-between sm:px-10">
          <div className="flex items-center gap-3">
            <Image
              src="/vertex-symbol.png"
              alt="Vertex Móveis"
              width={56}
              height={40}
              className="h-10 w-auto"
              style={{ width: 'auto' }}
              priority
            />
            <div>
              <p className="text-lg font-extrabold text-[#121212]">{snapshot.company.tradeName}</p>
              <p className="text-xs font-semibold uppercase text-[#777]">Móveis planejados</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-bold uppercase text-[#FF6B00]">Contrato de fornecimento</p>
            <h1 className="mt-1 text-xl font-extrabold text-[#121212]">Versão {contract.version}</h1>
            <p className="mt-1 text-xs text-[#777]">Emitido em {formatDateOnly(contract.createdAt)}</p>
          </div>
        </header>

        <div className="space-y-8 px-6 py-8 sm:px-10">
          <section>
            <p className="text-[11px] font-bold uppercase text-[#FF6B00]">Projeto contratado</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#121212]">{snapshot.project.name}</h2>
            <p className="mt-2 text-sm leading-6 text-[#666]">
              Preparado para <strong className="text-[#121212]">{snapshot.client.name}</strong>.
              {snapshot.project.environments.length > 0
                ? ` Ambientes: ${snapshot.project.environments.join(', ')}.`
                : ''}
            </p>
          </section>

          <section className="grid overflow-hidden rounded-lg border border-[#E8E8E8] sm:grid-cols-2">
            <Party
              title="Contratada"
              name={snapshot.company.legalName || snapshot.company.tradeName}
              document={snapshot.company.document}
              phone={snapshot.company.phone}
              email={snapshot.company.email}
              address={snapshot.company.address}
            />
            <Party
              title="Cliente"
              name={snapshot.client.name}
              document={snapshot.client.document}
              phone={snapshot.client.phone}
              email={snapshot.client.email}
              address={snapshot.client.address}
              className="border-t sm:border-l sm:border-t-0"
            />
          </section>

          <section>
            <h2 className="text-base font-bold text-[#121212]">Resumo comercial</h2>
            <div className="mt-3 grid overflow-hidden rounded-lg border border-[#E8E8E8] sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Investimento total" value={formatCurrency(snapshot.project.value)} strong />
              <Metric
                label="Forma combinada"
                value={snapshot.payment.methodLabel || snapshot.payment.summary || 'A combinar'}
              />
              <Metric
                label="Entrada"
                value={snapshot.payment.downPayment > 0
                  ? formatCurrency(snapshot.payment.downPayment)
                  : 'Sem entrada registrada'}
              />
              <Metric
                label="Prazo"
                value={`${snapshot.project.deliveryBusinessDays} dias úteis`}
              />
            </div>
          </section>

          {paymentRows.length > 0 ? (
            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-bold text-[#121212]">Pagamento</h2>
                <p className="text-xs text-[#777]">{paymentRows.length} parcela{paymentRows.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="mt-3 overflow-hidden rounded-lg border border-[#E8E8E8]">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-[#F7F7F5] px-4 py-2 text-[10px] font-bold uppercase text-[#777]">
                  <span>Lançamento</span>
                  <span>Vencimento</span>
                  <span className="text-right">Valor</span>
                </div>
                {paymentRows.map((payment) => (
                  <div
                    key={`${payment.type}-${payment.number}`}
                    className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-[#EFEFEF] px-4 py-3 text-sm"
                  >
                    <span className="font-semibold text-[#121212]">
                      {payment.type === 'DOWN_PAYMENT' ? 'Entrada' : `Parcela ${payment.number}`}
                    </span>
                    <span className="text-[#666]">{payment.dueDate ? formatDateOnly(payment.dueDate) : 'A combinar'}</span>
                    <strong className="text-right text-[#121212]">{formatCurrency(payment.amount)}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="text-base font-bold text-[#121212]">Condições registradas</h2>
            <div className="mt-3 divide-y divide-[#EFEFEF] rounded-lg border border-[#E8E8E8]">
              {snapshot.terms.map((term, index) => (
                <div key={term.title} className="grid gap-2 px-4 py-4 sm:grid-cols-[28px_160px_1fr]">
                  <span className="text-sm font-bold text-[#FF6B00]">{index + 1}.</span>
                  <h3 className="text-sm font-bold text-[#121212]">{term.title}</h3>
                  <p className="text-sm leading-6 text-[#666]">{term.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border-2 border-[#121212] p-5">
            <ContractAcceptanceActions
              token={token}
              initialSignedAt={contract.signedAt?.toISOString() || null}
              initialSignatoryName={contract.signatoryName}
              disabledMessage={contractState(contract)}
            />
          </section>

          <p className="text-xs leading-5 text-[#777]">
            Este aceite eletrônico registra a concordância do cliente no sistema da Vertex Móveis.
            Ele não substitui uma assinatura digital certificada pela ICP-Brasil quando essa modalidade
            for exigida pelas partes.
          </p>
        </div>

        <footer className="flex flex-col gap-1 border-t border-[#ECE9E5] px-6 py-5 text-xs text-[#777] sm:flex-row sm:justify-between sm:px-10">
          <p>{snapshot.company.tradeName}{snapshot.company.address ? ` · ${snapshot.company.address}` : ''}</p>
          <p>Contrato {snapshot.project.id.slice(-8).toUpperCase()} · versão {contract.version}</p>
        </footer>
      </article>
    </main>
  )
}

function Party({
  title,
  name,
  document,
  phone,
  email,
  address,
  className = '',
}: {
  title: string
  name: string
  document: string | null
  phone: string | null
  email: string | null
  address: string | null
  className?: string
}) {
  return (
    <div className={`border-[#E8E8E8] p-4 ${className}`}>
      <p className="text-[10px] font-bold uppercase text-[#888]">{title}</p>
      <p className="mt-1 font-bold text-[#121212]">{name}</p>
      <div className="mt-2 space-y-1 text-xs leading-5 text-[#666]">
        {document ? <p>Documento: {document}</p> : null}
        {phone ? <p>Telefone: {phone}</p> : null}
        {email ? <p>E-mail: {email}</p> : null}
        {address ? <p>Endereço: {address}</p> : null}
      </div>
    </div>
  )
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`border-b border-[#E8E8E8] px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${strong ? 'bg-[#121212] text-white' : ''}`}>
      <p className={`text-[10px] font-bold uppercase ${strong ? 'text-white/60' : 'text-[#888]'}`}>{label}</p>
      <p className={`mt-1 font-extrabold ${strong ? 'text-[#FF9A52]' : 'text-[#121212]'}`}>{value}</p>
    </div>
  )
}
