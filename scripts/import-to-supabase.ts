/**
 * 엑셀 데이터를 Supabase에 import하는 일회성 스크립트
 * 실행: npm run import-data
 */
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ .env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 설정하세요.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const KST_MS = 9 * 60 * 60 * 1000

function getKstMonth(val: unknown): number | null {
  if (!(val instanceof Date)) return null
  const kst = new Date(val.getTime() + KST_MS)
  const raw = kst.getUTCMonth() + 1
  return (raw % 12) + 1
}

function toDateStr(val: unknown): string {
  if (!(val instanceof Date)) return ''
  const d = new Date(val.getTime() + KST_MS)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

async function main() {
  console.log('📂 엑셀 파일 읽는 중...')
  const filePath = path.join(process.cwd(), 'data', '2022 가계부.xlsx')
  const buf = fs.readFileSync(filePath)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets['지출내역']
  if (!ws) throw new Error('시트 "지출내역"을 찾을 수 없습니다.')

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as unknown[][]

  const records: object[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const dateVal = row[0]
    const monthVal = row[1]
    const category = row[4] != null ? String(row[4]).trim() : null
    const detail = row[5] != null ? String(row[5]).trim() : ''
    const method = row[6] != null ? String(row[6]).trim() : ''
    const rawAmt = row[7]

    if (!category || rawAmt == null) continue
    const amount = typeof rawAmt === 'number' ? rawAmt : parseFloat(String(rawAmt))
    if (isNaN(amount) || amount <= 0) continue

    const month = getKstMonth(monthVal)
    if (!month) continue

    records.push({
      expense_date: toDateStr(dateVal),
      month,
      year: 2022,
      category,
      detail,
      method,
      amount: Math.round(amount),
    })
  }

  console.log(`✅ 파싱 완료: ${records.length}건`)

  // 기존 데이터 삭제
  console.log('🗑️  기존 데이터 삭제 중...')
  const { error: delError } = await supabase.from('expenses').delete().neq('id', 0)
  if (delError) throw new Error(`삭제 실패: ${delError.message}`)

  // 배치 insert
  const BATCH = 200
  console.log(`📤 Supabase에 ${records.length}건 삽입 중...`)
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const { error } = await supabase.from('expenses').insert(batch)
    if (error) throw new Error(`삽입 실패 (${i}~${i + BATCH}): ${error.message}`)
    console.log(`  ${Math.min(i + BATCH, records.length)}/${records.length} 완료`)
  }

  console.log('🎉 import 완료!')
}

main().catch((e) => {
  console.error('❌ 오류:', e.message)
  process.exit(1)
})
