import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET() {
  const sql = getSql()
  const rows = await sql`SELECT DISTINCT year FROM expenses ORDER BY year DESC`
  return NextResponse.json({ years: rows.map((r: any) => r.year) })
}
