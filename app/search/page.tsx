import { fetchData } from '@/lib/fetchData'
import SearchClient from '@/components/SearchClient'

export const dynamic = 'force-dynamic'

export default async function SearchPage() {
  const data = await fetchData()
  if (!data) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <p className="text-slate-400 text-lg">데이터가 없습니다.</p>
    </div>
  )
  return <SearchClient allExpenses={data.allExpenses} />
}
