import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Step 1: 기본 holdings 쿼리
  const { data: raw, error: rawErr } = await supabase
    .from('holdings')
    .select('*')
    .gt('quantity', 0)

  // Step 2: 조인 쿼리
  const { data: joined, error: joinErr } = await supabase
    .from('holdings')
    .select('*, account:accounts(*), security:securities(*)')
    .gt('quantity', 0)

  // Step 3: quantity 타입 확인
  const firstRaw = raw?.[0]

  return NextResponse.json({
    step1_count: raw?.length ?? 0,
    step1_error: rawErr?.message ?? null,
    step2_count: joined?.length ?? 0,
    step2_error: joinErr?.message ?? null,
    first_row_types: firstRaw ? {
      quantity: firstRaw.quantity,
      quantity_type: typeof firstRaw.quantity,
      quantity_gt_0: firstRaw.quantity > 0,
      account_id: firstRaw.account_id,
      security_id: firstRaw.security_id,
    } : null,
    first_joined: joined?.[0] ?? null,
  })
}
