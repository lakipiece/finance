import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { cleanTicker, kstTradingDate } from '@/lib/portfolio/valuation'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yahooFinance = new YahooFinance()

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker } = await req.json()
  if (!ticker || typeof ticker !== 'string') {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  }

  const sql = getSql()

  // securities에 등록된 종목만 허용 (임의 문자열 저장 방지)
  // 요청 티커는 Yahoo 형식(005930.KS)일 수 있으므로 접미사 제거형도 함께 비교
  const bare = cleanTicker(ticker).replace(/\.(KS|KQ)$/i, '')
  const [known] = await sql`
    SELECT 1 FROM securities WHERE ticker = ${ticker} OR ticker = ${bare} LIMIT 1
  `
  if (!known) {
    return NextResponse.json({ error: `등록되지 않은 종목: ${ticker}` }, { status: 400 })
  }

  // 일괄 수집과 동일한 KST 거래일 기준으로 저장 (날짜 불일치 방지)
  const today = kstTradingDate()

  try {
    const quote = await yahooFinance.quote(ticker)
    const price = (quote as any).regularMarketPrice ?? 0
    const currency = (quote as any).currency ?? 'USD'

    if (price <= 0) {
      return NextResponse.json({ error: `가격 조회 실패: price=0` }, { status: 422 })
    }

    await sql`
      INSERT INTO price_history (ticker, date, price, currency)
      VALUES (${ticker}, ${today}, ${price}, ${currency})
      ON CONFLICT (ticker, date) DO UPDATE SET price = EXCLUDED.price, currency = EXCLUDED.currency
    `

    return NextResponse.json({ ticker, price, currency })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 422 }
    )
  }
}
