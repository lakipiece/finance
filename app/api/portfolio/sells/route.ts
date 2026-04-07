import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`
    SELECT sl.*,
      json_build_object('ticker', s.ticker, 'name', s.name) as security,
      json_build_object('name', a.name, 'broker', a.broker) as account
    FROM sells sl
    JOIN securities s ON s.id = sl.security_id
    JOIN accounts a ON a.id = sl.account_id
    ORDER BY sl.sold_at DESC
  `
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { security_id, account_id, sold_at, quantity, avg_cost_krw, sell_price_krw, realized_pnl_krw, memo } = await req.json()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO sells (security_id, account_id, sold_at, quantity, avg_cost_krw, sell_price_krw, realized_pnl_krw, memo)
    VALUES (${security_id}, ${account_id}, ${sold_at}, ${quantity}, ${avg_cost_krw ?? null}, ${sell_price_krw ?? null}, ${realized_pnl_krw ?? null}, ${memo ?? null})
    RETURNING *
  `
  return NextResponse.json(row, { status: 201 })
}
