export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sql = getSql()

  const rows = await sql<{
    id: string
    amount: number
    currency: string
    exchange_rate: number
    dividend_tax_rate: number
  }[]>`
    SELECT d.id, d.amount, d.currency, d.exchange_rate, a.dividend_tax_rate
    FROM dividends d
    JOIN accounts a ON d.account_id = a.id
    WHERE d.tax = 0
      AND a.dividend_tax_rate IS NOT NULL
      AND a.dividend_tax_rate > 0
  `

  let updated = 0
  for (const d of rows) {
    const rate = Number(d.dividend_tax_rate)
    // tax는 원래 통화 기준으로 저장
    const taxInOriginal = Math.round(Number(d.amount) * rate / 100 * 100) / 100
    if (taxInOriginal > 0) {
      await sql`UPDATE dividends SET tax = ${taxInOriginal} WHERE id = ${d.id}`
      updated++
    }
  }

  return NextResponse.json({ ok: true, updated })
}
