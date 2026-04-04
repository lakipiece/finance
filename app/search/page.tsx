import { fetchData } from '@/lib/fetchData'
import { fetchAvailableYears } from '@/lib/fetchYears'
import SearchClient from '@/components/SearchClient'

export const dynamic = 'force-dynamic'

export default async function SearchPage() {
  const years = await fetchAvailableYears()
  if (years.length === 0) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <p className="text-slate-400 text-lg">데이터가 없습니다.</p>
    </div>
  )

  const latestYear = years[0].year
  const data = await fetchData(latestYear)

  return (
    <SearchClient
      initialExpenses={data?.allExpenses ?? []}
      initialYear={latestYear}
      availableYears={years.map(y => y.year)}
    />
  )
}
