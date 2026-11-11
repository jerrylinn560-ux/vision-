'use client'

import { createClient } from '@/lib/supabase/client'

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createClient()
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session?.access_token) {
    throw new Error('Your session has expired. Sign in again to continue.')
  }

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
  })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const detail =
      payload && typeof payload.detail === 'string'
        ? payload.detail
        : 'The request could not be completed. Please try again.'
    throw new Error(detail)
  }

  return payload as T
}

export function apiFetcher<T>(path: string) {
  return apiRequest<T>(path)
}
