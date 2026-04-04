import 'server-only'
import yahooFinance from 'yahoo-finance2'
import type { Quote } from 'yahoo-finance2/modules/quote'
import { supabase } from '@/lib/supabase'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1시간

export async function getPrices(tickers: string[]): Promise<Record<string, { price: number; currency: string }>> {
  if (tickers.length === 0) return {}

  const { data: cached } = await supabase
    .from('price_cache')
    .select('ticker, price, currency, fetched_at')
    .in('ticker', tickers)

  const now = Date.now()
  const result: Record<string, { price: number; currency: string }> = {}
  const stale: string[] = []

  for (const ticker of tickers) {
    const hit = cached?.find(c => c.ticker === ticker)
    if (hit && now - new Date(hit.fetched_at).getTime() < CACHE_TTL_MS) {
      result[ticker] = { price: hit.price, currency: hit.currency }
    } else {
      stale.push(ticker)
    }
  }

  if (stale.length === 0) return result

  const updates: { ticker: string; price: number; currency: string; fetched_at: string }[] = []

  await Promise.allSettled(
    stale.map(async (ticker) => {
      try {
        const quote = await yahooFinance.quote(ticker) as Quote
        const price = (quote as { regularMarketPrice?: number }).regularMarketPrice ?? 0
        const currency = (quote as { currency?: string }).currency ?? 'USD'
        result[ticker] = { price, currency }
        updates.push({ ticker, price, currency, fetched_at: new Date().toISOString() })
      } catch {
        const old = cached?.find(c => c.ticker === ticker)
        if (old) result[ticker] = { price: old.price, currency: old.currency }
      }
    })
  )

  if (updates.length > 0) {
    await supabase.from('price_cache').upsert(updates, { onConflict: 'ticker' })
  }

  return result
}
