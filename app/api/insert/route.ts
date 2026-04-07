import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { invalidateCache } from '@/lib/cache'
import type { RawExpenseRow } from '@/lib/types'

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let rows: RawExpenseRow[], year: number, source: string, source_url: string
  try {
    const body = await req.json()
    rows = body.rows
    year = body.year
    source = body.source ?? 'excel'
    source_url = body.source_url ?? ''
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  if (!Array.isArray(rows) || rows.length === 0 || !year) {
    return NextResponse.json({ error: '데이터가 없습니다.' }, { status: 400 })
  }
  if (rows.length > 5000) {
    return NextResponse.json({ error: '한번에 최대 5000건까지 저장 가능합니다.' }, { status: 400 })
  }

  // Ensure all rows belong to the declared year to prevent cross-year corruption
  const invalidRows = rows.filter(r => r.year !== year)
  if (invalidRows.length > 0) {
    return NextResponse.json({ error: `연도가 일치하지 않는 행이 ${invalidRows.length}건 있습니다.` }, { status: 400 })
  }

  // Prepare insert payload before deleting — validates data is complete before destructive op
  const toInsert = rows.map(r => ({
    year: r.year,
    month: r.month,
    expense_date: r.expense_date,
    category: r.category,
    detail: r.detail || null,
    method: r.method || null,
    memo: r.memo ?? '',
    amount: r.amount,
    member: r.member ?? null,
    source,
    source_url,
  }))

  // Delete all existing rows for this year, then insert fresh data.
  // These are two separate operations (no DB transaction via JS client).
  // Input validation above minimises the risk of insert failure after delete.
  const { error: deleteError } = await supabase
    .from('expenses')
    .delete()
    .eq('year', year)
  if (deleteError) return NextResponse.json({ error: `삭제 실패: ${deleteError.message}` }, { status: 500 })

  const { error: insertError } = await supabase.from('expenses').insert(toInsert)
  if (insertError) {
    return NextResponse.json({
      error: `데이터 삽입 실패: ${insertError.message}. ${year}년 데이터가 삭제된 상태입니다. 다시 시도해주세요.`,
    }, { status: 500 })
  }

  invalidateCache()
  return NextResponse.json({ inserted: rows.length })
}
