export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json({ memos: [] })

  try {
    const sql = getSql()
    const rows = await sql`
      SELECT memo
      FROM expenses
      WHERE memo ILIKE ${'%' + q + '%'} AND memo != ''
      GROUP BY memo
      ORDER BY MAX(expense_date) DESC, MAX(id) DESC
      LIMIT 30
    `
    return NextResponse.json({ memos: rows.map(r => r.memo as string) })
  } catch (e) {
    console.error('[GET /expenses/memos]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
