import BudgetClient from '@/components/BudgetClient'

export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: { year?: string } }) {
  const currentYear = new Date().getFullYear()
  const parsed = parseInt(searchParams.year ?? '')
  const year = !isNaN(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : currentYear

  return <BudgetClient initialYear={year} />
}
