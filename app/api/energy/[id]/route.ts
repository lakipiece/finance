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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = parseInt(params.id)
  if (!id) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
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
    await sql`
      UPDATE energy_records SET
        year = ${year}, month = ${month},
        electricity_amount       = ${v.electricity_amount},
        electricity_prev_reading = ${v.electricity_prev_reading},
        electricity_curr_reading = ${v.electricity_curr_reading},
        electricity_usage        = ${v.electricity_usage},
        water_amount             = ${v.water_amount},
        water_prev_reading       = ${v.water_prev_reading},
        water_curr_reading       = ${v.water_curr_reading},
        water_usage              = ${v.water_usage},
        hot_water_amount         = ${v.hot_water_amount},
        hot_water_prev_reading   = ${v.hot_water_prev_reading},
        hot_water_curr_reading   = ${v.hot_water_curr_reading},
        hot_water_usage          = ${v.hot_water_usage},
        heating_amount           = ${v.heating_amount},
        heating_prev_reading     = ${v.heating_prev_reading},
        heating_curr_reading     = ${v.heating_curr_reading},
        heating_usage            = ${v.heating_usage},
        memo                     = ${memo},
        updated_at               = NOW()
      WHERE id = ${id}
    `
    invalidateCache('energy')
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PATCH /energy]', e)
    return NextResponse.json({ error: '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = parseInt(params.id)
  if (!id) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  try {
    const sql = getSql()
    await sql`DELETE FROM energy_records WHERE id = ${id}`
    invalidateCache('energy')
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /energy]', e)
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
}
