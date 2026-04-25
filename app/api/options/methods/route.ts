import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sql = getSql()
  const rows = await sql`SELECT id, name, order_idx FROM payment_methods WHERE is_active = true ORDER BY order_idx, id`
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  const { name } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const [row] = await sql`
    INSERT INTO payment_methods (name, order_idx)
    VALUES (${name}, (SELECT COALESCE(MAX(order_idx), 0) + 1 FROM payment_methods))
    ON CONFLICT (name) DO UPDATE SET is_active = true
    RETURNING *`
  return NextResponse.json(row, { status: 201 })
}
