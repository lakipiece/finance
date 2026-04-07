import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { fetchAvailableYears } from '@/lib/fetchYears'
import AdminClient from '@/components/AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await auth()
  const user = session?.user

  if (!user) redirect('/login')

  const years = await fetchAvailableYears()

  return <AdminClient initialYears={years} />
}
