import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sql = getSql()
  const rows = await sql`SELECT name, color FROM categories ORDER BY name`
  return NextResponse.json(rows)
}
