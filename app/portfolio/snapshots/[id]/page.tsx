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
  const [snapshots, holdingsRaw, accounts, securities, accountSecurities, optionsRaw, sectorOptsRaw] = await Promise.all([
    sql`SELECT * FROM snapshots WHERE id = ${id}` as unknown as Promise<Snapshot[]>,
    sql`SELECT * FROM holdings WHERE snapshot_id = ${id}` as unknown as Promise<HoldingRow[]>,
    sql`
      SELECT a.id, a.name, a.broker, a.owner, a.created_at, a.sort_order,
             a.type_id, a.currency_id,
             t.value AS type, cu.value AS currency
      FROM accounts a
      LEFT JOIN option_list t  ON a.type_id    = t.id
      LEFT JOIN option_list cu ON a.currency_id = cu.id
      ORDER BY a.sort_order ASC, a.created_at ASC
    ` as unknown as Promise<Account[]>,
    sql`
      SELECT s.id, s.ticker, s.name, s.style, s.url, s.memo, s.created_at,
             s.asset_class_id, s.country_id, s.sector_id, s.currency_id,
             ac.value AS asset_class, co.value AS country,
             se.value AS sector,      cu.value AS currency
      FROM securities s
      LEFT JOIN option_list ac ON s.asset_class_id = ac.id
      LEFT JOIN option_list co ON s.country_id      = co.id
      LEFT JOIN option_list se ON s.sector_id       = se.id
      LEFT JOIN option_list cu ON s.currency_id     = cu.id
      ORDER BY s.ticker
    ` as unknown as Promise<Security[]>,
    sql`SELECT * FROM account_securities` as unknown as Promise<AccountSecurity[]>,
    sql`SELECT value, color_hex FROM option_list WHERE type = 'account_type'` as unknown as Promise<{ value: string; color_hex: string | null }[]>,
    sql`SELECT value, color_hex FROM option_list WHERE type = 'sector'` as unknown as Promise<{ value: string; color_hex: string | null }[]>,
  ])

  // 계좌별 입출금 이벤트 — 스냅샷 날짜 기준 누적입금(투자원금)·수익금액 계산용
  const cashflowRaw = await sql`
    SELECT account_id, flow_date,
      COALESCE(SUM(amount) FILTER (WHERE type IN ('deposit','opening')), 0)::float AS inflow,
      COALESCE(SUM(amount) FILTER (WHERE type = 'withdrawal'), 0)::float AS outflow
    FROM account_cashflows
    GROUP BY account_id, flow_date ORDER BY flow_date
  `.catch(() => []) as unknown as { account_id: string; flow_date: unknown; inflow: number; outflow: number }[]
  const cashflowEvents = cashflowRaw.map(r => ({
    account_id: r.account_id,
    date: (r.flow_date as unknown) instanceof Date
      ? (r.flow_date as unknown as Date).toISOString().slice(0, 10)
      : String(r.flow_date).slice(0, 10),
    inflow: Number(r.inflow),
    outflow: Number(r.outflow),
  }))
  const typeColors: Record<string, string> = {}
  for (const o of optionsRaw) {
    if (o.color_hex) typeColors[o.value] = o.color_hex
  }
  const sectorColors: Record<string, string> = {}
  for (const o of sectorOptsRaw) {
    if (o.color_hex) sectorColors[o.value] = o.color_hex
  }

  const raw = snapshots[0] ?? null
  if (!raw) return <p className="p-8 text-ink-4">스냅샷을 찾을 수 없습니다.</p>
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
      sectorColors={sectorColors}
      cashflowEvents={cashflowEvents}
    />
  )
}
