import { describe, expect, it } from 'vitest'
import {
  accrualFactor, costKrw, fixedPriceOf, isKrwSecurity, kstToday, kstTradingDate,
  lookupPrice, priceLookupKeys, resolveExchangeRate, resolvePrice, toDateStr,
  EXCHANGE_RATE_FALLBACK,
} from '@/lib/portfolio/valuation'
import { lastInterestMap } from '@/lib/portfolio/interest'

describe('KRW 판정 · 가격 키', () => {
  it('국내·KRW 통화·KRX 티커 패턴 중 하나면 원화 종목', () => {
    expect(isKrwSecurity({ ticker: 'SCHD', country: '미국', currency: 'USD' })).toBe(false)
    expect(isKrwSecurity({ ticker: 'ISA-RP', country: '국내' })).toBe(true)
    expect(isKrwSecurity({ ticker: 'X', currency: 'KRW' })).toBe(true)
    expect(isKrwSecurity({ ticker: '005930' })).toBe(true)
    expect(isKrwSecurity({ ticker: '0086B0' })).toBe(true) // 영문 혼합 KRX
  })

  it('국내 종목은 .KS 우선, bare 차선 — 코인/현금은 bare로 저장되기 때문', () => {
    expect(priceLookupKeys('005930', '국내')).toEqual(['005930.KS', '005930'])
    expect(priceLookupKeys('KRX:005930')).toEqual(['005930.KS', '005930'])
    expect(priceLookupKeys('SCHD', '미국')).toEqual(['SCHD'])
    expect(priceLookupKeys('BRK.B')).toEqual(['BRK.B'])
  })

  it('lookupPrice는 0 이하 가격을 무시한다', () => {
    expect(lookupPrice({ '005930.KS': 0, '005930': 70000 }, '005930', '국내')).toBe(70000)
    expect(lookupPrice({}, 'SCHD')).toBeNull()
  })
})

describe('환율', () => {
  it('USDKRW=X 우선, KRW=X alias, 없으면 기본값 + fallback 표시', () => {
    expect(resolveExchangeRate({ 'USDKRW=X': 1400, 'KRW=X': 1300 })).toEqual({ rate: 1400, isFallback: false })
    expect(resolveExchangeRate({ 'KRW=X': 1300 })).toEqual({ rate: 1300, isFallback: false })
    expect(resolveExchangeRate({})).toEqual({ rate: EXCHANGE_RATE_FALLBACK, isFallback: true })
  })
})

describe('고정단가', () => {
  it('numeric 문자열을 숫자로, 미설정은 null', () => {
    expect(fixedPriceOf({ ticker: 'KRW', fixed_price: '1' })).toBe(1)
    expect(fixedPriceOf({ ticker: 'SCHD' })).toBeNull()
    expect(fixedPriceOf({ ticker: 'X', fixed_price: 'abc' })).toBeNull()
  })

  it('고정단가가 있으면 시세를 무시한다 — 오래된 가격 이력이 남아 있어도', () => {
    const map = { 'ISA-RP': 999 }
    expect(resolvePrice(map, { ticker: 'ISA-RP', fixed_price: 1 })).toBe(1)
    expect(resolvePrice(map, { ticker: 'ISA-RP' })).toBe(999)
    expect(resolvePrice({}, { ticker: 'NONE' })).toBeNull()
  })
})

describe('미수이자', () => {
  const sec = { ticker: 'ISA-RP', fixed_price: '1', annual_rate: '0.035', accrual_start: '2026-01-01' }

  it('단리: 1 + 연이율 × 경과일/365', () => {
    expect(accrualFactor(sec, '2026-09-27')).toBeCloseTo(1 + 0.035 * 269 / 365, 10)
  })

  it('이자 지급 기록이 있으면 그날부터 다시 센다 (이중 계상 방지)', () => {
    expect(accrualFactor(sec, '2026-09-27', '2026-06-30')).toBeCloseTo(1 + 0.035 * 89 / 365, 10)
    // 기산일보다 이른 지급 기록은 무시
    expect(accrualFactor(sec, '2026-09-27', '2025-12-01')).toBeCloseTo(1 + 0.035 * 269 / 365, 10)
  })

  it('만기일에 정지, 기산일 이전·이율 없음은 1', () => {
    expect(accrualFactor({ ...sec, maturity_date: '2026-03-01' }, '2026-09-27')).toBeCloseTo(1 + 0.035 * 59 / 365, 10)
    expect(accrualFactor(sec, '2025-12-01')).toBe(1)
    expect(accrualFactor({ ...sec, annual_rate: null }, '2026-09-27')).toBe(1)
  })

  it('resolvePrice는 ctx가 있을 때만 이자를 얹는다', () => {
    const s = { ...sec, id: 'rp' }
    expect(resolvePrice({}, s)).toBe(1)
    const withCtx = resolvePrice({}, s, { asOf: '2026-09-27', lastInterestBySecurity: { rp: '2026-06-30' } })
    expect(withCtx).toBeCloseTo(1 + 0.035 * 89 / 365, 10)
  })

  it('lastInterestMap은 기준일 이전 가장 늦은 지급일', () => {
    const payments = [
      { security_id: 'a', paid_at: '2026-03-31' },
      { security_id: 'a', paid_at: '2026-06-30' },
      { security_id: 'a', paid_at: '2026-09-30' },
      { security_id: 'b', paid_at: '2026-01-15' },
    ]
    expect(lastInterestMap(payments, '2026-09-27')).toEqual({ a: '2026-06-30', b: '2026-01-15' })
    expect(lastInterestMap(payments, '2026-01-01')).toEqual({})
  })
})

describe('원가(costKrw)', () => {
  it('원화 종목은 평균단가 × 수량', () => {
    expect(costKrw({ avgPrice: 50000, quantity: 10, isKrw: true, fxRate: 1400 })).toBe(500000)
  })

  it('USD 종목: 매입환율이 있으면 고정 — 평가 환율이 움직여도 원가 불변', () => {
    const base = { avgPrice: 100, quantity: 10, isKrw: false, avgFxRate: 1300 }
    expect(costKrw({ ...base, fxRate: 1400 })).toBe(1_300_000)
    expect(costKrw({ ...base, fxRate: 1500 })).toBe(1_300_000)
  })

  it('매입환율이 없거나 비정상이면 평가 시점 환율로 폴백', () => {
    expect(costKrw({ avgPrice: 100, quantity: 10, isKrw: false, fxRate: 1400 })).toBe(1_400_000)
    expect(costKrw({ avgPrice: 100, quantity: 10, isKrw: false, fxRate: 1400, avgFxRate: 0 })).toBe(1_400_000)
    expect(costKrw({ avgPrice: '100', quantity: '10', isKrw: false, fxRate: 1400, avgFxRate: '1350.5' })).toBe(1_350_500)
  })

  it('평균단가 없음 → 0', () => {
    expect(costKrw({ avgPrice: null, quantity: 10, isKrw: true, fxRate: 1400 })).toBe(0)
  })
})

describe('날짜', () => {
  it('KST 오늘 — UTC 15시 이후는 다음 날', () => {
    expect(kstToday(new Date('2026-09-27T14:59:00Z'))).toBe('2026-09-27')
    expect(kstToday(new Date('2026-09-27T15:00:00Z'))).toBe('2026-09-28')
  })

  it('KST 거래일 — KST 12시 이전은 전날(미국장 마감 직후)', () => {
    expect(kstTradingDate(new Date('2026-09-27T02:00:00Z'))).toBe('2026-09-26') // KST 11:00
    expect(kstTradingDate(new Date('2026-09-27T03:00:00Z'))).toBe('2026-09-27') // KST 12:00
  })

  it('toDateStr', () => {
    expect(toDateStr(new Date('2026-09-27T00:00:00Z'))).toBe('2026-09-27')
    expect(toDateStr('2026-09-27T12:00:00')).toBe('2026-09-27')
    expect(toDateStr(null)).toBe('')
  })
})
