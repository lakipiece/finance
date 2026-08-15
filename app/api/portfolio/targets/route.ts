export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { invalidateCache } from '@/lib/cache'

export async function GET() {
  const sql = getSql()
  const data = await sql`SELECT * FROM target_allocations ORDER BY level, key`
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'array required' }, { status: 400 })
  }

  // 전체 교체. upsert만 하면 화면에서 지운 목표가 서버에 남아
  // '미설정'으로 되돌린 항목이 다시 살아난다.
  const sql = getSql()
  await sql.begin(async sql => {
    await sql`DELETE FROM target_allocations`
    if (body.length > 0) {
      await sql`INSERT INTO target_allocations ${sql(body)}`
    }
  })
  invalidateCache()
  return NextResponse.json({ ok: true })
}
