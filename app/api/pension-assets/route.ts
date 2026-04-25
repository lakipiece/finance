export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

function formatDate(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

export async function GET() {
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT
        pa.id, pa.name, pa.description, pa.created_at,
        ls.amount         AS current_amount,
        ls.snapshot_date  AS last_snapshot_date
      FROM pension_assets pa
      LEFT JOIN LATERAL (
        SELECT amount, snapshot_date
        FROM pension_snapshots
        WHERE pension_asset_id = pa.id
        ORDER BY snapshot_date DESC
        LIMIT 1
      ) ls ON true
      ORDER BY pa.created_at
    `
    return NextResponse.json(rows.map((r: Record<string, unknown>) => ({
      ...r,
      last_snapshot_date: formatDate(r.last_snapshot_date),
    })))
  } catch (e) {
    console.error('[GET /pension-assets]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { name, description } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: '이름은 필수입니다' }, { status: 400 })
    }
    const sql = getSql()
    const [row] = await sql`
      INSERT INTO pension_assets (name, description)
      VALUES (${name.trim()}, ${description ?? ''})
      RETURNING id, name, description, created_at
    `
    return NextResponse.json({
      ...row,
      current_amount: null,
      last_snapshot_date: null,
    })
  } catch (e) {
    console.error('[POST /pension-assets]', e)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
