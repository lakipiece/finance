'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * 계좌 메모 툴팁 — 감싼 요소에 마우스를 올리면 메모를 띄운다.
 * 메모가 없으면 아무것도 덧붙이지 않는다. 표·모달의 overflow에 잘리지 않게 body로 portal.
 */
export default function MemoTip({ memo, children, className }: {
  memo: string | null | undefined
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null)
  const text = memo?.trim()

  if (!text) return <span className={className}>{children}</span>

  function show() {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    // 위 공간이 부족하면 아래로
    const below = r.top < 120
    setPos({ x: r.left + r.width / 2, y: below ? r.bottom : r.top, below })
  }

  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={() => setPos(null)}
      className={`underline decoration-dotted decoration-ink-5 underline-offset-[3px] ${className ?? ''}`}>
      {children}
      {pos ? createPortal(
        <div role="tooltip"
          className="fixed z-[10001] pointer-events-none max-w-[280px] bg-action text-white rounded-btn px-3 py-2 shadow-dialog text-body font-normal text-left whitespace-pre-wrap break-words"
          style={{
            left: Math.min(Math.max(pos.x, 150), window.innerWidth - 150),
            top: pos.y,
            transform: pos.below ? 'translate(-50%, 6px)' : 'translate(-50%, calc(-100% - 6px))',
          }}>
          {text}
        </div>,
        document.body,
      ) : null}
    </span>
  )
}
