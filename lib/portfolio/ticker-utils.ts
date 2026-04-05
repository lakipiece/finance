// 클라이언트/서버 공용 티커 유틸 (server-only 없음)

export function isKrxTicker(ticker: string): boolean {
  const clean = ticker.startsWith('KRX:') ? ticker.slice(4) : ticker
  return /^\d{6}$/.test(clean.split('.')[0])
}

export function toYahooTicker(ticker: string): string {
  const clean = ticker.startsWith('KRX:') ? ticker.slice(4) : ticker
  if (isKrxTicker(ticker) && !clean.includes('.')) return `${clean}.KS`
  return clean
}
