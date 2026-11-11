import 'server-only'

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | undefined

export function createAdminClient() {
  if (adminClient) return adminClient

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server-side Supabase credentials are unavailable.')
  }

  adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  return adminClient
}
