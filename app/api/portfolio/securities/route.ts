export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

const SECURITY_WITH_LABELS = `
  SELECT s.id, s.ticker, s.name, s.style, s.url, s.memo, s.created_at,
         s.asset_class_id, s.country_id, s.sector_id, s.currency_id,
         ac.value AS asset_class,
         co.value AS country,
         se.value AS sector,
         cu.value AS currency
  FROM securities s
  LEFT JOIN option_list ac ON s.asset_class_id = ac.id
  LEFT JOIN option_list co ON s.country_id      = co.id
  LEFT JOIN option_list se ON s.sector_id       = se.id
  LEFT JOIN option_list cu ON s.currency_id     = cu.id
`

export async function GET() {
  const sql = getSql()
  const data = await sql`${sql.unsafe(SECURITY_WITH_LABELS)} ORDER BY s.ticker`
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker, name, style, url, memo, asset_class_id, country_id, sector_id, currency_id } = await req.json()
  const sql = getSql()

  const [row] = await sql`
    INSERT INTO securities (ticker, name, style, url, memo, asset_class_id, country_id, sector_id, currency_id)
    VALUES (${ticker}, ${name}, ${style ?? null}, ${url ?? null}, ${memo ?? null},
            ${asset_class_id ?? null}, ${country_id ?? null}, ${sector_id ?? null}, ${currency_id ?? null})
    ON CONFLICT (ticker) DO UPDATE SET
      name          = EXCLUDED.name,
      style         = EXCLUDED.style,
      url           = EXCLUDED.url,
      memo          = EXCLUDED.memo,
      asset_class_id = EXCLUDED.asset_class_id,
      country_id    = EXCLUDED.country_id,
      sector_id     = EXCLUDED.sector_id,
      currency_id   = EXCLUDED.currency_id
    RETURNING id
  `
  if (!row) return NextResponse.json({ error: '생성 실패' }, { status: 500 })
  const [full] = await sql`${sql.unsafe(SECURITY_WITH_LABELS)} WHERE s.id = ${row.id}`
  return NextResponse.json(full, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const sql = getSql()

  const allowed = ['name', 'style', 'url', 'memo', 'asset_class_id', 'country_id', 'sector_id', 'currency_id']
  const fields = Object.entries(updates)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) => sql`${sql(k)} = ${v as string}`)

  if (fields.length === 0) return NextResponse.json({ error: 'no fields' }, { status: 400 })
  const setClauses = fields.reduce((a, b) => sql`${a}, ${b}`)
  await sql`UPDATE securities SET ${setClauses} WHERE id = ${id}`

  const [full] = await sql`${sql.unsafe(SECURITY_WITH_LABELS)} WHERE s.id = ${id}`
  return NextResponse.json(full)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const sql = getSql()
  await sql`DELETE FROM securities WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
