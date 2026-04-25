import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: { name: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  const { color } = await req.json()
  const [row] = await sql`
    INSERT INTO categories (name, color) VALUES (${params.name}, ${color})
    ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color
    RETURNING *`
  return NextResponse.json(row)
}
