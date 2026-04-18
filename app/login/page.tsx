'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

function BrandLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="#1e293b"/>
      <rect x="6" y="6" width="3" height="20" rx="1.5" fill="white"/>
      <rect x="6" y="6" width="15" height="3" rx="1.5" fill="white"/>
      <rect x="6" y="13" width="10" height="3" rx="1.5" fill="white"/>
      <rect x="6" y="22" width="5" height="4" rx="1.5" fill="#00695C"/>
      <line x1="12" y1="26" x2="25" y2="7" stroke="#C2185B" strokeWidth="2.5" strokeLinecap="round"/>
      <polyline points="19,7 25,7 25,13" stroke="#C2185B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0D1B5E 0%, #1A237E 40%, #00695C 100%)' }}>
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full opacity-5 bg-white" />
      </div>

      <div className="relative w-full max-w-sm px-4">
        {/* 로고 + 브랜드 */}
        <div className="flex flex-col items-center mb-8">
          <BrandLogo />
          <div className="mt-3 text-center">
            <p className="text-lg font-bold tracking-widest text-white uppercase leading-tight">Lakipiece</p>
            <p className="text-lg font-bold tracking-widest uppercase leading-tight" style={{ color: '#80CBC4' }}>Finance</p>
            <p className="text-[10px] text-white/40 tracking-widest mt-1 uppercase">The Precision Curator</p>
          </div>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-7">
          <h2 className="text-sm font-semibold text-white mb-5">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] text-white/50 mb-1.5 uppercase tracking-wider">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border-0 border-b border-white/30 bg-transparent pb-1.5 pt-1 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/70 transition-colors"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-[10px] text-white/50 mb-1.5 uppercase tracking-wider">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border-0 border-b border-white/30 bg-transparent pb-1.5 pt-1 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/70 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-300 bg-red-500/10 rounded-lg px-3 py-2 border border-red-400/20">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-[#1A237E] hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
              style={{ background: 'linear-gradient(135deg, #ffffff 0%, #e8f0fe 100%)' }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
