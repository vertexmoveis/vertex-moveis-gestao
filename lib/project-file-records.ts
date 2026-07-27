import { prisma } from '@/lib/db'
import { PROJECT_FILE_CATEGORY_LABELS, type ProjectFileCategory } from '@/lib/project-files'
import { projectFileExpiryDate, type ProjectFileSecurityStatus } from '@/lib/project-file-security'

type ProjectFileRecordInput = {
  projectId: string
  name: string
  type: string
  category: ProjectFileCategory
  url: string
  size?: number | null
  securityStatus?: ProjectFileSecurityStatus
  securityDetails?: string | null
  securityCheckedAt?: Date | null
  expiresAt?: Date | null
}

function serializeProjectFile(file: {
  id: string
  projectId: string
  name: string
  type: string
  category: string
  url: string
  size: number | null
  securityStatus: string
  securityDetails: string | null
  securityCheckedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}) {
  return {
    ...file,
    securityCheckedAt: file.securityCheckedAt?.toISOString() || null,
    expiresAt: file.expiresAt?.toISOString() || null,
    createdAt: file.createdAt.toISOString(),
  }
}

export async function recordProjectFile(input: ProjectFileRecordInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.projectFile.findUnique({
      where: { projectId_url: { projectId: input.projectId, url: input.url } },
    })
    if (existing) {
      const file = await tx.projectFile.update({
        where: { id: existing.id },
        data: {
          ...(input.size !== undefined && input.size !== null ? { size: input.size } : {}),
          ...(input.securityStatus ? { securityStatus: input.securityStatus } : {}),
          ...(input.securityDetails !== undefined ? { securityDetails: input.securityDetails } : {}),
          ...(input.securityCheckedAt !== undefined ? { securityCheckedAt: input.securityCheckedAt } : {}),
          ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
        },
      })
      return serializeProjectFile(file)
    }

    try {
      const file = await tx.projectFile.create({
        data: {
          ...input,
          expiresAt: input.expiresAt === undefined ? projectFileExpiryDate() : input.expiresAt,
        },
      })
      await tx.timelineEvent.create({
        data: {
          projectId: input.projectId,
          event: 'Arquivo adicionado',
          description: `${PROJECT_FILE_CATEGORY_LABELS[input.category]}: ${input.name}`,
        },
      })
      return serializeProjectFile(file)
    } catch (error) {
      if (!isProjectFileDuplicateError(error)) throw error
      const duplicate = await tx.projectFile.findUnique({
        where: { projectId_url: { projectId: input.projectId, url: input.url } },
      })
      if (!duplicate) throw error
      return serializeProjectFile(duplicate)
    }
  })
}

function isProjectFileDuplicateError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}
