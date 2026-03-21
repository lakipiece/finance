import { fetchData } from '@/lib/fetchData'
import SearchClient from '@/components/SearchClient'

export const dynamic = 'force-dynamic'

export default async function SearchPage() {
  const data = await fetchData()
  return <SearchClient allExpenses={data.allExpenses} />
}
