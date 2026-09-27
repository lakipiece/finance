import { describe, expect, it } from 'vitest'
import { evaluateArithmetic } from '@/lib/formula'

describe('evaluateArithmetic', () => {
  it('사칙연산 우선순위와 괄호', () => {
    expect(evaluateArithmetic('1200*3+500')).toBe(4100)
    expect(evaluateArithmetic('(1200+300)*2')).toBe(3000)
    expect(evaluateArithmetic('10-2-3')).toBe(5)
    expect(evaluateArithmetic('100/4/5')).toBe(5)
    expect(evaluateArithmetic(' 1 + 2 * 3 ')).toBe(7)
  })

  it('단항 부호·소수', () => {
    expect(evaluateArithmetic('-5+10')).toBe(5)
    expect(evaluateArithmetic('-(2+3)')).toBe(-5)
    expect(evaluateArithmetic('1.5*2')).toBe(3)
    expect(evaluateArithmetic('.5*4')).toBe(2)
  })

  it('해석 불가·코드 주입은 null', () => {
    expect(evaluateArithmetic('')).toBeNull()
    expect(evaluateArithmetic('1+')).toBeNull()
    expect(evaluateArithmetic('(1+2')).toBeNull()
    expect(evaluateArithmetic('1 2')).toBeNull()
    expect(evaluateArithmetic('alert(1)')).toBeNull()
    expect(evaluateArithmetic('1/0')).toBeNull()
  })
})
