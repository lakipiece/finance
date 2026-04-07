import 'server-only'
import * as XLSX from 'xlsx'
import type { RawExpenseRow } from './types'

function toDateString(val: unknown): string {
  if (val instanceof Date) {
    const y = val.getUTCFullYear()
    const m = String(val.getUTCMonth() + 1).padStart(2, '0')
    const d = String(val.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return ''
}

// The month column stores the last day of the previous month in KST.
// Reading via UTC gives the previous month → add 9h (KST) → next month = actual month.
const KST_MS = 9 * 60 * 60 * 1000
function monthFromMolCol(val: unknown): number | null {
  if (!(val instanceof Date)) return null
  const kst = new Date(val.getTime() + KST_MS)
  const raw = kst.getUTCMonth() + 1
  return (raw % 12) + 1
}

export function parseExcelBuffer(buffer: Buffer, year: number): RawExpenseRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  const ws = wb.Sheets['지출내역']
  if (!ws) throw new Error('시트 "지출내역"을 찾을 수 없습니다.')

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][]

  const result: RawExpenseRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const dateVal = row[0]
    const monthVal = row[1]
    const cat = row[4] != null ? String(row[4]).trim() : null
    const detail = row[5] != null ? String(row[5]).trim() : ''
    const method = row[6] != null ? String(row[6]).trim() : ''
    const rawAmt = row[7]
    const member = row[8] != null ? String(row[8]).trim() || null : null
    const memo = row[9] != null ? String(row[9]).trim() : ''

    if (!cat || rawAmt == null) continue

    const amount = typeof rawAmt === 'number' ? rawAmt : parseFloat(String(rawAmt))
    if (isNaN(amount) || amount <= 0) continue

    const monthNum = monthFromMolCol(monthVal)
    if (!monthNum || monthNum < 1 || monthNum > 12) continue

    result.push({
      year,
      month: monthNum,
      expense_date: toDateString(dateVal),
      category: cat,
      detail,
      method,
      amount: Math.round(amount),
      memo,
      member,
    })
  }

  return result
}
