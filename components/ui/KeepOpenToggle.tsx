'use client'

interface Props {
  checked: boolean
  onChange: (v: boolean) => void
  className?: string
}

/**
 * "저장 후 계속 입력" 토글 — D-07a. 폼에 상시 노출한다.
 * 트랙 32×18 · 노브 14×14. 켜짐은 잉크 배경으로만 표시한다.
 */
export default function KeepOpenToggle({ checked, onChange, className = '' }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 text-body text-ink-2 ${className}`}
    >
      <span
        className={`relative inline-block w-8 h-[18px] rounded-full shrink-0 transition-colors ${
          checked ? 'bg-action' : 'bg-surface-high'
        }`}
      >
        <span
          className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${
            checked ? 'right-0.5' : 'right-[18px]'
          }`}
        />
      </span>
      저장 후 계속 입력
    </button>
  )
}
