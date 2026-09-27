'use client'

// 공통 상수·폼 컨텍스트·금액 헬퍼 (app/input/page.tsx에서 분리)
import { DEFAULT_MEMBER_COLORS } from '@/lib/palettes'
import { createContext } from 'react'
import { evaluateArithmetic } from '@/lib/formula'
import { color as tone } from '@/lib/styles'

/* ── Constants ── */
export interface MemberOpt { code: string; display_name: string; color: string }
export interface MethodOpt { name: string; color: string }
export const DEFAULT_MEMBERS: MemberOpt[] = [
  { code: 'L', display_name: 'L', color: DEFAULT_MEMBER_COLORS.L },
  { code: 'P', display_name: 'P', color: DEFAULT_MEMBER_COLORS.P },
]
export const DEFAULT_METHODS: MethodOpt[] = [
  { name: '카드', color: tone.ink5 },
  { name: '현금', color: tone.ink5 },
]
export const FormCtx = createContext<{
  memberOpts: MemberOpt[]
  methodOpts: MethodOpt[]
  detailsByCategory: Record<string, string[]>
}>({
  memberOpts: DEFAULT_MEMBERS,
  methodOpts: DEFAULT_METHODS,
  detailsByCategory: {},
})

/* ── Helpers ── */
export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtAmount(v: string) {
  const isNegative = v.trimStart().startsWith('-')
  const n = v.replace(/[^0-9]/g, '')
  if (!n) return isNegative ? '-' : ''
  return (isNegative ? '-' : '') + Number(n).toLocaleString('ko-KR')
}

export function parseAmount(v: string) {
  const isNegative = v.trimStart().startsWith('-')
  const digits = parseInt(v.replace(/[^0-9]/g, '')) || 0
  return isNegative ? -digits : digits
}

export function isFormula(v: string) {
  return v.trimStart().startsWith('=')
}

export function evalFormula(expr: string): number | null {
  const clean = expr.replace(/^=/, '').replace(/,/g, '').trim()
  if (!clean) return null
  const result = evaluateArithmetic(clean)
  return result !== null && result > 0 ? Math.round(result) : null
}

/* ── Auto-resize textarea ── */
