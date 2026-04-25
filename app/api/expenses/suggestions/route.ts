export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const sql = getSql()
    const [details, methods] = await Promise.all([
      sql`SELECT DISTINCT detail FROM expenses WHERE detail != '' ORDER BY detail`,
      sql`SELECT DISTINCT method FROM expenses WHERE method != '' ORDER BY method`,
    ])
    return NextResponse.json({
      details: details.map(r => r.detail as string),
      methods: methods.map(r => r.method as string),
    })
  } catch (e) {
    console.error('[GET /expenses/suggestions]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
