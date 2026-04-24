export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// GET: 해당 종목의 태그 목록 조회 (인증 불필요)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT id, tag FROM security_tags
      WHERE security_id = ${id}
      ORDER BY tag
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('[tags route]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

// POST: 태그 추가 (인증 필요)
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { tag } = await req.json()
  if (!tag?.trim() || tag.trim().length > 50)
    return NextResponse.json({ error: 'tag required (max 50 chars)' }, { status: 400 })

  try {
    const sql = getSql()
    const [row] = await sql`
      INSERT INTO security_tags (security_id, tag)
      VALUES (${id}, ${tag.trim()})
      ON CONFLICT (security_id, tag) DO NOTHING
      RETURNING id, tag
    `
    return NextResponse.json(row ?? { tag: tag.trim() })
  } catch (e) {
    console.error('[tags route]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

// DELETE: 태그 삭제 (인증 필요)
// body에 tag 없거나 '__all__'이면 해당 종목 전체 태그 삭제
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { tag } = body

  try {
    const sql = getSql()
    if (!tag || tag === '__all__') {
      await sql`DELETE FROM security_tags WHERE security_id = ${id}`
    } else {
      await sql`DELETE FROM security_tags WHERE security_id = ${id} AND tag = ${tag}`
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[tags route]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
