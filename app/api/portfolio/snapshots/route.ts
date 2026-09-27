import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { kstToday } from '@/lib/portfolio/valuation'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sql = getSql()
  const data = await sql`SELECT * FROM snapshots ORDER BY date DESC`
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, memo, clone_from } = await req.json()
  const sql = getSql()

  // 스냅샷 생성 + 이전 스냅샷 보유내역 복제를 한 트랜잭션으로 (실패 시 빈 스냅샷이 남지 않게)
  let snapshot
  try {
    snapshot = await sql.begin(async tx => {
      const [created] = await tx`
        INSERT INTO snapshots (date, memo)
        VALUES (${date ?? kstToday()}, ${memo ?? null})
        RETURNING *
      `
      if (clone_from) {
        await tx`
          INSERT INTO holdings (account_id, security_id, quantity, avg_price, avg_fx_rate, total_invested, source,
                                snapshot_id, snapshot_date, updated_at)
          SELECT account_id, security_id, quantity, avg_price, avg_fx_rate, total_invested, source,
                 ${created.id}, ${created.date}, NOW()
          FROM holdings
          WHERE snapshot_id = ${clone_from} AND quantity > 0
        `
      }
      return created
    })
  } catch (e) {
    console.error('[POST /portfolio/snapshots]', e)
    return NextResponse.json({ error: clone_from ? 'clone failed' : '생성 실패' }, { status: 500 })
  }

  return NextResponse.json(snapshot, { status: 201 })
}
