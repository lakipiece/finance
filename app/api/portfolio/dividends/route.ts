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

  try {
    const { security_id, account_id, paid_at, amount, currency, exchange_rate, tax, memo } = await req.json()

    if (!security_id || !account_id || !paid_at || !amount) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }

    const sql = getSql()
    const [row] = await sql`
      INSERT INTO dividends (security_id, account_id, paid_at, amount, currency, exchange_rate, tax, memo)
      VALUES (${security_id}, ${account_id}, ${paid_at}, ${Number(amount)}, ${currency ?? 'KRW'}, ${Number(exchange_rate) || 1}, ${Number(tax) || 0}, ${memo ?? null})
      RETURNING *
    `
    return NextResponse.json(row, { status: 201 })
  } catch (e: any) {
    console.error('[dividends POST]', e?.message ?? e)
    return NextResponse.json({ error: e?.message ?? '저장 실패' }, { status: 500 })
  }
}
