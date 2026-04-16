/** Recharts 커스텀 툴팁 공통 타입 */

export interface TooltipEntry {
  dataKey: string
  name: string
  value: number
  fill: string
  stroke?: string
  payload: Record<string, unknown>
}

export interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}
