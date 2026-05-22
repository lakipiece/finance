export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { invalidateCache } from '@/lib/cache'

const NUMERIC_FIELDS = [
  'electricity_amount', 'electricity_prev_reading', 'electricity_curr_reading', 'electricity_usage',
  'water_amount', 'water_prev_reading', 'water_curr_reading', 'water_usage',
  'hot_water_amount', 'hot_water_prev_reading', 'hot_water_curr_reading', 'hot_water_usage',
  'heating_amount', 'heating_prev_reading', 'heating_curr_reading', 'heating_usage',
] as const

type NumKey = typeof NUMERIC_FIELDS[number]

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function GET(req: NextRequest) {
  const yearFrom = req.nextUrl.searchParams.get('yearFrom')
  const yearTo = req.nextUrl.searchParams.get('yearTo')
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT id, year, month,
        electricity_amount, electricity_prev_reading, electricity_curr_reading, electricity_usage,
        water_amount, water_prev_reading, water_curr_reading, water_usage,
        hot_water_amount, hot_water_prev_reading, hot_water_curr_reading, hot_water_usage,
        heating_amount, heating_prev_reading, heating_curr_reading, heating_usage,
        memo
      FROM energy_records
      WHERE 1=1
      ${yearFrom ? sql`AND year >= ${parseInt(yearFrom)}` : sql``}
      ${yearTo ? sql`AND year <= ${parseInt(yearTo)}` : sql``}
      ORDER BY year DESC, month DESC
    `
    return NextResponse.json(rows.map(r => {
      const out: Record<string, unknown> = { id: r.id, year: r.year, month: r.month, memo: r.memo }
      for (const k of NUMERIC_FIELDS) out[k] = Number(r[k])
      return out
    }))
  } catch (e) {
    console.error('[GET /energy]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const year = parseInt(body.year)
    const month = parseInt(body.month)
    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'year/month 필수' }, { status: 400 })
    }
    const memo = typeof body.memo === 'string' ? body.memo : ''
    const v: Record<NumKey, number> = {} as Record<NumKey, number>
    for (const k of NUMERIC_FIELDS) v[k] = toNum(body[k])

    const sql = getSql()
    const [row] = await sql`
      INSERT INTO energy_records (
        year, month,
        electricity_amount, electricity_prev_reading, electricity_curr_reading, electricity_usage,
        water_amount, water_prev_reading, water_curr_reading, water_usage,
        hot_water_amount, hot_water_prev_reading, hot_water_curr_reading, hot_water_usage,
        heating_amount, heating_prev_reading, heating_curr_reading, heating_usage,
        memo
      ) VALUES (
        ${year}, ${month},
        ${v.electricity_amount}, ${v.electricity_prev_reading}, ${v.electricity_curr_reading}, ${v.electricity_usage},
        ${v.water_amount}, ${v.water_prev_reading}, ${v.water_curr_reading}, ${v.water_usage},
        ${v.hot_water_amount}, ${v.hot_water_prev_reading}, ${v.hot_water_curr_reading}, ${v.hot_water_usage},
        ${v.heating_amount}, ${v.heating_prev_reading}, ${v.heating_curr_reading}, ${v.heating_usage},
        ${memo}
      )
      ON CONFLICT (year, month) DO UPDATE SET
        electricity_amount       = EXCLUDED.electricity_amount,
        electricity_prev_reading = EXCLUDED.electricity_prev_reading,
        electricity_curr_reading = EXCLUDED.electricity_curr_reading,
        electricity_usage        = EXCLUDED.electricity_usage,
        water_amount             = EXCLUDED.water_amount,
        water_prev_reading       = EXCLUDED.water_prev_reading,
        water_curr_reading       = EXCLUDED.water_curr_reading,
        water_usage              = EXCLUDED.water_usage,
        hot_water_amount         = EXCLUDED.hot_water_amount,
        hot_water_prev_reading   = EXCLUDED.hot_water_prev_reading,
        hot_water_curr_reading   = EXCLUDED.hot_water_curr_reading,
        hot_water_usage          = EXCLUDED.hot_water_usage,
        heating_amount           = EXCLUDED.heating_amount,
        heating_prev_reading     = EXCLUDED.heating_prev_reading,
        heating_curr_reading     = EXCLUDED.heating_curr_reading,
        heating_usage            = EXCLUDED.heating_usage,
        memo                     = EXCLUDED.memo,
        updated_at               = NOW()
      RETURNING id
    `
    invalidateCache('energy')
    return NextResponse.json({ id: row.id })
  } catch (e) {
    console.error('[POST /energy]', e)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
