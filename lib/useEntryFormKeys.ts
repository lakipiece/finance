'use client'

import { useEffect, type RefObject } from 'react'

type Focusable = HTMLElement | null

interface Options {
  /** ⏎ — 저장 (토글 ON이면 저장하고 계속) */
  onSave: () => void
  /** ⌘⏎ — 토글 상태와 무관하게 저장하고 계속 */
  onSaveAndContinue: () => void
  /** Esc — 취소. 입력값이 있으면 호출 측에서 확인 한 번 */
  onCancel: () => void
  /** 1–4 — 분류 직접 선택. 텍스트 입력 중에는 동작하지 않는다 */
  onPickCategory?: (index: number) => void
  /**
   * Tab 순서 — 금액 → 분류 → 내역 → 날짜 → 결제수단 → 저장.
   * 화면 배치 순서와 의도적으로 다르다: 날짜·결제수단은 기본값이 맞는 경우가
   * 대부분이라 뒤로 미루고, 매번 바뀌는 값을 앞에 둔다.
   */
  tabOrder?: RefObject<Focusable>[]
  /** 저장 진행 중에는 키를 받지 않는다 */
  disabled?: boolean
}

function isTextEntry(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable
}

/** 거래 입력 모달의 키보드 명세 — D-07. */
export function useEntryFormKeys({
  onSave, onSaveAndContinue, onCancel, onPickCategory, tabOrder, disabled = false,
}: Options) {
  useEffect(() => {
    if (disabled) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }

      if (e.key === 'Enter') {
        // 여러 줄 메모 안에서는 줄바꿈이 우선
        const el = document.activeElement
        if (el?.tagName === 'TEXTAREA' && !e.metaKey && !e.ctrlKey) return
        e.preventDefault()
        if (e.metaKey || e.ctrlKey) onSaveAndContinue()
        else onSave()
        return
      }

      // 1–4 분류 선택 — 숫자 입력과 충돌하지 않도록 텍스트 입력 중에는 무시
      if (onPickCategory && /^[1-4]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (isTextEntry(document.activeElement)) return
        e.preventDefault()
        onPickCategory(Number(e.key) - 1)
        return
      }

      if (e.key === 'Tab' && tabOrder?.length) {
        const nodes = tabOrder.map(r => r.current).filter(Boolean) as HTMLElement[]
        const i = nodes.indexOf(document.activeElement as HTMLElement)
        if (i === -1) return   // 목록 밖이면 브라우저 기본 동작에 맡긴다
        e.preventDefault()
        const next = e.shiftKey
          ? (i - 1 + nodes.length) % nodes.length
          : (i + 1) % nodes.length
        nodes[next].focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onSave, onSaveAndContinue, onCancel, onPickCategory, tabOrder, disabled])
}
