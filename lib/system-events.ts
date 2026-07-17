import { prisma } from './db'
import type { Prisma } from '@prisma/client'

type SystemEventInput = {
  type: string
  severity?: 'INFO' | 'WARNING' | 'ERROR'
  source: string
  message: string
  details?: Prisma.InputJsonValue
}

function sanitizeMessage(value: string) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[conexao removida]')
    .replace(/(password|token|secret)=([^&\s]+)/gi, '$1=[removido]')
    .slice(0, 1000)
}

export async function recordSystemEvent(input: SystemEventInput) {
  try {
    await prisma.systemEvent.create({
      data: {
        type: input.type.slice(0, 80),
        severity: input.severity || 'INFO',
        source: input.source.slice(0, 120),
        message: sanitizeMessage(input.message),
        details: input.details,
      },
    })
  } catch (error) {
    console.error('Nao foi possivel registrar o evento do sistema.', error)
  }
}
