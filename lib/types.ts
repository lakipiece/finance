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
