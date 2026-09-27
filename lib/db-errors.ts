/** Postgres 외래키 위반(23503) — 참조 중인 행을 지우려 할 때 */
export function isForeignKeyViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23503'
}
