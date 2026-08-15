'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="px-3 py-1.5 rounded-btn text-body text-ink-3 hover:bg-surface-low hover:text-ink transition-colors"
    >
      로그아웃
    </button>
  )
}
