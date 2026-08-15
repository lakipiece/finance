import { catColor } from '@/lib/utils'

interface Props {
  category: string
  /** 점 색을 직접 지정 (옵션에서 사용자 지정 색을 쓰는 경우) */
  color?: string
  /** sm — 표·리스트용 축소형 */
  size?: 'base' | 'sm'
  className?: string
}

/**
 * 카테고리 배지 — D-01b.
 * 카테고리색은 6px 점으로만 쓰고, 글자는 잉크(#3d4a5c) 고정이다.
 * (#26A69A는 흰 배경 대비 3.0:1로 본문 AA에 미달하므로 글자색이 될 수 없다.)
 */
export default function CategoryBadge({ category, color, size = 'base', className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-surface-low text-ink-2 whitespace-nowrap ${
        size === 'sm' ? 'gap-1 px-1.5 py-0.5 text-micro tracking-normal' : 'gap-1.5 px-2 py-0.5 text-meta'
      } ${className}`}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color ?? catColor(category) }}
      />
      {category}
    </span>
  )
}

/** 점만 필요한 자리 (표의 분류명 앞 등) */
export function CategoryDot({ category, color, className = '' }: Omit<Props, 'size'>) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 mr-1.5 align-middle ${className}`}
      style={{ backgroundColor: color ?? catColor(category) }}
    />
  )
}
