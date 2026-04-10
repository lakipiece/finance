export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC`
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, broker, owner, type, currency } = await req.json()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO accounts (name, broker, owner, type, currency)
    VALUES (${name}, ${broker}, ${owner ?? null}, ${type ?? null}, ${currency ?? 'KRW'})
    RETURNING *
  `
  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const sql = getSql()

  const allowed = ['name', 'broker', 'owner', 'type', 'currency']
  const fields = Object.entries(updates)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) => sql`${sql(k)} = ${v as any}`)

  if (fields.length === 0) return NextResponse.json({ error: 'no fields' }, { status: 400 })

  const setClauses = fields.reduce((a, b) => sql`${a}, ${b}`)
  const [row] = await sql`UPDATE accounts SET ${setClauses} WHERE id = ${id} RETURNING *`
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const sql = getSql()
  await sql`DELETE FROM accounts WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
