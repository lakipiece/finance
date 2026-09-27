export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { requireSession } from '@/lib/auth-guard'

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  const sql = getSql()
  const rows = await sql`SELECT DISTINCT year FROM expenses ORDER BY year DESC`
  return NextResponse.json(rows)
}
