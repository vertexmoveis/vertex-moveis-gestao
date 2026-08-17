import type { Metadata } from 'next'
import Image from 'next/image'
import { ExternalLink, FileText } from 'lucide-react'
import { notFound } from 'next/navigation'
import { ContractAcceptanceActions } from '@/components/contracts/contract-acceptance-actions'
import { prisma } from '@/lib/db'
import { hashProjectContractToken, parseProjectContractSnapshot } from '@/lib/project-contracts'
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

  const pdfUrl = `/api/public/contracts/${token}/document?v=${contract.signedAt?.getTime() || contract.version}`

  return (
    <main className="min-h-screen bg-[#EFEFEC] px-3 py-5 sm:px-6 sm:py-10">
      <article className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-[#E2E0DC] bg-white shadow-[0_20px_60px_rgba(18,18,18,0.10)]">
        <div className="h-2 bg-[#FF6B00]" />
        <header className="flex flex-col gap-5 border-b border-[#ECE9E5] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
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
              <p className="text-xs font-semibold uppercase text-[#777]">Contrato de fornecimento</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-bold uppercase text-[#FF6B00]">
              {contract.signedAt ? 'Contrato aceito' : 'Documento para assinatura'}
            </p>
            <h1 className="mt-1 text-xl font-extrabold text-[#121212]">{snapshot.project.name}</h1>
            <p className="mt-1 text-xs text-[#777]">Preparado para {snapshot.client.name}</p>
          </div>
        </header>

        <section className="border-b border-[#ECE9E5] px-5 py-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-[#121212]">Leia o contrato completo</h2>
              <p className="mt-1 text-sm leading-6 text-[#666]">
                Confira o projeto, o valor, as parcelas, o prazo e todas as condições antes de assinar.
              </p>
            </div>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#FF6B00] px-6 text-base font-bold text-white transition-colors hover:bg-[#E85F00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-2"
            >
              <FileText size={20} />
              Abrir contrato em PDF
              <ExternalLink size={16} />
            </a>
          </div>
        </section>

        <section className="hidden overflow-hidden border-b border-[#D8D8D8] bg-[#E8E8E8] sm:block">
          <iframe
            src={`${pdfUrl}#view=FitH`}
            title={`Contrato de ${snapshot.project.name} em PDF`}
            className="h-[78vh] min-h-[760px] w-full bg-white"
            loading="eager"
            referrerPolicy="no-referrer"
          />
        </section>

        <section id="assinatura" className="scroll-mt-4 px-5 py-7 sm:px-8 sm:py-9">
          <div className="rounded-lg border-2 border-[#121212] p-5 sm:p-7">
            <ContractAcceptanceActions
              token={token}
              initialSignedAt={contract.signedAt?.toISOString() || null}
              initialSignatoryName={contract.signatoryName}
              defaultSignatoryName={snapshot.client.name}
              disabledMessage={contractState(contract)}
            />
          </div>
          <p className="mt-4 text-xs leading-5 text-[#777]">
            O aceite eletrônico registra a concordância do cliente e preserva a versão deste contrato no sistema da Vertex Móveis.
          </p>
        </section>

        <footer className="flex flex-col gap-1 border-t border-[#ECE9E5] px-5 py-5 text-xs text-[#777] sm:flex-row sm:justify-between sm:px-8">
          <p>{snapshot.company.tradeName}{snapshot.company.address ? ` · ${snapshot.company.address}` : ''}</p>
          <p>Contrato {snapshot.project.id.slice(-8).toUpperCase()} · versão {contract.version}</p>
        </footer>
      </article>
    </main>
  )
}
