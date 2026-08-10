import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID, DEFAULT_COMPANY_PROFILE, serializeCompanyProfile } from '@/lib/company-profile'
import { badRequest, requireRole, serverError } from '@/lib/security'

const presentationSchema = z.object({
  presentationEnabled: z.boolean(),
  presentationHeading: z.string().trim().min(3, 'Informe o título da apresentação.').max(120),
  presentationText: z.string().trim().min(10, 'Escreva uma apresentação um pouco mais completa.').max(320),
  presentationHighlight1: z.string().trim().min(3, 'Informe o primeiro diferencial.').max(90),
  presentationHighlight2: z.string().trim().min(3, 'Informe o segundo diferencial.').max(90),
  presentationHighlight3: z.string().trim().min(3, 'Informe o terceiro diferencial.').max(90),
}).strict()

export async function PUT(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = presentationSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados da apresentação inválidos.')

  try {
    const profile = await prisma.companyProfile.upsert({
      where: { id: COMPANY_PROFILE_ID },
      update: parsed.data,
      create: { ...DEFAULT_COMPANY_PROFILE, ...parsed.data },
    })
    return NextResponse.json(serializeCompanyProfile(profile))
  } catch {
    return serverError()
  }
}
