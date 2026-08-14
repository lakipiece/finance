import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { fetchAvailableYears } from '@/lib/fetchYears'
import SettingsClient from '@/components/SettingsClient'
import HistoricalPriceFetcher from '@/components/portfolio/HistoricalPriceFetcher'
import LogoutButton from '@/components/LogoutButton'
import PageHeader from '@/components/ui/PageHeader'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const years = await fetchAvailableYears()

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <PageHeader title="설정" description="연도 데이터 관리">
        <LogoutButton />
      </PageHeader>
      <SettingsClient initialYears={years} />
      <div>
        <h3 className="text-xs font-semibold text-slate-500 mb-3">포트폴리오 데이터 관리</h3>
        <HistoricalPriceFetcher />
      </div>
    </div>
  )
}
