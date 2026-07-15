import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { ProjectEnvironmentData, ProjectEnvironmentStatus } from '@/types'

export const PROJECT_ENVIRONMENT_STATUSES: ProjectEnvironmentStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'READY',
  'INSTALLED',
  'COMPLETED',
]

export const PROJECT_ENVIRONMENT_WORKFLOW_STATUSES: ProjectEnvironmentStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'READY',
  'COMPLETED',
]

type RawEnvironment = {
  id: string
  name: string
  status: string
  position: number
  notes: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt?: Date
  updatedAt?: Date
}

export function normalizeEnvironmentNames(value: unknown, fallbackRoom?: string | null) {
  const rawNames =
    Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(/[,;\n]+/)
        : fallbackRoom
          ? fallbackRoom.split(/[,;\n]+/)
          : []

  const seen = new Set<string>()
  const names: string[] = []

  for (const raw of rawNames) {
    if (typeof raw !== 'string') continue
    const name = raw.trim().replace(/\s+/g, ' ')
    const key = name.toLocaleLowerCase('pt-BR')
    if (!name || seen.has(key)) continue
    seen.add(key)
    names.push(name.slice(0, 120))
  }

  return names.slice(0, 60)
}

export function serializeEnvironment(environment: RawEnvironment): ProjectEnvironmentData {
  return {
    id: environment.id,
    name: environment.name,
    status: environment.status as ProjectEnvironmentStatus,
    position: environment.position,
    notes: environment.notes,
    startedAt: environment.startedAt?.toISOString() || null,
    completedAt: environment.completedAt?.toISOString() || null,
    createdAt: environment.createdAt?.toISOString(),
    updatedAt: environment.updatedAt?.toISOString(),
  }
}

export function isEnvironmentCompleted(status: string) {
  return status === 'COMPLETED' || status === 'INSTALLED'
}

export function summarizeEnvironments(environments: { status: string }[]) {
  return {
    total: environments.length,
    completed: environments.filter((environment) => isEnvironmentCompleted(environment.status)).length,
  }
}

export async function ensureProjectEnvironmentsFromRoom(projectId: string, room?: string | null) {
  const existingCount = await prisma.projectEnvironment.count({ where: { projectId } })
  if (existingCount > 0) {
    return prisma.projectEnvironment.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    })
  }

  const names = normalizeEnvironmentNames(undefined, room)
  if (names.length === 0) return []

  await prisma.projectEnvironment.createMany({
    data: names.map((name, index) => ({
      projectId,
      name,
      position: index + 1,
      status: 'PENDING',
    })),
  })

  return prisma.projectEnvironment.findMany({
    where: { projectId },
    orderBy: { position: 'asc' },
  })
}

export async function syncProjectEnvironments(
  projectId: string,
  value: unknown,
  fallbackRoom?: string | null,
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  const names = normalizeEnvironmentNames(value, fallbackRoom)

  if (names.length === 0) {
    await db.projectEnvironment.deleteMany({ where: { projectId } })
    return []
  }

  const existing = await db.projectEnvironment.findMany({ where: { projectId } })
  const existingByName = new Map(existing.map((environment) => [environment.name.toLocaleLowerCase('pt-BR'), environment]))
  const keptIds = names
    .map((name) => existingByName.get(name.toLocaleLowerCase('pt-BR'))?.id)
    .filter((id): id is string => Boolean(id))

  await db.projectEnvironment.deleteMany({
    where: {
      projectId,
      ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
    },
  })

  await Promise.all(
    keptIds.map((id, index) =>
      db.projectEnvironment.update({
        where: { id },
        data: { position: 1000 + index },
      })
    )
  )

  for (const [index, name] of names.entries()) {
    const key = name.toLocaleLowerCase('pt-BR')
    const current = existingByName.get(key)

    if (current) {
      await db.projectEnvironment.update({
        where: { id: current.id },
        data: { name, position: index + 1 },
      })
    } else {
      await db.projectEnvironment.create({
        data: {
          projectId,
          name,
          position: index + 1,
          status: 'PENDING',
        },
      })
    }
  }

  return db.projectEnvironment.findMany({
    where: { projectId },
    orderBy: { position: 'asc' },
  })
}
