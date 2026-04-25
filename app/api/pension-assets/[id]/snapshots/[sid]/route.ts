export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

type Params = { params: Promise<{ id: string; sid: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { sid } = await params
    const sql = getSql()
    await sql`DELETE FROM pension_snapshots WHERE id = ${sid}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /pension-assets/[id]/snapshots/[sid]]', e)
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
}
