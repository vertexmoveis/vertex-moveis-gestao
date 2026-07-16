import { prisma } from '@/lib/db'
import { PROJECT_FILE_CATEGORY_LABELS, type ProjectFileCategory } from '@/lib/project-files'

type ProjectFileRecordInput = {
  projectId: string
  name: string
  type: string
  category: ProjectFileCategory
  url: string
  size?: number | null
}

function serializeProjectFile(file: {
  id: string
  projectId: string
  name: string
  type: string
  category: string
  url: string
  size: number | null
  createdAt: Date
}) {
  return { ...file, createdAt: file.createdAt.toISOString() }
}

export async function recordProjectFile(input: ProjectFileRecordInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.projectFile.findUnique({
      where: { projectId_url: { projectId: input.projectId, url: input.url } },
    })
    if (existing) {
      const file = existing.size === null && input.size !== null && input.size !== undefined
        ? await tx.projectFile.update({ where: { id: existing.id }, data: { size: input.size } })
        : existing
      return serializeProjectFile(file)
    }

    try {
      const file = await tx.projectFile.create({ data: input })
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
