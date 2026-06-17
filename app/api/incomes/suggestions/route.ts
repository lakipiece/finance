export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

// 수입 설명/비고 자동완성: 검색어 매칭 결과를 최근(역순)으로 반환
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const field = req.nextUrl.searchParams.get('field')
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return NextResponse.json({ items: [] })
  if (field !== 'description' && field !== 'memo') {
    return NextResponse.json({ error: 'invalid field' }, { status: 400 })
  }

  try {
    const sql = getSql()
    const like = `%${q}%`
    const rows = field === 'description'
      ? await sql`
          SELECT description AS val
          FROM incomes
          WHERE description ILIKE ${like} AND description != ''
          GROUP BY description
          ORDER BY MAX(income_date) DESC, MAX(id) DESC
          LIMIT 30
        `
      : await sql`
          SELECT memo AS val
          FROM incomes
          WHERE memo ILIKE ${like} AND memo != ''
          GROUP BY memo
          ORDER BY MAX(income_date) DESC, MAX(id) DESC
          LIMIT 30
        `
    return NextResponse.json({ items: rows.map(r => r.val as string) })
  } catch (e) {
    console.error('[GET /incomes/suggestions]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
