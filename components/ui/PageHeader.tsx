'use client'

import { text } from '@/lib/styles'

interface Props {
  title: string
  description?: string
  /** 우측 액션 영역 (버튼, 피커 등) */
  children?: React.ReactNode
}

/**
 * 페이지 공통 헤더 — 타이틀(브랜드 네이비) + 설명 + 우측 액션.
 * 아래 여백은 스스로 갖지 않는다 — 부모의 space-y-6가 리듬을 담당하므로
 * mb-*를 두면 space-y와 합산되어 여백이 두 배가 된다.
 */
export default function PageHeader({ title, description, children }: Props) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className={text.pageTitle}>{title}</h1>
        {description ? <p className="text-xs text-slate-400 mt-0.5">{description}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  )
}
