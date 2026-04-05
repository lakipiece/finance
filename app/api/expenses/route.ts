import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Returns individual expense items with optional filters
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const yearStr = params.get('year')
  const category = params.get('category')
  const detail = params.get('detail')
  const month = params.get('month')

  const year = yearStr ? parseInt(yearStr) : null
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  let query = supabase
    .from('expenses')
    .select('year,month,expense_date,category,detail,memo,method,amount')
    .eq('year', year)

  if (category) query = query.eq('category', category)
  if (detail) query = query.eq('detail', detail)
  if (month) query = query.eq('month', parseInt(month))

  const allRows: any[] = []
  let offset = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await query.range(offset, offset + pageSize - 1)
    if (error || !data || data.length === 0) break
    allRows.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  const expenses = allRows.map((e: any) => ({
    year: e.year,
    date: e.expense_date ?? '',
    month: e.month,
    category: e.category ?? '',
    detail: e.detail ?? '',
    memo: e.memo ?? '',
    method: e.method ?? '',
    amount: e.amount ?? 0,
  }))

  return NextResponse.json({ expenses })
}
