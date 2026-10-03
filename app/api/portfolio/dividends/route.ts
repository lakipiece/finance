export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { requireSession } from '@/lib/auth-guard'

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  const sql = getSql()
  const data = await sql`
    SELECT d.*,
      it.value AS income_type,
      json_build_object('ticker', s.ticker, 'name', s.name, 'currency', s.currency) as security,
      json_build_object('name', a.name, 'broker', a.broker, 'owner', a.owner, 'dividend_tax_rate', a.dividend_tax_rate, 'memo', a.memo) as account
    FROM dividends d
    LEFT JOIN securities s ON s.id = d.security_id
    LEFT JOIN option_list it ON d.income_type_id = it.id
    JOIN accounts a ON a.id = d.account_id
    ORDER BY d.paid_at DESC
  `
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { security_id, account_id, paid_at, amount, currency, exchange_rate, tax, memo, income_type_id } = await req.json()

    // 계좌 단위 이자는 종목 없이 기록할 수 있다
    if (!account_id || !paid_at || !amount) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }

    const sql = getSql()
    const [row] = await sql`
      INSERT INTO dividends (security_id, account_id, paid_at, amount, currency, exchange_rate, tax, memo, income_type_id)
      VALUES (${security_id || null}, ${account_id}, ${paid_at}, ${Number(amount)}, ${currency ?? 'KRW'}, ${Number(exchange_rate) || 1}, ${Number(tax) || 0}, ${memo ?? null}, ${income_type_id ?? null})
      RETURNING *
    `
    return NextResponse.json(row, { status: 201 })
  } catch (e: any) {
    console.error('[dividends POST]', e?.message ?? e)
    return NextResponse.json({ error: e?.message ?? '저장 실패' }, { status: 500 })
  }
}
