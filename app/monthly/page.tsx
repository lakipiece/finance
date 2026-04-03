import { redirect } from 'next/navigation'

export default function MonthlyPage({ searchParams }: { searchParams: { year?: string } }) {
  const yearParam = searchParams.year ? `?year=${searchParams.year}` : ''
  redirect(`/${yearParam}`)
}
