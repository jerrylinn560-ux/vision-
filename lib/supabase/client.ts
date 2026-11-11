import { createBrowserClient } from '@supabase/ssr'

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase browser configuration is unavailable.')
  }

  return { url, key }
}

export function createClient() {
  const { url, key } = getSupabaseConfig()
  return createBrowserClient(url, key, {
    cookieOptions: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' },
  })
}
