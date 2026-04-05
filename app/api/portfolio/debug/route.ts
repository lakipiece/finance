import { NextResponse } from 'next/server'
import { getPrices } from '@/lib/portfolio/prices'

export const dynamic = 'force-dynamic'

export async function GET() {
  const testTickers = ['SCHD', 'KRW=X', '005930.KS']
  let prices: Record<string, { price: number; currency: string }> = {}
  let priceError: string | null = null

  try {
    prices = await getPrices(testTickers)
  } catch (err: unknown) {
    priceError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({ prices, priceError })
}
