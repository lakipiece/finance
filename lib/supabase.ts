import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization — avoids build-time error when env vars aren't inlined yet
let _client: SupabaseClient | undefined

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string) {
    if (!_client) {
      _client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    }
    return (_client as any)[prop]
  },
})
