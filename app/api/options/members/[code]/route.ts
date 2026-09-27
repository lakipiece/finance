import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { invalidateCache } from '@/lib/cache'

export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  const { display_name, color } = await req.json()
  const [row] = await sql`
    UPDATE members SET display_name = ${display_name}, color = ${color}
    WHERE code = ${code} RETURNING *`
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  invalidateCache()
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  await sql`DELETE FROM members WHERE code = ${code}`
  invalidateCache()
  return NextResponse.json({ ok: true })
}
