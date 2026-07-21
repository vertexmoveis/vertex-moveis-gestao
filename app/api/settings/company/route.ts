import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { COMPANY_PROFILE_ID, DEFAULT_COMPANY_PROFILE, serializeCompanyProfile } from '@/lib/company-profile'
import { badRequest, requireAuth, requireRole, serverError } from '@/lib/security'

const optionalText = (max: number) => z.preprocess(
  (value) => value === '' ? null : value,
  z.string().trim().max(max).nullable().optional()
).transform((value) => value || null)

const companyProfileSchema = z.object({
  tradeName: z.string().trim().min(2, 'Informe o nome da empresa').max(120),
  legalName: optionalText(160),
  document: optionalText(30),
  phone: optionalText(30),
  email: z.preprocess(
    (value) => value === '' ? null : value,
    z.string().trim().email('Informe um e-mail válido').max(160).nullable().optional()
  ).transform((value) => value || null),
  street: optionalText(160),
  number: optionalText(30),
  complement: optionalText(100),
  neighborhood: optionalText(100),
  city: optionalText(100),
  state: optionalText(40),
  zipCode: optionalText(20),
  defaultDeliveryBusinessDays: z.coerce.number().int().min(1).max(365),
}).strict()

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const profile = await prisma.companyProfile.findUnique({ where: { id: COMPANY_PROFILE_ID } })
  return NextResponse.json(serializeCompanyProfile(profile))
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole(['ADMIN'])
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest('Dados inválidos')
  }

  const parsed = companyProfileSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || 'Dados inválidos')

  try {
    const profile = await prisma.companyProfile.upsert({
      where: { id: COMPANY_PROFILE_ID },
      update: parsed.data,
      create: { ...DEFAULT_COMPANY_PROFILE, ...parsed.data, id: COMPANY_PROFILE_ID },
    })
    return NextResponse.json(serializeCompanyProfile(profile))
  } catch {
    return serverError()
  }
}
