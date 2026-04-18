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

// 옵션 항목용 70색 팔레트 — 색상 계열별 정렬
export const OPTION_COLORS: string[] = [
  // ── Deep Blues / Navy (7) ──────────────────────────────
  '#0D1B5E','#1A237E','#283593','#1565C0','#01579B','#0277BD','#0288D1',
  // ── Purples / Indigo (8) ──────────────────────────────
  '#290069','#311B92','#4527A0','#512DA8','#4A148C','#6A1B9A','#7B1FA2','#6D28D9',
  // ── Pinks / Magentas (6) ──────────────────────────────
  '#690047','#880E4F','#AD1457','#C2185B','#D81B60','#E91E8C',
  // ── Crimsons / Reds (5) ───────────────────────────────
  '#7F1D1D','#B71C1C','#C62828','#D32F2F','#C0392B',
  // ── Orange-Reds (4) ───────────────────────────────────
  '#BF360C','#D84315','#E64A19','#E65100',
  // ── Ambers / Oranges (5) ──────────────────────────────
  '#FF6D00','#F57C00','#FF8F00','#F9A825','#E67E22',
  // ── Yellows / Mustards / Golds (6) ───────────────────
  '#693D00','#7C4A00','#92600A','#BF8C00','#C8961A','#E6AC00',
  // ── Olives / Yellow-Greens (5) ───────────────────────
  '#456900','#33691E','#558B2F','#7C8B12','#827717',
  // ── Greens (5) ────────────────────────────────────────
  '#1B5E20','#2E7D32','#388E3C','#2D6A4F','#43A047',
  // ── Teals / Cyans (4) ─────────────────────────────────
  '#004D40','#00695C','#00796B','#006064',
  // ── Slates / Blue-Grays (6) ──────────────────────────
  '#1A2940','#263547','#37474F','#455A64','#546E7A','#607D8B',
  // ── Grays / Neutrals (6) ─────────────────────────────
  '#212121','#374151','#424242','#4B5563','#5F6B7A','#6B7280',
  // ── Browns / Earth (3) ───────────────────────────────
  '#4E342E','#5D4037','#6D4C41',
]
