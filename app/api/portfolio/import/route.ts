import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { google } from 'googleapis'
import { readFileSync } from 'fs'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const googleAuth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth: googleAuth })

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
  const sql = getSql()

  // 1. securities 배치 upsert
  const securitiesMap = new Map<string, { ticker: string; name: string; asset_class: string | null; country: string | null; style: string | null; sector: string | null; currency: string }>()
  for (const row of dataRows) {
    const ticker = (row[3] ?? '').trim().toUpperCase()
    const name = (row[4] ?? '').trim()
    if (!ticker || !name) continue
    securitiesMap.set(ticker, {
      ticker,
      name,
      asset_class: (row[5] ?? '').trim() || null,
      country: (row[6] ?? '').trim() || null,
      style: (row[7] ?? '').trim() || null,
      sector: (row[8] ?? '').trim() || null,
      currency: ['KR', '국내', '한국'].includes((row[6] ?? '').trim()) ? 'KRW' : 'USD',
    })
  }
  const securitiesPayload = [...securitiesMap.values()]

  const securitiesResult = await sql`
    INSERT INTO securities ${sql(securitiesPayload)}
    ON CONFLICT (ticker) DO UPDATE SET
      name = EXCLUDED.name,
      asset_class = EXCLUDED.asset_class,
      country = EXCLUDED.country,
      currency = EXCLUDED.currency
    RETURNING id, ticker
  `

  if (!securitiesResult) return NextResponse.json({ error: '종목 저장 오류' }, { status: 500 })

  const secMap = Object.fromEntries((securitiesResult as unknown as { id: string; ticker: string }[]).map((s) => [s.ticker, s.id]))

  // 2. accounts: 중복 없이 find-or-create
  const accountKeys = [...new Set(dataRows.map(row => `${(row[1] ?? '').trim()}||${(row[2] ?? '').trim()}`))]
  const accountMap: Record<string, string> = {}

  for (const key of accountKeys) {
    const [broker, accType] = key.split('||')
    if (!broker) continue
    const owner = dataRows.find(r => (r[1] ?? '').trim() === broker)?.[0]?.trim() ?? ''

    const [existing] = await sql`
      SELECT a.id FROM accounts a
      LEFT JOIN option_list t ON a.type_id = t.id
      WHERE a.broker = ${broker} AND t.value = ${accType}
    `

    if (existing) {
      accountMap[key] = existing.id
    } else {
      const name = `${broker} ${accType}`
      const [newAccount] = await sql`
        INSERT INTO accounts (name, broker, owner, type_id)
        VALUES (
          ${name}, ${broker}, ${owner},
          (SELECT id FROM option_list WHERE type = 'account_type' AND value = ${accType} LIMIT 1)
        )
        RETURNING id
      `
      if (newAccount) accountMap[key] = newAccount.id
    }
  }

  // 3. holdings 배치 upsert
  const holdingsRaw = dataRows.flatMap(row => {
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

  // 같은 배치 내 중복 제거 (마지막 행 우선)
  const holdingsMap = new Map<string, typeof holdingsRaw[0]>()
  for (const h of holdingsRaw) {
    holdingsMap.set(`${h.account_id}||${h.security_id}`, h)
  }
  const holdingsPayload = [...holdingsMap.values()]

  await sql`
    INSERT INTO holdings ${sql(holdingsPayload)}
    ON CONFLICT (account_id, security_id) DO UPDATE SET
      quantity = EXCLUDED.quantity,
      avg_price = EXCLUDED.avg_price,
      total_invested = EXCLUDED.total_invested,
      snapshot_date = EXCLUDED.snapshot_date,
      updated_at = EXCLUDED.updated_at
  `

  return NextResponse.json({ imported: holdingsPayload.length, errors })
}
