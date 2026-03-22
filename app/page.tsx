import { fetchData } from '@/lib/fetchData'
import Dashboard from '@/components/Dashboard'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: { year?: string } }) {
  const currentYear = new Date().getFullYear()
  const year = searchParams.year ? parseInt(searchParams.year) : currentYear
  const data = await fetchData(year)
  return <Dashboard data={data} />
}
