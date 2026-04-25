import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: { code: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  const { display_name, color } = await req.json()
  const [row] = await sql`
    UPDATE members SET display_name = ${display_name}, color = ${color}
    WHERE code = ${params.code} RETURNING *`
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: { code: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  await sql`DELETE FROM members WHERE code = ${params.code}`
  return NextResponse.json({ ok: true })
}
