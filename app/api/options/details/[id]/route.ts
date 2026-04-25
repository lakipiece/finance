import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  const { name, category } = await req.json()
  const [row] = await sql`
    UPDATE detail_options SET name = ${name}, category = ${category ?? ''}
    WHERE id = ${params.id} RETURNING *`
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  await sql`DELETE FROM detail_options WHERE id = ${params.id}`
  return NextResponse.json({ ok: true })
}
