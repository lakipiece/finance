export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql, type Sql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { isForeignKeyViolation } from '@/lib/db-errors'
import { requireSession } from '@/lib/auth-guard'

// SELECT 공통부 — 문자열을 그대로 끼워 넣지 않고 프래그먼트로 합성한다
const accountWithLabels = (sql: Sql) => sql`
  SELECT a.id, a.name, a.broker, a.owner, a.created_at, a.sort_order,
         a.type_id, a.currency_id,
         a.dividend_eligible, a.dividend_tax_rate, a.archived_at, a.memo,
         t.value  AS type,
         cu.value AS currency
  FROM accounts a
  LEFT JOIN option_list t  ON a.type_id    = t.id
  LEFT JOIN option_list cu ON a.currency_id = cu.id
`

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  const sql = getSql()
  const data = await sql`${accountWithLabels(sql)} ORDER BY a.sort_order ASC, a.created_at ASC`
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, broker, owner, type_id, dividend_eligible = true, dividend_tax_rate = null, memo = null } = await req.json()
  const sql = getSql()

  const [row] = await sql`
    INSERT INTO accounts (name, broker, owner, type_id, currency_id, dividend_eligible, dividend_tax_rate, memo)
    VALUES (
      ${name}, ${broker}, ${owner ?? null}, ${type_id ?? null},
      (SELECT id FROM option_list WHERE type = 'currency' AND value = 'KRW' LIMIT 1),
      ${dividend_eligible}, ${dividend_tax_rate}, ${memo?.trim() || null}
    )
    RETURNING id
  `
  if (!row) return NextResponse.json({ error: '생성 실패' }, { status: 500 })
  const [full] = await sql`${accountWithLabels(sql)} WHERE a.id = ${row.id}`
  return NextResponse.json(full, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const sql = getSql()

  const allowed = ['name', 'broker', 'owner', 'type_id', 'currency_id', 'dividend_eligible', 'dividend_tax_rate', 'archived_at', 'memo']
  const fields = Object.entries(updates)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) => sql`${sql(k)} = ${v as string}`)

  if (fields.length === 0) return NextResponse.json({ error: 'no fields' }, { status: 400 })
  const setClauses = fields.reduce((a, b) => sql`${a}, ${b}`)
  await sql`UPDATE accounts SET ${setClauses} WHERE id = ${id}`

  const [full] = await sql`${accountWithLabels(sql)} WHERE a.id = ${id}`
  return NextResponse.json(full)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })
  const sql = getSql()
  try {
    await sql`DELETE FROM accounts WHERE id = ${id}`
  } catch (e) {
    // 스냅샷 보유내역·배당·입출금 이력이 있으면 FK RESTRICT로 거부된다 (이력 보호)
    if (isForeignKeyViolation(e)) {
      return NextResponse.json(
        { error: '스냅샷·배당·입출금 기록이 있는 계좌는 삭제할 수 없습니다. 대신 “보관”하면 목록에서 숨겨집니다.' },
        { status: 409 },
      )
    }
    throw e
  }
  return NextResponse.json({ ok: true })
}
