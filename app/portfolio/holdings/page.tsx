import { fetchAccounts, fetchSecurities } from '@/lib/portfolio/fetch'
import HoldingsManager from '@/components/portfolio/HoldingsManager'

export const dynamic = 'force-dynamic'

export default async function HoldingsPage() {
  const [accounts, securities] = await Promise.all([fetchAccounts(), fetchSecurities()])
  return <HoldingsManager accounts={accounts} securities={securities} />
}
