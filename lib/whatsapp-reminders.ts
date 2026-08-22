import { prisma } from '@/lib/db'
import { dateOnlyKeyInTimeZone, formatDateOnly } from '@/lib/date-only'
import { dispatchWhatsAppTemplate } from '@/lib/whatsapp-cloud'
import { moneyValue, type NumericValue } from '@/lib/money'
import { syncClientRelationshipStage } from '@/lib/client-relationship'
import { decryptProjectContractToken, projectContractUrl } from '@/lib/project-contracts'
import { getContractReminderSequence } from '@/lib/contract-center'

const DAY_MS = 24 * 60 * 60 * 1000

function addDays(date: Date, days: number) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}

function dateKey(date: Date) {
  return dateOnlyKeyInTimeZone(date)
}

function periodKey(date: Date, days: number) {
  return Math.floor(date.getTime() / (days * DAY_MS))
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(value)
}

function formatMoney(value: NumericValue) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(moneyValue(value))
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, callback: (item: T) => Promise<R>) {
  const results: R[] = []
  let index = 0
  async function worker() {
    while (index < items.length) {
      const current = items[index]
      index += 1
      results.push(await callback(current))
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

export async function runAutomatedWhatsAppReminders(input: {
  today: Date
  origin: string
  quoteReminderDays?: number
}) {
  const quoteReminderDays = input.quoteReminderDays ?? 3
  const reminderCutoff = addDays(input.today, -quoteReminderDays)
  const tomorrow = addDays(input.today, 1)
  const dayAfterTomorrow = addDays(input.today, 2)
  const [quoteRequests, overduePayments, installations, contractRows, postSaleProjects] = await Promise.all([
    prisma.quoteApprovalRequest.findMany({
      where: {
        approvedAt: null,
        rejectedAt: null,
        invalidatedAt: null,
        sentAt: { lte: reminderCutoff },
        OR: [{ lastReminderAt: null }, { lastReminderAt: { lte: reminderCutoff } }],
        quote: { archivedAt: null, status: 'WAITING_APPROVAL' },
      },
      orderBy: { sentAt: 'asc' },
      take: 15,
      select: {
        id: true,
        token: true,
        sentAt: true,
        quote: {
          select: {
            id: true,
            title: true,
            client: { select: { id: true, name: true, whatsapp: true, phone: true } },
          },
        },
      },
    }),
    prisma.projectPayment.findMany({
      where: {
        paidAt: null,
        dueDate: { lt: input.today },
        project: { archivedAt: null },
      },
      orderBy: { dueDate: 'asc' },
      take: 15,
      select: {
        id: true,
        amount: true,
        dueDate: true,
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { name: true, whatsapp: true, phone: true } },
          },
        },
      },
    }),
    prisma.installationSchedule.findMany({
      where: {
        scheduledStart: { gte: tomorrow, lt: dayAfterTomorrow },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        project: { archivedAt: null },
      },
      orderBy: { scheduledStart: 'asc' },
      take: 15,
      select: {
        id: true,
        scheduledStart: true,
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { name: true, whatsapp: true, phone: true } },
          },
        },
      },
    }),
    prisma.projectContract.findMany({
      where: {
        projectId: { not: null },
        status: 'SENT',
        signedAt: null,
        voidedAt: null,
        sentAt: { not: null },
        reminderCount: { lt: 3 },
        project: {
          archivedAt: null,
          stage: { not: 'COMPLETED' },
          contractRequirement: { not: 'WAIVED' },
        },
      },
      orderBy: { sentAt: 'asc' },
      take: 30,
      select: {
        id: true,
        version: true,
        tokenEncrypted: true,
        sentAt: true,
        lastReminderAt: true,
        reminderCount: true,
        expiresAt: true,
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { name: true, whatsapp: true, phone: true } },
          },
        },
      },
    }),
    prisma.project.findMany({
      where: {
        archivedAt: null,
        stage: 'COMPLETED',
        postSaleFollowUpAt: { lte: input.today },
        postSaleContactedAt: null,
      },
      orderBy: { postSaleFollowUpAt: 'asc' },
      take: 15,
      select: {
        id: true,
        name: true,
        client: { select: { name: true, whatsapp: true, phone: true } },
      },
    }),
  ])

  const contracts = contractRows.flatMap((contract) => {
    if (!contract.project || !contract.sentAt || (contract.expiresAt && contract.expiresAt < input.today)) return []
    const sequence = getContractReminderSequence({
      sentAt: contract.sentAt,
      reminderCount: contract.reminderCount,
      lastReminderAt: contract.lastReminderAt,
      now: input.today,
    })
    if (!sequence) return []
    try {
      return [{
        ...contract,
        project: contract.project,
        sequence,
        url: projectContractUrl(input.origin, decryptProjectContractToken(contract.tokenEncrypted)),
      }]
    } catch {
      return []
    }
  })

  type ReminderJob = {
    kind: 'quote' | 'payment' | 'installation' | 'contract' | 'postSale'
    run: () => ReturnType<typeof dispatchWhatsAppTemplate>
    onSent?: () => Promise<unknown>
  }

  const jobs: ReminderJob[] = [
    ...quoteRequests.map((request) => ({
      kind: 'quote' as const,
      run: () => dispatchWhatsAppTemplate({
        dedupeKey: `quote-reminder:${request.id}:${periodKey(input.today, quoteReminderDays)}`,
        kind: 'QUOTE_REMINDER',
        phone: request.quote.client.whatsapp || request.quote.client.phone,
        clientName: request.quote.client.name,
        quoteId: request.quote.id,
        bodyParameters: [
          request.quote.client.name,
          request.quote.title,
          `${input.origin.replace(/\/$/, '')}/proposta/${request.token}`,
        ],
      }),
      onSent: () => prisma.$transaction(async (tx) => {
        const now = new Date()
        await tx.quoteApprovalRequest.update({
          where: { id: request.id },
          data: { reminderCount: { increment: 1 }, lastReminderAt: now },
        })
        await syncClientRelationshipStage(tx, request.quote.client.id, { activityAt: now })
      }),
    })),
    ...overduePayments.map((payment) => ({
      kind: 'payment' as const,
      run: () => dispatchWhatsAppTemplate({
        dedupeKey: `payment-reminder:${payment.id}:${periodKey(input.today, 7)}`,
        kind: 'PAYMENT_REMINDER',
        phone: payment.project.client.whatsapp || payment.project.client.phone,
        clientName: payment.project.client.name,
        projectId: payment.project.id,
        paymentId: payment.id,
        bodyParameters: [
          payment.project.client.name,
          payment.project.name,
          formatMoney(payment.amount),
          formatDateOnly(payment.dueDate),
        ],
      }),
    })),
    ...installations.map((installation) => ({
      kind: 'installation' as const,
      run: () => dispatchWhatsAppTemplate({
        dedupeKey: `installation-reminder:${installation.id}:${dateKey(installation.scheduledStart)}`,
        kind: 'INSTALLATION_REMINDER',
        phone: installation.project.client.whatsapp || installation.project.client.phone,
        clientName: installation.project.client.name,
        projectId: installation.project.id,
        bodyParameters: [
          installation.project.client.name,
          installation.project.name,
          formatDateTime(installation.scheduledStart),
        ],
      }),
    })),
    ...contracts.map((contract) => ({
      kind: 'contract' as const,
      run: () => dispatchWhatsAppTemplate({
        dedupeKey: `contract-reminder:${contract.id}:${contract.sequence}`,
        kind: 'CONTRACT_REMINDER',
        phone: contract.project.client.whatsapp || contract.project.client.phone,
        clientName: contract.project.client.name,
        projectId: contract.project.id,
        bodyParameters: [
          contract.project.client.name,
          contract.project.name,
          contract.url,
        ],
      }),
      onSent: () => prisma.$transaction(async (tx) => {
        const now = new Date()
        const updated = await tx.projectContract.updateMany({
          where: {
            id: contract.id,
            status: 'SENT',
            signedAt: null,
            voidedAt: null,
            reminderCount: contract.reminderCount,
          },
          data: { reminderCount: { increment: 1 }, lastReminderAt: now },
        })
        if (updated.count !== 1) return
        await tx.timelineEvent.create({
          data: {
            projectId: contract.project.id,
            event: 'Lembrete automático de contrato',
            description: `Lembrete ${contract.sequence} enviado para o contrato versão ${contract.version}.`,
          },
        })
        await tx.activityLog.create({
          data: {
            projectId: contract.project.id,
            action: 'Lembrete automático de contrato enviado',
            details: `Contrato versão ${contract.version}; lembrete ${contract.sequence}.`,
          },
        })
      }),
    })),
    ...postSaleProjects.map((project) => ({
      kind: 'postSale' as const,
      run: () => dispatchWhatsAppTemplate({
        dedupeKey: `post-sale:${project.id}`,
        kind: 'POST_SALE',
        phone: project.client.whatsapp || project.client.phone,
        clientName: project.client.name,
        projectId: project.id,
        bodyParameters: [project.client.name, project.name],
      }),
      onSent: () => prisma.project.update({
        where: { id: project.id },
        data: { postSaleContactedAt: new Date() },
      }),
    })),
  ]

  const outcomes = await mapWithConcurrency(jobs, 4, async (job) => ({
    job,
    result: await job.run(),
  }))

  await Promise.all(
    outcomes
      .filter(({ job, result }) => result.status === 'sent' && job.onSent)
      .map(({ job }) => job.onSent!()),
  )

  const count = (status: string) => outcomes.filter((outcome) => outcome.result.status === status).length
  return {
    candidates: jobs.length,
    sent: count('sent'),
    failed: count('failed'),
    skipped: count('skipped'),
    duplicates: count('duplicate'),
    byKind: {
      quote: quoteRequests.length,
      payment: overduePayments.length,
      installation: installations.length,
      contract: contracts.length,
      postSale: postSaleProjects.length,
    },
  }
}
