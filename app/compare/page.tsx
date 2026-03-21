import { fetchAvailableYears } from '@/lib/fetchYears'
import CompareClient from '@/components/CompareClient'

export const dynamic = 'force-dynamic'

export default async function ComparePage() {
  const availableYears = await fetchAvailableYears()
  return <CompareClient availableYears={availableYears} />
}
