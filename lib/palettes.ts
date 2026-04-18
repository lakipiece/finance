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

// 옵션 항목용 30색 팔레트 (Metric Slate 톤)
export const OPTION_COLORS: string[] = [
  // Blues
  '#1A237E','#283593','#1565C0','#0277BD','#01579B',
  // Teals & Greens
  '#00695C','#00796B','#006064','#00838F','#2E7D32','#33691E',
  // Purples & Indigo
  '#4527A0','#311B92','#512DA8','#6A1B9A','#4A148C',
  // Reds & Oranges
  '#B71C1C','#C62828','#BF360C','#E65100','#D84315',
  // Pinks & Rose
  '#880E4F','#C2185B','#AD1457','#D81B60',
  // Slates & Browns
  '#37474F','#455A64','#546E7A','#4A5568','#4E342E',
]
