import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const CAT_DEFAULT_COLORS: Record<string, string> = {
  '고정비': '#6B8CAE',
  '대출상환': '#C47D7D',
  '변동비': '#6DAE8C',
  '여행공연비': '#8D6E63',
}

export async function GET() {
  const sql = getSql()
  const rows = await sql`SELECT id, name, category, color FROM detail_options WHERE is_active = true ORDER BY category NULLS LAST, name`
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  const { name, category, color } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const defaultColor = color ?? CAT_DEFAULT_COLORS[category ?? ''] ?? '#94a3b8'
  const [row] = await sql`
    INSERT INTO detail_options (name, category, color)
    VALUES (${name}, ${category ?? ''}, ${defaultColor})
    ON CONFLICT (name, category) DO UPDATE SET is_active = true
    RETURNING *`
  return NextResponse.json(row, { status: 201 })
}
