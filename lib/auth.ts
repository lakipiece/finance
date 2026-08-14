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
        // bcrypt 해시($2...)면 compare, 아니면 평문 비교 (마이그레이션 전 하위호환)
        const input = credentials.password as string
        const ok = user.password_hash.startsWith('$2')
          ? await bcrypt.compare(input, user.password_hash)
          : input === user.password_hash
        if (!ok) return null
        return { id: user.id, email: user.email }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  trustHost: true,
})
