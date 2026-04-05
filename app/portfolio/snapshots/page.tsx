import { supabase } from '@/lib/supabase'
import SnapshotList from '@/components/portfolio/SnapshotList'
import type { Snapshot } from '@/lib/portfolio/types'

export const dynamic = 'force-dynamic'

export default async function SnapshotsPage() {
  const { data } = await supabase
    .from('snapshots')
    .select('*')
    .order('date', { ascending: false })

  return <SnapshotList snapshots={(data ?? []) as Snapshot[]} />
}
