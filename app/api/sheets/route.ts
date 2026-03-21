import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { google } from 'googleapis'
import type { ParsePreviewResponse, RawExpenseRow } from '@/lib/types'

function toDateString(val: string): string {
  // Expects 'YYYY-MM-DD' or similar formatted string from Sheets FORMATTED_VALUE
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { spreadsheetId, sheetName, year } = await req.json()

  if (!spreadsheetId || !sheetName || !year) {
    return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 })
  }

  const yearNum = parseInt(String(year))
  if (isNaN(yearNum)) return NextResponse.json({ error: '연도가 올바르지 않습니다.' }, { status: 400 })

  let credentials: any
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!)
  } catch {
    return NextResponse.json({ error: 'Google 서비스 계정 설정이 올바르지 않습니다.' }, { status: 500 })
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })

  let values: string[][]
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:H`,
      valueRenderOption: 'FORMATTED_VALUE',
    })
    values = (response.data.values ?? []) as string[][]
  } catch (err: any) {
    return NextResponse.json({ error: `Google Sheets 오류: ${err.message}` }, { status: 422 })
  }

  const rows: RawExpenseRow[] = []
  for (let i = 1; i < values.length; i++) {
    const row = values[i]
    if (!row || row.length < 8) continue

    const dateStr = row[0] ?? ''
    const cat = (row[4] ?? '').trim()
    const detail = (row[5] ?? '').trim()
    const method = (row[6] ?? '').trim()
    const rawAmt = row[7] ?? ''

    if (!cat || !rawAmt) continue

    const amount = parseFloat(String(rawAmt).replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) continue

    // Derive month from the date string in col[0]
    const expenseDate = toDateString(dateStr)
    const monthNum = expenseDate ? new Date(expenseDate).getMonth() + 1 : null
    if (!monthNum) continue

    rows.push({
      year: yearNum,
      month: monthNum,
      expense_date: expenseDate,
      category: cat,
      detail,
      method,
      amount: Math.round(amount),
    })
  }

  // Check duplicates
  const { data: existing } = await supabase
    .from('expenses')
    .select('expense_date, category, detail, amount')
    .eq('year', yearNum)

  const existingSet = new Set(
    (existing ?? []).map((e: any) =>
      `${e.expense_date}|${e.category}|${e.detail ?? ''}|${e.amount}`
    )
  )

  const duplicateCount = rows.filter(r =>
    existingSet.has(`${r.expense_date}|${r.category}|${r.detail}|${r.amount}`)
  ).length

  const response: ParsePreviewResponse = {
    rows,
    totalCount: rows.length,
    duplicateCount,
    sampleRows: rows.slice(0, 10),
    year: yearNum,
  }

  return NextResponse.json(response)
}
