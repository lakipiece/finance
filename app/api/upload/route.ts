import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseExcelBuffer } from '@/lib/parseExcelBuffer'
import { supabase } from '@/lib/supabase'
import type { ParsePreviewResponse, RawExpenseRow } from '@/lib/types'

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const yearStr = formData.get('year') as string | null

  if (!file || !yearStr) {
    return NextResponse.json({ error: '파일과 연도를 모두 입력해주세요.' }, { status: 400 })
  }

  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: '.xlsx 파일만 업로드 가능합니다.' }, { status: 400 })
  }

  const year = parseInt(yearStr)
  if (isNaN(year)) return NextResponse.json({ error: '연도가 올바르지 않습니다.' }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let rows: RawExpenseRow[]
  try {
    rows = parseExcelBuffer(buffer, year)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 })
  }

  const { count } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('year', year)
  const existingCount = count ?? 0

  const response: ParsePreviewResponse = {
    rows,
    totalCount: rows.length,
    existingCount,
    sampleRows: rows.slice(0, 10),
    year,
  }

  return NextResponse.json(response)
}
