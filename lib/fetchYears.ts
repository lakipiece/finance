import 'server-only'
import { supabase } from './supabase'

export async function fetchAvailableYears(): Promise<{ year: number; count: number }[]> {
  const counts: Record<number, number> = {}
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('expenses')
      .select('year')
      .range(offset, offset + pageSize - 1)

    if (error || !data || data.length === 0) break
    for (const row of data) {
      if (row.year) counts[row.year] = (counts[row.year] ?? 0) + 1
    }
    if (data.length < pageSize) break
    offset += pageSize
  }

  return Object.entries(counts)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year)
}
