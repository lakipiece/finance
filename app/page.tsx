import { fetchData } from '@/lib/fetchData'
import Dashboard from '@/components/Dashboard'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const data = await fetchData()
  return <Dashboard data={data} />
}
