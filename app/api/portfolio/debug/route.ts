import { NextResponse } from 'next/server'
import { fetchPortfolioSummary } from '@/lib/portfolio/fetch'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const summary = await fetchPortfolioSummary()
    return NextResponse.json({
      positionsCount: summary.positions.length,
      total_market_value: summary.total_market_value,
      total_invested: summary.total_invested,
      samplePositions: summary.positions.slice(0, 2).map(p => ({
        ticker: p.security.ticker,
        quantity: p.quantity,
        current_price: p.current_price,
        market_value: p.market_value,
      })),
    })
  } catch (err: unknown) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : null,
    }, { status: 500 })
  }
}
