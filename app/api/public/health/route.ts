import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json(
      { status: 'ok', service: 'vertex-moveis', checkedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch {
    return NextResponse.json(
      { status: 'unavailable', service: 'vertex-moveis', checkedAt: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  }
}
