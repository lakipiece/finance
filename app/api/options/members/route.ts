import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sql = getSql()
  const rows = await sql`SELECT code, display_name, color FROM members ORDER BY code`
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  const { code, display_name, color } = await req.json()
  if (!code || !display_name) return NextResponse.json({ error: 'code, display_name required' }, { status: 400 })
  const [row] = await sql`
    INSERT INTO members (code, display_name, color) VALUES (${code}, ${display_name}, ${color ?? '#64748b'})
    ON CONFLICT (code) DO UPDATE SET display_name = EXCLUDED.display_name, color = EXCLUDED.color
    RETURNING *`
  return NextResponse.json(row, { status: 201 })
}
