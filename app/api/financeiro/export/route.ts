import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/security'

export async function GET(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER'])
  if (!auth.ok) return auth.response

  const destination = new URL('/api/financeiro/settlements/export', req.url)
  destination.search = req.nextUrl.search
  return NextResponse.redirect(destination)
}
