import { getSql } from '@/lib/db'
import OptionsClient from '@/components/OptionsClient'

export const dynamic = 'force-dynamic'

export default async function OptionsPage() {
  const sql = getSql()
  const [members, methods, details, categories] = await Promise.all([
    sql`SELECT code, display_name, color FROM members ORDER BY code`,
    sql`SELECT id, name, order_idx, color FROM payment_methods WHERE is_active = true ORDER BY order_idx, id`,
    sql`SELECT id, name, category, color FROM detail_options WHERE is_active = true ORDER BY category, order_idx, name`,
    sql`SELECT name, color FROM categories ORDER BY name`,
  ])
  const catColors = Object.fromEntries((categories as unknown as { name: string; color: string }[]).map(c => [c.name, c.color]))
  return (
    <OptionsClient
      initialMembers={members as unknown as { code: string; display_name: string; color: string }[]}
      initialMethods={methods as unknown as { id: number; name: string; order_idx: number; color: string }[]}
      initialDetails={details as unknown as { id: number; name: string; category: string; color: string }[]}
      initialCatColors={catColors}
    />
  )
}
