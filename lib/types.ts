export interface MonthlyData {
  month: string
  고정비: number
  대출상환: number
  변동비: number
  여행공연비: number
  total: number
}

export interface CategoryTotal {
  고정비: number
  대출상환: number
  변동비: number
  여행공연비: number
}

export interface ExpenseItem {
  year: number
  date: string
  month: number
  category: string
  detail: string
  memo: string
  method: string
  amount: number
  member: string | null  // L or P
}

export interface DetailItem {
  name: string
  amount: number
}

export interface DashboardData {
  total: number
  monthlyAvg: number
  maxMonth: MonthlyData
  categoryTotals: CategoryTotal
  monthlyList: MonthlyData[]
  paymentMethods: Record<string, number>
  topExpenses: ExpenseItem[]
  variableDetail: DetailItem[]
  fixedDetail: DetailItem[]
  allExpenses: ExpenseItem[]
}

export interface RawExpenseRow {
  year: number
  month: number        // 1–12
  expense_date: string // 'YYYY-MM-DD'
  category: string     // '고정비' | '대출상환' | '변동비' | '여행공연비'
  detail: string       // '' if absent (never null)
  memo: string         // '' if absent (never null)
  method: string       // '' if absent (never null)
  amount: number       // positive integer (won)
  member: string | null // L or P
}

export interface ParsePreviewResponse {
  rows: RawExpenseRow[]
  totalCount: number
  existingCount: number
  sampleRows: RawExpenseRow[] // first 10 rows
  year: number
  source?: 'excel' | 'googlesheet'
  source_url?: string
  rawSample?: string[][] // first 3 raw rows for debugging when totalCount is 0
  /** 시트 연도와 날짜 연도가 달라 건너뛴 행 수 (연도 경계를 넘는 시트의 이중 계상 방지) */
  skippedOtherYear?: number
}
