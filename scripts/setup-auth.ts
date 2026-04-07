// scripts/setup-auth.ts
// 실행: npx tsx --env-file=.env.local scripts/setup-auth.ts
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

const sql = postgres(process.env.DATABASE_URL!)

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email         text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      created_at    timestamptz DEFAULT now()
    )
  `
  console.log('users table created')

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    console.log('Set ADMIN_EMAIL and ADMIN_PASSWORD to create initial user')
    await sql.end()
    return
  }

  const hash = await bcrypt.hash(password, 12)
  await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${email}, ${hash})
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `
  console.log('User created:', email)
  await sql.end()
}

main().catch(console.error)
