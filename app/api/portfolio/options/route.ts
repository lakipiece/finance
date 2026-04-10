export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

type OptionRow = { id: string; type: string; label: string; value: string; color_hex: string | null; sort_order: number }

export async function GET() {
  const sql = getSql()
  const rows = await sql<OptionRow[]>`
    SELECT * FROM option_list ORDER BY type, sort_order, label
  `
  const grouped: Record<string, OptionRow[]> = {}
  for (const r of rows) {
    if (!grouped[r.type]) grouped[r.type] = []
    grouped[r.type].push(r)
  }
  return NextResponse.json(grouped)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { type, label, value, color_hex } = await req.json()
  const sql = getSql()
  const [{ max }] = await sql<{ max: number }[]>`
    SELECT COALESCE(MAX(sort_order), -1) as max FROM option_list WHERE type = ${type}
  `
  const [row] = await sql`
    INSERT INTO option_list (type, label, value, color_hex, sort_order)
    VALUES (${type}, ${label}, ${value}, ${color_hex ?? null}, ${Number(max) + 1})
    ON CONFLICT (type, value) DO NOTHING
    RETURNING *
  `
  if (!row) return NextResponse.json({ error: '이미 존재하는 값입니다' }, { status: 409 })
  return NextResponse.json(row, { status: 201 })
}
