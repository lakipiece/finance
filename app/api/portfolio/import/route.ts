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

  const rows = values.slice(1).filter(r => r[3] && r[4])
  let imported = 0
  const errors: string[] = []

  for (const row of rows) {
    const ticker = (row[3] ?? '').trim().toUpperCase()
    const name = (row[4] ?? '').trim()
    if (!ticker || !name) continue

    try {
      const { data: sec } = await supabase
        .from('securities')
        .upsert(
          {
            ticker,
            name,
            asset_class: (row[5] ?? '').trim() || null,
            country: (row[6] ?? '').trim() || null,
            style: (row[7] ?? '').trim() || null,
            sector: (row[8] ?? '').trim() || null,
            currency: (row[6] ?? '').trim() === 'KR' ? 'KRW' : 'USD',
          },
          { onConflict: 'ticker' }
        )
        .select()
        .single()

      if (!sec) continue

      const broker = (row[1] ?? '').trim()
      const accType = (row[2] ?? '').trim()
      const owner = (row[0] ?? '').trim()
      let account: { id: string } | null = null

      if (broker) {
        const { data: existing } = await supabase
          .from('accounts')
          .select('*')
          .eq('broker', broker)
          .eq('type', accType)
          .maybeSingle()

        if (existing) {
          account = existing
        } else {
          const { data: created } = await supabase
            .from('accounts')
            .insert({ name: `${broker} ${accType}`, broker, owner, type: accType })
            .select()
            .single()
          account = created
        }
      }

      if (!account) continue

      const qty = parseFloat((row[9] ?? '0').replace(/,/g, ''))
      const avgPrice = parseFloat((row[10] ?? '0').replace(/,/g, ''))
      const totalInvested = parseFloat((row[12] ?? '0').replace(/,/g, ''))

      if (isNaN(qty) || qty <= 0) continue

      await supabase.from('holdings').upsert(
        {
          account_id: account.id,
          security_id: sec.id,
          quantity: qty,
          avg_price: isNaN(avgPrice) ? null : avgPrice,
          total_invested: isNaN(totalInvested) ? null : totalInvested,
          snapshot_date: new Date().toISOString().slice(0, 10),
          source: 'import',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id,security_id' }
      )

      imported++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${ticker}: ${msg}`)
    }
  }

  return NextResponse.json({ imported, errors })
}
