import 'server-only'
import { supabase } from './supabase'

export async function fetchAvailableYears(): Promise<{ year: number; count: number }[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('year')

  if (error || !data) return []

  const counts: Record<number, number> = {}
  for (const row of data) {
    if (row.year) counts[row.year] = (counts[row.year] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year)
}
