export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

function formatDate(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

export async function GET() {
  try {
    const sql = getSql()
    // 각 자산의 최신 평가액을 LATERAL JOIN으로 함께 조회
    const rows = await sql`
      SELECT
        ta.id, ta.name, ta.asset_type, ta.description,
        ta.acquired_at, ta.acquisition_price, ta.acquisition_note,
        ta.created_at,
        lv.amount    AS current_value,
        lv.val_date  AS last_val_date
      FROM tangible_assets ta
      LEFT JOIN LATERAL (
        SELECT amount, val_date
        FROM asset_valuations
        WHERE asset_id = ta.id
        ORDER BY val_date DESC
        LIMIT 1
      ) lv ON true
      ORDER BY ta.created_at
    `
    return NextResponse.json(rows.map((r: Record<string, unknown>) => ({
      ...r,
      acquired_at:   formatDate(r.acquired_at),
      last_val_date: formatDate(r.last_val_date),
    })))
  } catch (e) {
    console.error('[GET /assets]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { name, asset_type, description, acquired_at, acquisition_price, acquisition_note } = await req.json()
    if (!name?.trim() || !asset_type?.trim()) {
      return NextResponse.json({ error: '이름과 유형은 필수입니다' }, { status: 400 })
    }
    const sql = getSql()
    const [row] = await sql`
      INSERT INTO tangible_assets (name, asset_type, description, acquired_at, acquisition_price, acquisition_note)
      VALUES (
        ${name.trim()},
        ${asset_type},
        ${description ?? ''},
        ${acquired_at ?? null},
        ${acquisition_price ?? null},
        ${acquisition_note ?? ''}
      )
      RETURNING id, name, asset_type, description, acquired_at, acquisition_price, acquisition_note, created_at
    `
    return NextResponse.json({
      ...row,
      acquired_at: formatDate(row.acquired_at),
      current_value: null,
      last_val_date: null,
    })
  } catch (e) {
    console.error('[POST /assets]', e)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
