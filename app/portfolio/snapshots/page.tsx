import { getSql } from '@/lib/db'
import SnapshotList from '@/components/portfolio/SnapshotList'
import SnapshotCharts from '@/components/portfolio/SnapshotCharts'
import type { Snapshot } from '@/lib/portfolio/types'

export const dynamic = 'force-dynamic'

export default async function SnapshotsPage() {
  const sql = getSql()
  const snapshotsData = await sql<Snapshot[]>`SELECT * FROM snapshots ORDER BY date DESC`
  const snapshots = snapshotsData

  // Chart data: compute for latest 5 snapshots
  const chartSnapshots = snapshots.slice(0, 5).reverse() // oldest first for chart

  const chartPoints = await Promise.all(
    chartSnapshots.map(async (snap) => {
      // Get holdings for this snapshot
      const holdings = await sql<{ security_id: string; quantity: number; avg_price: number }[]>`
        SELECT security_id, quantity, avg_price FROM holdings
        WHERE snapshot_id = ${snap.id} AND quantity > 0
      `

      if (!holdings || holdings.length === 0) {
        return { date: snap.date, total_market_value: 0, breakdown: {} }
      }

      // Get securities for asset_class info
      const secIds = [...new Set(holdings.map(h => h.security_id))]
      const securities = await sql<{ id: string; ticker: string; asset_class: string | null; currency: string }[]>`
        SELECT id, ticker, asset_class, currency FROM securities WHERE id = ANY(${secIds})
      `
      const secMap = Object.fromEntries(securities.map(s => [s.id, s]))

      // Get prices closest to snapshot date
      const tickers = securities.map(s => {
        const clean = s.ticker.startsWith('KRX:') ? s.ticker.slice(4) : s.ticker
        return /^\d{6}$/.test(clean.split('.')[0]) ? `${clean}.KS` : clean
      })
      tickers.push('KRW=X')

      const prices = await sql<{ ticker: string; price: number; currency: string; date: string }[]>`
        SELECT ticker, price, currency, date FROM price_history
        WHERE ticker = ANY(${tickers}) AND date <= ${snap.date}
        ORDER BY date DESC
      `

      // Latest price per ticker up to snapshot date
      const priceMap: Record<string, number> = {}
      for (const p of prices) {
        if (!priceMap[p.ticker]) priceMap[p.ticker] = p.price
      }
      const exchangeRate = priceMap['KRW=X'] ?? 1350

      // Compute market values
      let total = 0
      const breakdown: Record<string, number> = {}

      for (const h of holdings) {
        const sec = secMap[h.security_id]
        if (!sec) continue
        const clean = sec.ticker.startsWith('KRX:') ? sec.ticker.slice(4) : sec.ticker
        const isKrx = /^\d{6}$/.test(clean.split('.')[0])
        const yahooTicker = isKrx ? `${clean}.KS` : clean
        const rawPrice = priceMap[yahooTicker] ?? 0
        const isKrw = isKrx || sec.currency === 'KRW'
        const priceKrw = isKrw ? rawPrice : rawPrice * exchangeRate
        const value = priceKrw * h.quantity
        total += value
        const key = sec.asset_class ?? sec.ticker
        breakdown[key] = (breakdown[key] ?? 0) + value
      }

      // Convert breakdown to percentages
      const breakdownPct: Record<string, number> = {}
      for (const [k, v] of Object.entries(breakdown)) {
        breakdownPct[k] = total > 0 ? Math.round((v / total) * 1000) / 10 : 0
      }

      return { date: snap.date, total_market_value: total, breakdown: breakdownPct }
    })
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <SnapshotCharts points={chartPoints} />
      <SnapshotList snapshots={snapshots} />
    </div>
  )
}
