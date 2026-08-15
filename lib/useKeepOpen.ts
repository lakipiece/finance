'use client'

import { useCallback, useEffect, useState } from 'react'

const KEY = 'finance:keep-open'

/**
 * "저장 후 계속 입력" 토글 상태 — D-07a.
 * 영속 저장한다. 반복 입력이 습관인 사용자가 매번 다시 켜야 한다면
 * 토글이 있으나 마나이기 때문이다.
 */
export function useKeepOpen(): [boolean, (v: boolean) => void] {
  const [keepOpen, setKeepOpenState] = useState(false)

  // localStorage는 서버 렌더에 없으므로 마운트 후 읽는다
  useEffect(() => {
    try {
      setKeepOpenState(window.localStorage.getItem(KEY) === '1')
    } catch {
      /* 저장소 접근 불가 — 기본값 OFF로 둔다 */
    }
  }, [])

  const setKeepOpen = useCallback((v: boolean) => {
    setKeepOpenState(v)
    try {
      window.localStorage.setItem(KEY, v ? '1' : '0')
    } catch {
      /* 저장 실패해도 현재 세션 동작에는 영향 없음 */
    }
  }, [])

  return [keepOpen, setKeepOpen]
}
