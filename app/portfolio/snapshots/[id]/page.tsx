import { supabase } from '@/lib/supabase'
import SnapshotEditor from '@/components/portfolio/SnapshotEditor'

export const dynamic = 'force-dynamic'

export default async function SnapshotEditPage({ params }: { params: { id: string } }) {
  const [{ data: snapshot }, { data: holdingsRaw }, { data: accounts }, { data: securities }] = await Promise.all([
    supabase.from('snapshots').select('*').eq('id', params.id).single(),
    supabase.from('holdings').select('*').eq('snapshot_id', params.id).gt('quantity', 0),
    supabase.from('accounts').select('*').order('name'),
    supabase.from('securities').select('*').order('ticker'),
  ])

  if (!snapshot) return <p className="p-8 text-slate-400">스냅샷을 찾을 수 없습니다.</p>

  return (
    <SnapshotEditor
      snapshot={snapshot}
      holdings={holdingsRaw ?? []}
      accounts={accounts ?? []}
      securities={securities ?? []}
    />
  )
}
