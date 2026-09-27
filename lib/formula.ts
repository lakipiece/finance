/**
 * 금액 입력용 사칙연산 계산기 — `=1200*3+500` 같은 수식.
 * new Function 대신 재귀 하강 파서로 숫자·+ - * / ·괄호·단항 부호만 해석한다.
 * 해석할 수 없으면 null.
 */
export function evaluateArithmetic(input: string): number | null {
  const src = input.trim()
  if (!src) return null
  let pos = 0

  // 공백은 토큰 사이에서만 건너뛴다 — '1 2'를 12로 붙여 읽지 않도록
  function skip() { while (src[pos] === ' ' || src[pos] === '\t') pos++ }
  function peek(): string { skip(); return src[pos] ?? '' }

  // expr := term (('+'|'-') term)*
  function expr(): number {
    let v = term()
    while (peek() === '+' || peek() === '-') {
      const op = src[pos++]
      const r = term()
      v = op === '+' ? v + r : v - r
    }
    return v
  }

  // term := factor (('*'|'/') factor)*
  function term(): number {
    let v = factor()
    while (peek() === '*' || peek() === '/') {
      const op = src[pos++]
      const r = factor()
      v = op === '*' ? v * r : v / r
    }
    return v
  }

  // factor := ('+'|'-') factor | '(' expr ')' | number
  function factor(): number {
    const c = peek()
    if (c === '+' || c === '-') {
      pos++
      const v = factor()
      return c === '-' ? -v : v
    }
    if (c === '(') {
      pos++
      const v = expr()
      if (peek() !== ')') throw new Error('missing )')
      pos++
      return v
    }
    skip()
    const m = /^\d+(\.\d+)?|^\.\d+/.exec(src.slice(pos))
    if (!m) throw new Error('number expected')
    pos += m[0].length
    return Number(m[0])
  }

  try {
    const v = expr()
    skip()
    if (pos !== src.length) return null
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}
