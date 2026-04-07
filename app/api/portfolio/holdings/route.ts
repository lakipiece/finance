import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`
    SELECT h.*,
      row_to_json(a) as account,
      row_to_json(s) as security
    FROM holdings h
    JOIN accounts a ON a.id = h.account_id
    JOIN securities s ON s.id = h.security_id
    ORDER BY h.updated_at DESC
  `
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_id, quantity, avg_price, total_invested, snapshot_date, snapshot_id } = await req.json()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO holdings (account_id, security_id, quantity, avg_price, total_invested, snapshot_date, snapshot_id, source, updated_at)
    VALUES (${account_id}, ${security_id}, ${quantity}, ${avg_price ?? null}, ${total_invested ?? null}, ${snapshot_date}, ${snapshot_id}, 'manual', NOW())
    ON CONFLICT (account_id, security_id, snapshot_id) DO UPDATE SET
      quantity = EXCLUDED.quantity,
      avg_price = EXCLUDED.avg_price,
      total_invested = EXCLUDED.total_invested,
      snapshot_date = EXCLUDED.snapshot_date,
      updated_at = NOW()
    RETURNING *
  `
  return NextResponse.json(row, { status: 201 })
}
