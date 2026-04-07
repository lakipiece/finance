export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`SELECT * FROM target_allocations ORDER BY level, key`
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const sql = getSql()
  await sql`
    INSERT INTO target_allocations ${sql(body)}
    ON CONFLICT (level, key) DO UPDATE SET target_pct = EXCLUDED.target_pct
  `
  return NextResponse.json({ ok: true })
}
