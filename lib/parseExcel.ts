import 'server-only'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import type { DashboardData, MonthlyData, ExpenseItem, DetailItem, CategoryTotal } from './types'

const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function toDateString(val: unknown): string {
  if (val instanceof Date) {
    const y = val.getUTCFullYear()
    const m = String(val.getUTCMonth() + 1).padStart(2, '0')
    const d = String(val.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return ''
}

// 월 컬럼은 전달 말일을 KST로 저장 → UTC Date로 읽히므로 +9h 후 다음달이 실제 월
const KST_MS = 9 * 60 * 60 * 1000
function monthFromMolCol(val: unknown): number | null {
  if (!(val instanceof Date)) return null
  const kst = new Date(val.getTime() + KST_MS)
  const raw = kst.getUTCMonth() + 1  // 전달 번호
  return (raw % 12) + 1              // 실제 월 (12월 → 1월 순환 포함)
}

export function parseExcel(): DashboardData {
  const filePath = path.join(process.cwd(), 'data', '2022 가계부.xlsx')
  const buf = fs.readFileSync(filePath)
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })

  const ws = wb.Sheets['지출내역']
  if (!ws) throw new Error('시트 "지출내역"을 찾을 수 없습니다.')

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][]

  const monthly: Record<number, Record<string, number>> = {}
  const methods: Record<string, number> = {}
  const detailByCat: Record<string, Record<string, number>> = {}
  const allExpenses: ExpenseItem[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const dateVal = row[0]   // 날짜 컬럼 (표시용)
    const monthVal = row[1]  // 월 컬럼 (전달 말일 → +1로 실제 월 계산)
    const cat = row[4] != null ? String(row[4]).trim() : null
    const detail = row[5] != null ? String(row[5]).trim() : ''
    const method = row[6] != null ? String(row[6]).trim() : ''
    const rawAmt = row[7]

    if (!cat || rawAmt == null) continue

    const amount = typeof rawAmt === 'number' ? rawAmt : parseFloat(String(rawAmt))
    if (isNaN(amount) || amount <= 0) continue

    const monthNum = monthFromMolCol(monthVal)
    if (!monthNum) continue

    const dateStr = toDateString(dateVal)

    if (!monthly[monthNum]) monthly[monthNum] = {}
    monthly[monthNum][cat] = (monthly[monthNum][cat] ?? 0) + amount

    if (method) {
      methods[method] = (methods[method] ?? 0) + amount
    }

    if (!detailByCat[cat]) detailByCat[cat] = {}
    const key = detail || '기타'
    detailByCat[cat][key] = (detailByCat[cat][key] ?? 0) + amount

    allExpenses.push({ date: dateStr, month: monthNum, category: cat, detail, method, amount })
  }

  const monthlyList: MonthlyData[] = MONTH_NAMES.map((name, i) => {
    const m = i + 1
    const d = monthly[m] ?? {}
    const 고정비 = Math.round(d['고정비'] ?? 0)
    const 대출상환 = Math.round(d['대출상환'] ?? 0)
    const 변동비 = Math.round(d['변동비'] ?? 0)
    const 여행공연비 = Math.round(d['여행공연비'] ?? 0)
    return { month: name, 고정비, 대출상환, 변동비, 여행공연비, total: 고정비 + 대출상환 + 변동비 + 여행공연비 }
  })

  const total = monthlyList.reduce((sum, m) => sum + m.total, 0)

  const categoryTotals: CategoryTotal = {
    고정비: monthlyList.reduce((s, m) => s + m.고정비, 0),
    대출상환: monthlyList.reduce((s, m) => s + m.대출상환, 0),
    변동비: monthlyList.reduce((s, m) => s + m.변동비, 0),
    여행공연비: monthlyList.reduce((s, m) => s + m.여행공연비, 0),
  }

  const maxMonth = monthlyList.reduce((a, b) => a.total > b.total ? a : b)

  const topExpenses = [...allExpenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20)

  function toDetailItems(cat: string): DetailItem[] {
    return Object.entries(detailByCat[cat] ?? {})
      .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
  }

  return {
    total: Math.round(total),
    monthlyAvg: Math.round(total / 12),
    maxMonth,
    categoryTotals,
    monthlyList,
    paymentMethods: Object.fromEntries(
      Object.entries(methods).map(([k, v]) => [k, Math.round(v)])
    ),
    topExpenses,
    variableDetail: toDetailItems('변동비'),
    fixedDetail: toDetailItems('고정비'),
    allExpenses,
  }
}
