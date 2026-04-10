export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

const ACCOUNT_WITH_LABELS = `
  SELECT a.id, a.name, a.broker, a.owner, a.created_at, a.sort_order,
         a.type_id, a.currency_id,
         t.value  AS type,
         cu.value AS currency
  FROM accounts a
  LEFT JOIN option_list t  ON a.type_id    = t.id
  LEFT JOIN option_list cu ON a.currency_id = cu.id
`

export async function GET() {
  const sql = getSql()
  const data = await sql`${sql.unsafe(ACCOUNT_WITH_LABELS)} ORDER BY a.sort_order ASC, a.created_at ASC`
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, broker, owner, type_id } = await req.json()
  const sql = getSql()

  const [row] = await sql`
    INSERT INTO accounts (name, broker, owner, type_id, currency_id)
    VALUES (
      ${name}, ${broker}, ${owner ?? null}, ${type_id ?? null},
      (SELECT id FROM option_list WHERE type = 'currency' AND value = 'KRW' LIMIT 1)
    )
    RETURNING id
  `
  if (!row) return NextResponse.json({ error: '생성 실패' }, { status: 500 })
  const [full] = await sql`${sql.unsafe(ACCOUNT_WITH_LABELS)} WHERE a.id = ${row.id}`
  return NextResponse.json(full, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const sql = getSql()

  const allowed = ['name', 'broker', 'owner', 'type_id', 'currency_id']
  const fields = Object.entries(updates)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) => sql`${sql(k)} = ${v as string}`)

  if (fields.length === 0) return NextResponse.json({ error: 'no fields' }, { status: 400 })
  const setClauses = fields.reduce((a, b) => sql`${a}, ${b}`)
  await sql`UPDATE accounts SET ${setClauses} WHERE id = ${id}`

  const [full] = await sql`${sql.unsafe(ACCOUNT_WITH_LABELS)} WHERE a.id = ${id}`
  return NextResponse.json(full)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const sql = getSql()
  await sql`DELETE FROM accounts WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
