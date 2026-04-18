import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { fetchAvailableYears } from '@/lib/fetchYears'
import SettingsClient from '@/components/SettingsClient'
import HistoricalPriceFetcher from '@/components/portfolio/HistoricalPriceFetcher'
import LogoutButton from '@/components/LogoutButton'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const years = await fetchAvailableYears()

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>설정</h1>
          <p className="text-xs text-slate-400 mt-0.5">연도 데이터 관리</p>
        </div>
        <LogoutButton />
      </div>
      <SettingsClient initialYears={years} />
      <div>
        <h3 className="text-xs font-semibold text-slate-500 mb-3">포트폴리오 데이터 관리</h3>
        <HistoricalPriceFetcher />
      </div>
    </div>
  )
}
