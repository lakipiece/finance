import DashboardClient from '@/components/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year: yearParam } = await searchParams
  const currentYear = new Date().getFullYear()
  const parsed = parseInt(yearParam ?? '')
  const year = !isNaN(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : currentYear

  return <DashboardClient year={year} />
}
