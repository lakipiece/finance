import { fetchData } from '@/lib/fetchData'
import MonthlyClient from '@/components/MonthlyClient'

export const dynamic = 'force-dynamic'

export default async function MonthlyPage() {
  const data = await fetchData()
  return <MonthlyClient data={data} />
}
