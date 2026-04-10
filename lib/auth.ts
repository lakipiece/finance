import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
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
        if (credentials.password !== user.password_hash) return null
        return { id: user.id, email: user.email }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  trustHost: true,
})
