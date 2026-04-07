import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

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

  const [snapshot] = await sql`
    INSERT INTO snapshots (date, memo)
    VALUES (${date ?? new Date().toISOString().slice(0, 10)}, ${memo ?? null})
    RETURNING *
  `

  if (clone_from) {
    const sourceHoldings = await sql`
      SELECT account_id, security_id, quantity, avg_price, total_invested, source
      FROM holdings
      WHERE snapshot_id = ${clone_from} AND quantity > 0
    `
    if (sourceHoldings.length > 0) {
      const cloned = sourceHoldings.map((h: any) => ({
        ...h,
        snapshot_id: snapshot.id,
        snapshot_date: snapshot.date,
        updated_at: new Date().toISOString(),
      }))
      try {
        await sql`INSERT INTO holdings ${sql(cloned)}`
      } catch {
        await sql`DELETE FROM snapshots WHERE id = ${snapshot.id}`
        return NextResponse.json({ error: 'clone failed' }, { status: 500 })
      }
    }
  }

  return NextResponse.json(snapshot, { status: 201 })
}
