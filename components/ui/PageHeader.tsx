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
 * 각 페이지에서 <h1 className="text-xl font-bold" style={{color:'#1A237E'}}>를
 * 반복 정의하던 것을 표준화한다.
 */
export default function PageHeader({ title, description, children }: Props) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
      <div>
        <h1 className={text.pageTitle}>{title}</h1>
        {description ? <p className="text-xs text-slate-400 mt-0.5">{description}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  )
}
