export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

const VALID_TYPES = ['deposit', 'withdrawal', 'opening']

// GET /api/portfolio/cashflows?account_id=&year=
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accountId = req.nextUrl.searchParams.get('account_id')
  const yearStr = req.nextUrl.searchParams.get('year')
  const year = yearStr ? parseInt(yearStr) : null

  try {
    const sql = getSql()
    const rows = await sql`
      SELECT cf.id, cf.account_id, cf.flow_date, cf.type, cf.amount, cf.memo,
        json_build_object('name', a.name, 'broker', a.broker, 'owner', a.owner) AS account
      FROM account_cashflows cf
      JOIN accounts a ON a.id = cf.account_id
      WHERE 1=1
      ${accountId ? sql`AND cf.account_id = ${accountId}` : sql``}
      ${year ? sql`AND EXTRACT(YEAR FROM cf.flow_date) = ${year}` : sql``}
      ORDER BY cf.flow_date DESC, cf.created_at DESC
    `
    return NextResponse.json(rows.map(r => ({
      ...r,
      amount: Number(r.amount),
      flow_date: r.flow_date instanceof Date ? r.flow_date.toISOString().slice(0, 10) : String(r.flow_date).slice(0, 10),
    })))
  } catch (e) {
    console.error('[GET /portfolio/cashflows]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { account_id, flow_date, type, amount, memo } = await req.json()
    const amt = Number(amount)
    if (!account_id || !flow_date || !VALID_TYPES.includes(type) || !amt || amt <= 0) {
      return NextResponse.json({ error: '필수 필드 누락 (account_id, flow_date, type, amount>0)' }, { status: 400 })
    }
    const sql = getSql()
    const [row] = await sql`
      INSERT INTO account_cashflows (account_id, flow_date, type, amount, memo)
      VALUES (${account_id}, ${flow_date}, ${type}, ${amt}, ${memo ?? ''})
      RETURNING id
    `
    return NextResponse.json({ id: row.id }, { status: 201 })
  } catch (e) {
    console.error('[POST /portfolio/cashflows]', e)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
