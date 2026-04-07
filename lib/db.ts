import 'server-only'
import postgres from 'postgres'

let _sql: ReturnType<typeof postgres> | undefined

function getClient() {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('Missing DATABASE_URL')
    _sql = postgres(url)
  }
  return _sql
}

export function getSql() {
  return getClient()
}
