export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql, type Sql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isForeignKeyViolation } from '@/lib/db-errors'
import { requireSession } from '@/lib/auth-guard'

// SELECT 공통부 — 문자열을 그대로 끼워 넣지 않고 프래그먼트로 합성한다
const securityWithLabels = (sql: Sql) => sql`
  SELECT s.id, s.ticker, s.name, s.style, s.url, s.memo, s.created_at,
         s.fixed_price, s.annual_rate, s.accrual_start, s.maturity_date, s.archived_at,
         s.asset_class_id, s.country_id, s.sector_id, s.style_id, s.currency_id,
         ac.value AS asset_class,
         co.value AS country,
         se.value AS sector,
         es.value AS etf_style,
         cu.value AS currency,
         COALESCE(tg.tags, '{}') AS tags
  FROM securities s
  LEFT JOIN option_list ac ON s.asset_class_id = ac.id
  LEFT JOIN option_list co ON s.country_id      = co.id
  LEFT JOIN option_list se ON s.sector_id       = se.id
  LEFT JOIN option_list es ON s.style_id        = es.id
  LEFT JOIN option_list cu ON s.currency_id     = cu.id
  LEFT JOIN (
    SELECT security_id, array_agg(tag ORDER BY tag) AS tags
    FROM security_tags GROUP BY security_id
  ) tg ON tg.security_id = s.id
`

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  const sql = getSql()
  const data = await sql`${securityWithLabels(sql)} ORDER BY s.ticker`
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    ticker, name, style, url, memo, fixed_price, annual_rate, accrual_start, maturity_date,
    asset_class_id, country_id, sector_id, currency_id, style_id,
  } = await req.json()
  const sql = getSql()

  const [row] = await sql`
    INSERT INTO securities (ticker, name, style, url, memo, fixed_price, annual_rate, accrual_start, maturity_date, asset_class_id, country_id, sector_id, currency_id, style_id)
    VALUES (${ticker}, ${name}, ${style ?? null}, ${url ?? null}, ${memo ?? null}, ${fixed_price ?? null},
            ${annual_rate ?? null}, ${accrual_start ?? null}, ${maturity_date ?? null},
            ${asset_class_id ?? null}, ${country_id ?? null}, ${sector_id ?? null}, ${currency_id ?? null}, ${style_id ?? null})
    ON CONFLICT (ticker) DO UPDATE SET
      name          = EXCLUDED.name,
      style         = EXCLUDED.style,
      url           = EXCLUDED.url,
      memo          = EXCLUDED.memo,
      fixed_price   = EXCLUDED.fixed_price,
      annual_rate   = EXCLUDED.annual_rate,
      accrual_start = EXCLUDED.accrual_start,
      maturity_date = EXCLUDED.maturity_date,
      asset_class_id = EXCLUDED.asset_class_id,
      country_id    = EXCLUDED.country_id,
      sector_id     = EXCLUDED.sector_id,
      currency_id   = EXCLUDED.currency_id,
      style_id      = EXCLUDED.style_id
    RETURNING id
  `
  if (!row) return NextResponse.json({ error: '생성 실패' }, { status: 500 })
  const [full] = await sql`${securityWithLabels(sql)} WHERE s.id = ${row.id}`
  return NextResponse.json(full, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const sql = getSql()

  const allowed = ['name', 'style', 'url', 'memo', 'fixed_price', 'annual_rate', 'accrual_start', 'maturity_date', 'archived_at', 'asset_class_id', 'country_id', 'sector_id', 'currency_id', 'style_id']
  const fields = Object.entries(updates)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) => sql`${sql(k)} = ${v as string}`)

  if (fields.length === 0) return NextResponse.json({ error: 'no fields' }, { status: 400 })
  const setClauses = fields.reduce((a, b) => sql`${a}, ${b}`)
  await sql`UPDATE securities SET ${setClauses} WHERE id = ${id}`

  const [full] = await sql`${securityWithLabels(sql)} WHERE s.id = ${id}`
  return NextResponse.json(full)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const sql = getSql()
  try {
    await sql`DELETE FROM securities WHERE id = ${id}`
  } catch (e) {
    // 스냅샷 보유내역·배당·입출금 이력이 있으면 FK RESTRICT로 거부된다 (이력 보호)
    if (isForeignKeyViolation(e)) {
      return NextResponse.json(
        { error: '스냅샷·배당 기록이 있는 종목은 삭제할 수 없습니다. 대신 “보관”하면 목록에서 숨겨집니다.' },
        { status: 409 },
      )
    }
    throw e
  }
  return NextResponse.json({ ok: true })
}
