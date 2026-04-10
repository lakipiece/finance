export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const items: { id: string; sort_order: number }[] = await req.json()
  const sql = getSql()
  await Promise.all(
    items.map(({ id, sort_order }) =>
      sql`UPDATE accounts SET sort_order = ${sort_order} WHERE id = ${id}`
    )
  )
  return NextResponse.json({ ok: true })
}
