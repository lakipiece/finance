export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const { name, asset_type, description, acquired_at, acquisition_price, acquisition_note } = await req.json()
    if (!name?.trim() || !asset_type?.trim()) {
      return NextResponse.json({ error: '이름과 유형은 필수입니다' }, { status: 400 })
    }
    const sql = getSql()
    await sql`
      UPDATE tangible_assets SET
        name = ${name.trim()},
        asset_type = ${asset_type},
        description = ${description ?? ''},
        acquired_at = ${acquired_at ?? null},
        acquisition_price = ${acquisition_price ?? null},
        acquisition_note = ${acquisition_note ?? ''}
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PATCH /assets/[id]]', e)
    return NextResponse.json({ error: '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const sql = getSql()
    await sql`DELETE FROM tangible_assets WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /assets/[id]]', e)
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
}
