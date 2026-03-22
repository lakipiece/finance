import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { google } from 'googleapis'
import { readFileSync } from 'fs'
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

  let body: { spreadsheetId: string; sheetName: string; year: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }
  let { spreadsheetId, sheetName, year } = body

  // Accept full Google Sheets URL — extract ID from /d/{id}/
  const urlMatch = typeof spreadsheetId === 'string' && spreadsheetId.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) spreadsheetId = urlMatch[1]

  if (!spreadsheetId || !sheetName || !year) {
    return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 })
  }

  // Allowlist: alphanumeric, spaces, Korean, hyphens, underscores, parentheses
  if (typeof sheetName !== 'string' || !/^[\w\s가-힣\-()\[\]]+$/.test(sheetName)) {
    return NextResponse.json({ error: '시트 이름이 올바르지 않습니다.' }, { status: 400 })
  }

  const yearNum = parseInt(String(year))
  if (isNaN(yearNum)) return NextResponse.json({ error: '연도가 올바르지 않습니다.' }, { status: 400 })

  let credentials: any
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!
    const jsonStr = raw.trimStart().startsWith('{') ? raw : readFileSync(raw, 'utf-8')
    credentials = JSON.parse(jsonStr)
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
    if (!row || row.length < 5) continue

    // col[0]: "1/1(월)" or "2024-01-01" style date
    // col[1]: "2024-01" (YYYY-MM) — use this for reliable month extraction
    const rawDate = String(row[0] ?? '').trim()
    const rawMonth = String(row[1] ?? '').trim()
    const cat = (row[4] ?? '').trim()
    const detail = (row[5] ?? '').trim()
    const method = (row[6] ?? '').trim()
    const rawAmt = row[7] ?? ''

    if (!cat || !rawAmt) continue

    const amount = parseFloat(String(rawAmt).replace(/,/g, '').trim())
    if (isNaN(amount) || amount <= 0) continue

    // Derive month: prefer col[1] "YYYY-MM" format, fallback to col[0]
    let monthNum: number | null = null
    let expenseDate = ''

    if (/^\d{4}-\d{2}/.test(rawMonth)) {
      // col[1] = "2024-01" → month = 1
      monthNum = parseInt(rawMonth.split('-')[1])
      // col[0] = "1/1(월)" → extract day number after first "/"
      const dayPart = rawDate.split('/')[1] ?? ''
      const dayNum = parseInt(dayPart)
      expenseDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(isNaN(dayNum) ? 1 : dayNum).padStart(2, '0')}`
    } else {
      // Fallback: try parsing col[0] as a standard date string
      const parsed = toDateString(rawDate)
      if (parsed) {
        monthNum = new Date(parsed).getMonth() + 1
        expenseDate = parsed
      }
    }

    if (!monthNum || isNaN(monthNum)) continue

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

  const { count } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('year', yearNum)
  const existingCount = count ?? 0

  const response: ParsePreviewResponse = {
    rows,
    totalCount: rows.length,
    existingCount,
    sampleRows: rows.slice(0, 10),
    year: yearNum,
    ...(rows.length === 0 && { rawSample: values.slice(0, 4) }),
  }

  return NextResponse.json(response)
}
