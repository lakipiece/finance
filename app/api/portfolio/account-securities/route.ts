import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`SELECT * FROM account_securities`
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_id } = await req.json()
  const sql = getSql()
  await sql`
    INSERT INTO account_securities (account_id, security_id)
    VALUES (${account_id}, ${security_id})
    ON CONFLICT (account_id, security_id) DO NOTHING
  `
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_ids } = await req.json()
  const sql = getSql()
  await sql`DELETE FROM account_securities WHERE account_id = ${account_id}`
  if (security_ids?.length) {
    const rows = security_ids.map((sid: string) => ({ account_id, security_id: sid }))
    await sql`INSERT INTO account_securities ${sql(rows)}`
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_id } = await req.json()
  const sql = getSql()
  await sql`DELETE FROM account_securities WHERE account_id = ${account_id} AND security_id = ${security_id}`
  return NextResponse.json({ ok: true })
}
