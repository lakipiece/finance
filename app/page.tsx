import { fetchData } from '@/lib/fetchData'
import Dashboard from '@/components/Dashboard'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: { year?: string } }) {
  const currentYear = new Date().getFullYear()
  const parsed = parseInt(searchParams.year ?? '')
  const year = !isNaN(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : currentYear

  const data = await fetchData(year)

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-slate-400 text-lg">{year}년 데이터가 없습니다.</p>
        <p className="text-slate-300 text-sm mt-2">관리자 페이지에서 데이터를 업로드해주세요.</p>
      </div>
    )
  }

  return <Dashboard data={data} />
}
