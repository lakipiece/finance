export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

interface BulkRow {
  account_id: string
  security_id: string
  quantity: number
  avg_price: number | null
  avg_fx_rate: number | null
}

/**
 * POST /api/portfolio/holdings/bulk
 * 스냅샷 편집 저장 — 행 단위 POST N회 대신 한 트랜잭션으로 업서트한다.
 * 일부만 저장되고 "저장 완료"가 뜨던 문제를 막기 위해 실패 시 전체 롤백.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { snapshot_id, snapshot_date, rows } = await req.json() as {
    snapshot_id?: string; snapshot_date?: string; rows?: BulkRow[]
  }
  if (!snapshot_id || !snapshot_date || !Array.isArray(rows)) {
    return NextResponse.json({ error: '필수 항목 누락 (snapshot_id, snapshot_date, rows)' }, { status: 400 })
  }
  if (rows.length === 0) return NextResponse.json({ saved: 0 })

  const values = rows.map(r => {
    const quantity = Number(r.quantity) || 0
    const avgPrice = r.avg_price == null ? null : Number(r.avg_price)
    return {
      account_id: r.account_id,
      security_id: r.security_id,
      quantity,
      avg_price: avgPrice,
      avg_fx_rate: r.avg_fx_rate == null ? null : Number(r.avg_fx_rate),
      // 종목 통화 기준 총 매수금액 (USD 종목은 USD)
      total_invested: avgPrice == null ? null : quantity * avgPrice,
      snapshot_id,
      snapshot_date,
      source: 'manual',
    }
  })
  if (values.some(v => !v.account_id || !v.security_id)) {
    return NextResponse.json({ error: 'account_id, security_id는 필수입니다' }, { status: 400 })
  }

  const sql = getSql()
  try {
    await sql.begin(async tx => {
      await tx`
        INSERT INTO holdings ${tx(values, 'account_id', 'security_id', 'quantity', 'avg_price', 'avg_fx_rate', 'total_invested', 'snapshot_id', 'snapshot_date', 'source')}
        ON CONFLICT (account_id, security_id, snapshot_id) DO UPDATE SET
          quantity       = EXCLUDED.quantity,
          avg_price      = EXCLUDED.avg_price,
          avg_fx_rate    = EXCLUDED.avg_fx_rate,
          total_invested = EXCLUDED.total_invested,
          snapshot_date  = EXCLUDED.snapshot_date,
          updated_at     = NOW()
      `
    })
    return NextResponse.json({ saved: values.length })
  } catch (e) {
    console.error('[POST /portfolio/holdings/bulk]', e)
    return NextResponse.json({ error: '저장 실패 — 변경 사항이 적용되지 않았습니다' }, { status: 500 })
  }
}
