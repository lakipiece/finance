import IncomeClient from '@/components/IncomeClient'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams
  const currentYear = new Date().getFullYear()
  const parsed = parseInt(params.year ?? '')
  const year = !isNaN(parsed) && parsed >= 2000 ? parsed : currentYear
  return <IncomeClient year={year} />
}
