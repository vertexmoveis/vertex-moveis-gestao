import type { Prisma } from '@prisma/client'
import {
  buildProjectContractSnapshot,
  createProjectContractToken,
} from '@/lib/project-contracts'

const DEFAULT_COMPANY = {
  tradeName: 'Vertex Móveis',
  street: 'Rua Saturno',
  number: '6',
  city: 'Cotia',
  state: 'SP',
  zipCode: '06702-170',
}

export async function createProjectContractRevision(
  tx: Prisma.TransactionClient,
  input: { projectId: string; userId: string; reason: string },
) {
  const [project, company, latest] = await Promise.all([
    tx.project.findUnique({
      where: { id: input.projectId },
      include: {
        client: true,
        environments: { orderBy: { position: 'asc' }, select: { name: true } },
        payments: {
          orderBy: [{ type: 'asc' }, { installmentNumber: 'asc' }],
          select: { installmentNumber: true, type: true, amount: true, dueDate: true },
        },
      },
    }),
    tx.companyProfile.findUnique({ where: { id: 'vertex' } }),
    tx.projectContract.aggregate({ where: { projectId: input.projectId }, _max: { version: true } }),
  ])
  if (!project || !project.value || Number(project.value) <= 0) {
    throw new Error('Não foi possível gerar a revisão do contrato sem um valor válido.')
  }

  const now = new Date()
  const version = (latest._max.version || 0) + 1
  const secureToken = createProjectContractToken()
  const snapshot = buildProjectContractSnapshot(project, company || DEFAULT_COMPANY)
  await tx.projectContract.updateMany({
    where: { projectId: input.projectId, status: { in: ['DRAFT', 'SENT'] }, signedAt: null, voidedAt: null },
    data: { status: 'VOID', voidedAt: now },
  })
  const contract = await tx.projectContract.create({
    data: {
      projectId: input.projectId,
      createdById: input.userId,
      version,
      status: 'SENT',
      tokenHash: secureToken.tokenHash,
      tokenEncrypted: secureToken.tokenEncrypted,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      sentAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  })
  await tx.project.update({
    where: { id: input.projectId },
    data: { contractRevisionRequiredAt: null, contractRevisionChanges: [] },
  })
  await tx.timelineEvent.create({
    data: { projectId: input.projectId, event: 'Nova versão do contrato', description: `Contrato versão ${version} gerado automaticamente. Motivo: ${input.reason}.` },
  })
  await tx.activityLog.create({
    data: { userId: input.userId, projectId: input.projectId, action: 'Revisão contratual automática', details: `Versão ${version}: ${input.reason}` },
  })
  return contract
}
