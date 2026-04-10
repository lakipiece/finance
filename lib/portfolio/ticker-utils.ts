// 클라이언트/서버 공용 티커 유틸 (server-only 없음)

export function isKrxTicker(ticker: string): boolean {
  const clean = ticker.startsWith('KRX:') ? ticker.slice(4) : ticker
  // KRX 티커: 6자리, 첫 글자 숫자 (숫자전용 + 영문혼합 모두 포함)
  return /^\d[A-Z0-9]{5}$/i.test(clean.split('.')[0])
}

export function toYahooTicker(ticker: string, country?: string | null): string {
  const clean = ticker.startsWith('KRX:') ? ticker.slice(4) : ticker
  if (clean.includes('.')) return clean
  // country가 명시적으로 국내이거나, country 없을 때 티커 패턴으로 판단
  const isKrx = country === '국내' || (!country && isKrxTicker(ticker))
  if (isKrx) return `${clean}.KS`
  return clean
}
