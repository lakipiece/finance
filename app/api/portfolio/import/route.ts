import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { google } from 'googleapis'
import { readFileSync } from 'fs'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { spreadsheetId: string; sheetName: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  let { spreadsheetId, sheetName } = body
  const urlMatch = typeof spreadsheetId === 'string' && spreadsheetId.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) spreadsheetId = urlMatch[1]

  if (!spreadsheetId || !sheetName) {
    return NextResponse.json({ error: 'spreadsheetId, sheetName 필수' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let credentials: any
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!
    const jsonStr = raw.trimStart().startsWith('{') ? raw : readFileSync(raw, 'utf-8')
    credentials = JSON.parse(jsonStr)
  } catch {
    return NextResponse.json({ error: 'Google 서비스 계정 설정 오류' }, { status: 500 })
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  let values: string[][]
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:X`,
      valueRenderOption: 'FORMATTED_VALUE',
    })
    values = (res.data.values ?? []) as string[][]
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Google Sheets 오류: ${msg}` }, { status: 422 })
  }

  const dataRows = values.slice(1).filter(r => r[3] && r[4])
  if (dataRows.length === 0) {
    return NextResponse.json({ imported: 0, errors: ['데이터 행을 찾을 수 없습니다. 컬럼 순서를 확인해주세요.'] })
  }

  const today = new Date().toISOString().slice(0, 10)
  const errors: string[] = []

  // 1. securities 배치 upsert
  const securitiesPayload = dataRows.map(row => ({
    ticker: (row[3] ?? '').trim().toUpperCase(),
    name: (row[4] ?? '').trim(),
    asset_class: (row[5] ?? '').trim() || null,
    country: (row[6] ?? '').trim() || null,
    style: (row[7] ?? '').trim() || null,
    sector: (row[8] ?? '').trim() || null,
    currency: (row[6] ?? '').trim() === 'KR' ? 'KRW' : 'USD',
  })).filter(s => s.ticker && s.name)

  const { data: upsertedSecurities, error: secErr } = await supabase
    .from('securities')
    .upsert(securitiesPayload, { onConflict: 'ticker' })
    .select('id, ticker')

  if (secErr) return NextResponse.json({ error: `종목 저장 오류: ${secErr.message}` }, { status: 500 })

  const secMap = Object.fromEntries((upsertedSecurities ?? []).map(s => [s.ticker, s.id]))

  // 2. accounts: 중복 없이 find-or-create
  const accountKeys = [...new Set(dataRows.map(row => `${(row[1] ?? '').trim()}||${(row[2] ?? '').trim()}`))]
  const accountMap: Record<string, string> = {}

  for (const key of accountKeys) {
    const [broker, accType] = key.split('||')
    if (!broker) continue
    const owner = dataRows.find(r => (r[1] ?? '').trim() === broker)?.[0]?.trim() ?? ''

    const { data: existing } = await supabase
      .from('accounts').select('id').eq('broker', broker).eq('type', accType).maybeSingle()

    if (existing) {
      accountMap[key] = existing.id
    } else {
      const { data: created } = await supabase
        .from('accounts')
        .insert({ name: `${broker} ${accType}`, broker, owner, type: accType })
        .select('id').single()
      if (created) accountMap[key] = created.id
    }
  }

  // 3. holdings 배치 upsert
  const holdingsPayload = dataRows.flatMap(row => {
    const ticker = (row[3] ?? '').trim().toUpperCase()
    const broker = (row[1] ?? '').trim()
    const accType = (row[2] ?? '').trim()
    const secId = secMap[ticker]
    const accId = accountMap[`${broker}||${accType}`]
    if (!secId || !accId) { errors.push(`${ticker}: 계좌 또는 종목 ID 없음`); return [] }

    const qty = parseFloat((row[9] ?? '0').replace(/,/g, ''))
    if (isNaN(qty) || qty <= 0) return []

    const avgPrice = parseFloat((row[10] ?? '0').replace(/,/g, ''))
    const totalInvested = parseFloat((row[12] ?? '0').replace(/,/g, ''))

    return [{
      account_id: accId,
      security_id: secId,
      quantity: qty,
      avg_price: isNaN(avgPrice) || avgPrice === 0 ? null : avgPrice,
      total_invested: isNaN(totalInvested) || totalInvested === 0 ? null : totalInvested,
      snapshot_date: today,
      source: 'import',
      updated_at: new Date().toISOString(),
    }]
  })

  const { error: holdErr } = await supabase
    .from('holdings')
    .upsert(holdingsPayload, { onConflict: 'account_id,security_id' })

  if (holdErr) return NextResponse.json({ error: `포지션 저장 오류: ${holdErr.message}` }, { status: 500 })

  return NextResponse.json({ imported: holdingsPayload.length, errors })
}
