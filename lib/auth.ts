import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getSql } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const sql = getSql()
        const [user] = await sql<{ id: string; email: string; password_hash: string }[]>`
          SELECT id, email, password_hash FROM users WHERE email = ${credentials.email as string}
        `
        if (!user) return null
        // 운영 DB는 2026-08-14 bcrypt 전환 완료 — 평문 하위호환 분기 제거
        const ok = await bcrypt.compare(credentials.password as string, user.password_hash)
        if (!ok) return null
        return { id: user.id, email: user.email }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  trustHost: true,
})
