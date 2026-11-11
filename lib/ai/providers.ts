import 'server-only'

import { createGoogle } from '@ai-sdk/google'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AIProviderId } from '@/lib/ai/types'

type StoredProvider = {
  provider: AIProviderId
  model: string
  base_url: string | null
  vault_secret_id: string | null
}

export type ProviderCredential = {
  provider: AIProviderId
  model: string
  baseUrl: string | null
  apiKey: string
}

export class ProviderEndpointError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderEndpointError'
  }
}

export function getEnvGeminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || undefined
}

export async function normalizeProviderBaseUrl(provider: AIProviderId, value?: string | null) {
  return null
}

async function getProviderSecret(userId: string, provider: AIProviderId) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_user_ai_provider_secret', {
    p_user_id: userId,
    p_provider: provider,
  })

  if (error || typeof data !== 'string' || !data) {
    throw new Error('The saved Gemini API key is unavailable.')
  }

  return data
}

export async function getSavedProviderApiKey(userId: string, provider: AIProviderId) {
  if (provider !== 'google') return null
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_ai_provider_configs')
    .select('vault_secret_id')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle()

  if (error) throw new Error('Provider settings could not be loaded.')
  if (!data?.vault_secret_id) return getEnvGeminiKey() || null
  return getProviderSecret(userId, provider)
}

export async function getActiveProviderCredential(userId: string): Promise<ProviderCredential | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_ai_provider_configs')
    .select('provider, model, base_url, vault_secret_id')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('enabled', true)
    .eq('is_default', true)
    .maybeSingle<StoredProvider>()

  if (error) throw new Error('Provider settings could not be loaded.')

  if (data?.vault_secret_id) {
    const apiKey = await getProviderSecret(userId, data.provider)
    return { provider: 'google', model: data.model || 'gemini-2.0-flash', baseUrl: null, apiKey }
  }

  const envKey = getEnvGeminiKey()
  if (envKey) {
    return { provider: 'google', model: data?.model || 'gemini-2.0-flash', baseUrl: null, apiKey: envKey }
  }

  return null
}

export function createLanguageModel(config: ProviderCredential) {
  return createGoogle({ apiKey: config.apiKey }).chat(config.model)
}

export async function getUserLanguageModel(userId: string) {
  const credential = await getActiveProviderCredential(userId)
  const apiKey = credential?.apiKey || getEnvGeminiKey() || ''
  const model = credential?.model || 'gemini-2.0-flash'
  return createGoogle({ apiKey }).chat(model)
}

export async function getUserTranscriptionModel(userId: string) {
  const credential = await getActiveProviderCredential(userId)
  const apiKey = credential?.apiKey || getEnvGeminiKey() || ''
  return createGoogle({ apiKey }).transcription('gemini-3.5-transcribe')
}

export async function getUserSpeechModel(userId: string) {
  const credential = await getActiveProviderCredential(userId)
  const apiKey = credential?.apiKey || getEnvGeminiKey() || ''
  return {
    model: createGoogle({ apiKey }).speech('gemini-3.8-flash-tts'),
    provider: 'google' as const,
  }
}
