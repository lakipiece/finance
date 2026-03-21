import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import type { RawExpenseRow } from '@/lib/types'

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let rows: RawExpenseRow[], year: number
  try {
    const body = await req.json()
    rows = body.rows
    year = body.year
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  if (!Array.isArray(rows) || rows.length === 0 || !year) {
    return NextResponse.json({ error: '데이터가 없습니다.' }, { status: 400 })
  }
  if (rows.length > 5000) {
    return NextResponse.json({ error: '한번에 최대 5000건까지 저장 가능합니다.' }, { status: 400 })
  }

  // Re-check duplicates server-side before inserting
  const { data: existing } = await supabase
    .from('expenses')
    .select('expense_date, category, detail, amount')
    .eq('year', year)

  const existingSet = new Set(
    (existing ?? []).map((e: any) =>
      `${e.expense_date}|${e.category}|${e.detail ?? ''}|${e.amount}`
    )
  )

  const toInsert = rows.filter(r =>
    !existingSet.has(`${r.expense_date}|${r.category}|${r.detail}|${r.amount}`)
  )

  if (toInsert.length > 0) {
    const { error } = await supabase.from('expenses').insert(
      toInsert.map(r => ({
        year: r.year,
        month: r.month,
        expense_date: r.expense_date,
        category: r.category,
        detail: r.detail || null,
        method: r.method || null,
        amount: r.amount,
      }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inserted: toInsert.length, skipped: rows.length - toInsert.length })
}
