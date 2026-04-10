import { getSql } from '@/lib/db'
import SnapshotEditor from '@/components/portfolio/SnapshotEditor'
import type { Snapshot, Account, Security } from '@/lib/portfolio/types'

export const dynamic = 'force-dynamic'

type HoldingRow = {
  id?: string
  account_id: string
  security_id: string
  quantity: number
  avg_price: number | null
  total_invested: number | null
}
type AccountSecurity = { account_id: string; security_id: string }

export default async function SnapshotEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sql = getSql()
  const [snapshots, holdingsRaw, accounts, securities, accountSecurities, optionsRaw] = await Promise.all([
    sql`SELECT * FROM snapshots WHERE id = ${id}` as unknown as Promise<Snapshot[]>,
    sql`SELECT * FROM holdings WHERE snapshot_id = ${id}` as unknown as Promise<HoldingRow[]>,
    sql`SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC` as unknown as Promise<Account[]>,
    sql`SELECT * FROM securities ORDER BY ticker` as unknown as Promise<Security[]>,
    sql`SELECT * FROM account_securities` as unknown as Promise<AccountSecurity[]>,
    sql`SELECT value, color_hex FROM option_list WHERE type = 'account_type'` as unknown as Promise<{ value: string; color_hex: string | null }[]>,
  ])
  const typeColors: Record<string, string> = {}
  for (const o of optionsRaw) {
    if (o.color_hex) typeColors[o.value] = o.color_hex
  }

  const raw = snapshots[0] ?? null
  if (!raw) return <p className="p-8 text-slate-400">스냅샷을 찾을 수 없습니다.</p>
  const snapshot: Snapshot = {
    ...raw,
    date: (raw.date as unknown) instanceof Date
      ? (raw.date as unknown as Date).toISOString().slice(0, 10)
      : String(raw.date).slice(0, 10),
  }

  return (
    <SnapshotEditor
      snapshot={snapshot}
      holdings={holdingsRaw}
      accounts={accounts}
      securities={securities}
      accountSecurities={accountSecurities}
      typeColors={typeColors}
    />
  )
}
