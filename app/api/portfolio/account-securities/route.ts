export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`SELECT * FROM account_securities`
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_id } = await req.json()
  const sql = getSql()
  await sql`
    INSERT INTO account_securities (account_id, security_id)
    VALUES (${account_id}, ${security_id})
    ON CONFLICT (account_id, security_id) DO NOTHING
  `
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_ids } = await req.json()
  const sql = getSql()

  // 기존 연결 목록 조회 (새로 추가된 종목 감지용)
  const existing = await sql<{ security_id: string }[]>`
    SELECT security_id FROM account_securities WHERE account_id = ${account_id}
  `
  const existingIds = new Set(existing.map(r => r.security_id))
  const newIds: string[] = (security_ids ?? []).filter((sid: string) => !existingIds.has(sid))

  await sql`DELETE FROM account_securities WHERE account_id = ${account_id}`
  if (security_ids?.length) {
    const rows = security_ids.map((sid: string) => ({ account_id, security_id: sid }))
    await sql`INSERT INTO account_securities ${sql(rows)}`
  }

  // 새로 연결된 종목 → 전체 스냅샷에 비활성(quantity=0) holding 자동 생성
  if (newIds.length > 0) {
    const snapshots = await sql<{ id: string; date: unknown }[]>`SELECT id, date FROM snapshots`
    for (const snap of snapshots) {
      const snapDate = (snap.date as unknown) instanceof Date
        ? (snap.date as unknown as Date).toISOString().slice(0, 10)
        : String(snap.date).slice(0, 10)
      const holdingRows = newIds.map(sid => ({
        account_id,
        security_id: sid,
        snapshot_id: snap.id,
        snapshot_date: snapDate,
        quantity: 0,
        avg_price: null,
        total_invested: null,
        source: 'manual',
        updated_at: new Date().toISOString(),
      }))
      await sql`
        INSERT INTO holdings ${sql(holdingRows)}
        ON CONFLICT (account_id, security_id, snapshot_id) DO NOTHING
      `
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_id } = await req.json()
  const sql = getSql()
  await sql`DELETE FROM account_securities WHERE account_id = ${account_id} AND security_id = ${security_id}`
  return NextResponse.json({ ok: true })
}
