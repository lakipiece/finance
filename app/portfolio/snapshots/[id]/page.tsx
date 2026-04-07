import { getSql } from '@/lib/db'
import SnapshotEditor from '@/components/portfolio/SnapshotEditor'

export const dynamic = 'force-dynamic'

export default async function SnapshotEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sql = getSql()
  const [snapshots, holdingsRaw, accounts, securities, accountSecurities] = await Promise.all([
    sql`SELECT * FROM snapshots WHERE id = ${id}`,
    sql`SELECT * FROM holdings WHERE snapshot_id = ${id} AND quantity > 0`,
    sql`SELECT * FROM accounts ORDER BY name`,
    sql`SELECT * FROM securities ORDER BY ticker`,
    sql`SELECT * FROM account_securities`,
  ])

  const snapshot = snapshots[0] ?? null
  if (!snapshot) return <p className="p-8 text-slate-400">스냅샷을 찾을 수 없습니다.</p>

  return (
    <SnapshotEditor
      snapshot={snapshot}
      holdings={holdingsRaw}
      accounts={accounts}
      securities={securities}
      accountSecurities={accountSecurities}
    />
  )
}
