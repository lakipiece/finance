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
  date: string
  month: number
  category: string
  detail: string
  method: string
  amount: number
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
  method: string       // '' if absent (never null)
  amount: number       // positive integer (won)
}

export interface ParsePreviewResponse {
  rows: RawExpenseRow[]
  totalCount: number
  duplicateCount: number
  sampleRows: RawExpenseRow[] // first 10 rows
  year: number
}
