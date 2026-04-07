export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`SELECT * FROM securities ORDER BY ticker`
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker, name, asset_class, country, style, sector, currency, url, memo } = await req.json()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO securities (ticker, name, asset_class, country, style, sector, currency, url, memo)
    VALUES (${ticker}, ${name}, ${asset_class ?? null}, ${country ?? null}, ${style ?? null}, ${sector ?? null}, ${currency ?? 'USD'}, ${url ?? null}, ${memo ?? null})
    ON CONFLICT (ticker) DO UPDATE SET
      name = EXCLUDED.name,
      asset_class = EXCLUDED.asset_class,
      country = EXCLUDED.country,
      style = EXCLUDED.style,
      sector = EXCLUDED.sector,
      currency = EXCLUDED.currency,
      url = EXCLUDED.url,
      memo = EXCLUDED.memo
    RETURNING *
  `
  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const sql = getSql()
  const allowed = ['name', 'asset_class', 'country', 'style', 'sector', 'currency', 'url', 'memo']
  const fields = Object.entries(updates)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) => sql`${sql(k)} = ${v as any}`)

  if (fields.length === 0) return NextResponse.json({ error: 'no fields' }, { status: 400 })
  const setClauses = fields.reduce((a, b) => sql`${a}, ${b}`)
  const [row] = await sql`UPDATE securities SET ${setClauses} WHERE id = ${id} RETURNING *`
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const sql = getSql()
  await sql`DELETE FROM securities WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
