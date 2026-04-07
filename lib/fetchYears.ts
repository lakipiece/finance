import 'server-only'
import { getSql } from './db'

export interface YearSummary {
  year: number
  count: number
  source?: string
  source_url?: string
}

export async function fetchAvailableYears(): Promise<YearSummary[]> {
  const sql = getSql()
  const rows = await sql<{ year: number; count: string; source: string | null; source_url: string | null }[]>`
    SELECT
      year,
      COUNT(*) AS count,
      MAX(source) AS source,
      MAX(source_url) AS source_url
    FROM expenses
    WHERE year IS NOT NULL
    GROUP BY year
    ORDER BY year DESC
  `

  return rows.map(r => ({
    year: r.year,
    count: Number(r.count),
    ...(r.source ? { source: r.source } : {}),
    ...(r.source_url ? { source_url: r.source_url } : {}),
  }))
}
