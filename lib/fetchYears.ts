import 'server-only'
import { supabase } from './supabase'

export interface YearSummary {
  year: number
  count: number
  source?: string
  source_url?: string
}

export async function fetchAvailableYears(): Promise<YearSummary[]> {
  const counts: Record<number, number> = {}
  const sources: Record<number, { source?: string; source_url?: string }> = {}
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('expenses')
      .select('year, source, source_url')
      .range(offset, offset + pageSize - 1)

    if (error || !data || data.length === 0) break
    for (const row of data) {
      if (row.year) {
        counts[row.year] = (counts[row.year] ?? 0) + 1
        if (!sources[row.year] && row.source) {
          sources[row.year] = { source: row.source, source_url: row.source_url ?? '' }
        }
      }
    }
    if (data.length < pageSize) break
    offset += pageSize
  }

  return Object.entries(counts)
    .map(([year, count]) => ({
      year: Number(year),
      count,
      ...sources[Number(year)],
    }))
    .sort((a, b) => b.year - a.year)
}
