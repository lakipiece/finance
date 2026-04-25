import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sql = getSql()
  const rows = await sql`SELECT id, name, category FROM detail_options WHERE is_active = true ORDER BY category NULLS LAST, name`
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  const { name, category } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const [row] = await sql`
    INSERT INTO detail_options (name, category)
    VALUES (${name}, ${category ?? ''})
    ON CONFLICT (name, category) DO UPDATE SET is_active = true
    RETURNING *`
  return NextResponse.json(row, { status: 201 })
}
