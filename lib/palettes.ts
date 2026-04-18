// lib/palettes.ts — Metric Slate 고정 팔레트 (테마 선택 없음)
export interface Palette {
  id: string
  name: string
  colors: [string, string, string, string]  // [고정비, 대출상환, 변동비, 여행공연비]
  headerGradient: string
}

export const DEFAULT_PALETTE: Palette = {
  id: 'metric-slate',
  name: 'Metric Slate',
  colors: ['#1A237E', '#B71C1C', '#00695C', '#E65100'],
  headerGradient: 'linear-gradient(135deg, #1A237E 0%, #00695C 100%)',
}

export const PALETTES: Palette[] = [DEFAULT_PALETTE]
