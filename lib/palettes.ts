// lib/palettes.ts
export interface Palette {
  id: string
  name: string
  colors: [string, string, string, string]  // [고정비, 대출상환, 변동비, 여행공연비]
  headerGradient: string
}

export const PALETTES: Palette[] = [
  { id: 'metric-slate', name: 'Metric Slate', colors: ['#1A237E','#B71C1C','#00695C','#E65100'], headerGradient: 'linear-gradient(135deg, #1A237E 0%, #00695C 100%)' },
  { id: 'tableau',    name: 'Tableau 10',     colors: ['#4E79A7','#E15759','#59A14F','#F28E2B'], headerGradient: 'linear-gradient(135deg, #2D3E50 0%, #4E79A7 100%)' },
  { id: 'd3',         name: 'D3 Category10',  colors: ['#1F77B4','#D62728','#2CA02C','#FF7F0E'], headerGradient: 'linear-gradient(135deg, #0D3B6E 0%, #1F77B4 100%)' },
  { id: 'observable', name: 'Observable',     colors: ['#4269D0','#FF725C','#6CC5B0','#EFB118'], headerGradient: 'linear-gradient(135deg, #1A237E 0%, #4269D0 100%)' },
  { id: 'pastel',     name: 'Pastel Soft',    colors: ['#7EB8F7','#F4A7A3','#81D4C0','#F9C97C'], headerGradient: 'linear-gradient(135deg, #4A5568 0%, #718096 100%)' },
  { id: 'material',   name: 'Material Design',colors: ['#42A5F5','#EF5350','#26A69A','#FFA726'], headerGradient: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)' },
  { id: 'cool-ocean', name: 'Cool Ocean',     colors: ['#0EA5E9','#06B6D4','#10B981','#6366F1'], headerGradient: 'linear-gradient(135deg, #0C4A6E 0%, #0EA5E9 100%)' },
  { id: 'nordic',     name: 'Nordic Frost',   colors: ['#7DD3FC','#C4B5FD','#86EFAC','#FED7AA'], headerGradient: 'linear-gradient(135deg, #1E3A5F 0%, #2E5C8A 100%)' },
  { id: 'earth',      name: 'Earth Tones',    colors: ['#92400E','#065F46','#1E40AF','#78350F'], headerGradient: 'linear-gradient(135deg, #1C1917 0%, #44403C 100%)' },
  { id: 'vivid',      name: 'Vivid Pop',      colors: ['#3B82F6','#EF4444','#10B981','#F59E0B'], headerGradient: 'linear-gradient(135deg, #1E1B4B 0%, #3730A3 100%)' },
  { id: 'muted',      name: 'Muted Classic',  colors: ['#6B8CAE','#C47D7D','#6DAE8C','#C4A96D'], headerGradient: 'linear-gradient(135deg, #2D3748 0%, #4A5568 100%)' },
  { id: 'purple',     name: 'Purple Suite',   colors: ['#7C3AED','#A855F7','#C084FC','#E879F9'], headerGradient: 'linear-gradient(135deg, #2E1065 0%, #7C3AED 100%)' },
  { id: 'retro',      name: 'Retro Studio',   colors: ['#E76F51','#264653','#2A9D8F','#E9C46A'], headerGradient: 'linear-gradient(135deg, #264653 0%, #2A9D8F 100%)' },
]

export const DEFAULT_PALETTE = PALETTES.find(p => p.id === 'metric-slate')!
