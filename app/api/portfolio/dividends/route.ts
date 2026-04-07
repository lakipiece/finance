export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`
    SELECT d.*,
      json_build_object('ticker', s.ticker, 'name', s.name) as security,
      json_build_object('name', a.name, 'broker', a.broker) as account
    FROM dividends d
    JOIN securities s ON s.id = d.security_id
    JOIN accounts a ON a.id = d.account_id
    ORDER BY d.paid_at DESC
  `
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { security_id, account_id, paid_at, amount, currency, tax, memo } = await req.json()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO dividends (security_id, account_id, paid_at, amount, currency, tax, memo)
    VALUES (${security_id}, ${account_id}, ${paid_at}, ${amount}, ${currency ?? 'USD'}, ${tax ?? null}, ${memo ?? null})
    RETURNING *
  `
  return NextResponse.json(row, { status: 201 })
}
