'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_MEMBER_COLORS, memberBadgeStyle } from '@/lib/palettes'
import { color as tone } from '@/lib/styles'

interface Member { code: string; display_name: string; color: string }

// 페이지 하나에 배지가 수십 개라 요청은 한 번만 보낸다
let membersPromise: Promise<Member[]> | null = null
function loadMembers(): Promise<Member[]> {
  membersPromise ??= fetch('/api/options/members')
    .then(r => (r.ok ? r.json() : []))
    .then(d => (Array.isArray(d) ? d : []))
    .catch(() => [])
  return membersPromise
}

/**
 * 사용자 배지 — 코드(L·P)나 표시 이름(Laki·Piece) 어느 쪽을 받아도 코드 한 글자로,
 * members 테이블의 색으로 칠한다.
 */
export default function MemberBadge({ member }: { member: string | null | undefined }) {
  const [members, setMembers] = useState<Member[]>([])
  useEffect(() => { loadMembers().then(setMembers) }, [])

  if (!member) return <span className="text-ink-5 text-body">—</span>
  const m = members.find(x => x.code === member || x.display_name === member)
  const code = m?.code ?? member
  const hex = m?.color ?? DEFAULT_MEMBER_COLORS[code] ?? tone.ink4
  return (
    <span className="inline-block text-micro tracking-normal font-bold px-1.5 py-0.5 rounded"
      style={memberBadgeStyle(hex)} title={m?.display_name ?? member}>
      {code}
    </span>
  )
}
