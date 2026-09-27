import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { requireSession } from '@/lib/auth-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  const sql = getSql()
  const rows = await sql`SELECT name, color FROM categories ORDER BY name`
  return NextResponse.json(rows)
}
