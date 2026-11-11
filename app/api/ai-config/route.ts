import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AI_PROVIDER_IDS, type AIProviderId } from '@/lib/ai/types'
import { normalizeProviderBaseUrl } from '@/lib/ai/providers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const providerSchema = z.enum(AI_PROVIDER_IDS)
const saveSchema = z.object({
  provider: providerSchema,
  model: z.string().trim().min(1).max(200),
  baseUrl: z.string().trim().max(1000).nullable().optional(),
  apiKey: z.string().trim().min(8).max(8192).optional(),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  removeApiKey: z.boolean().optional(),
})
const deleteSchema = z.object({ provider: providerSchema })

function jsonError(detail: string, status: number) {
  return NextResponse.json({ detail }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function getSignedInUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return error ? null : data.user
}

export async function GET() {
  const user = await getSignedInUser()
  if (!user) return jsonError('Please sign in again to continue.', 401)

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('user_ai_provider_configs')
      .select('provider, model, base_url, enabled, is_default, vault_secret_id, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) throw new Error('Provider settings could not be loaded.')

    const providers = (data ?? [])
      .filter((row) => row.provider === 'google')
      .map((row) => ({
        provider: row.provider as AIProviderId,
        model: row.model,
        baseUrl: row.base_url,
        enabled: row.enabled,
        isDefault: row.is_default,
        hasApiKey: Boolean(row.vault_secret_id),
        updatedAt: row.updated_at,
      }))

    return NextResponse.json({ providers }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return jsonError('Provider settings could not be loaded. Try again shortly.', 500)
  }
}

export async function PUT(request: Request) {
  const user = await getSignedInUser()
  if (!user) return jsonError('Please sign in again to continue.', 401)

  let input: z.infer<typeof saveSchema>
  try {
    input = saveSchema.parse(await request.json())
  } catch {
    return jsonError('Choose a provider and model, then check the configuration fields.', 400)
  }

  const apiKey = input.apiKey?.trim() || undefined
  const removeApiKey = input.removeApiKey === true
  if (apiKey && removeApiKey) return jsonError('Replace or remove the saved key in separate actions.', 400)

  let baseUrl: string | null
  try {
    baseUrl = await normalizeProviderBaseUrl(input.provider, input.baseUrl)
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'The provider endpoint is invalid.', 400)
  }

  try {
    const admin = createAdminClient()
    const { data: current, error: currentError } = await admin
      .from('user_ai_provider_configs')
      .select('vault_secret_id')
      .eq('user_id', user.id)
      .eq('provider', input.provider)
      .maybeSingle()

    if (currentError) throw new Error('Provider settings could not be loaded.')
    if (!apiKey && !removeApiKey && !current?.vault_secret_id) {
      return jsonError('Enter an API key before saving this provider.', 400)
    }
    if (input.isDefault && (!input.enabled || removeApiKey)) {
      return jsonError('An active provider must be enabled and have a saved API key.', 400)
    }

    const { error } = await admin.rpc('save_user_ai_provider_config', {
      p_user_id: user.id,
      p_provider: input.provider,
      p_model: input.model,
      p_base_url: baseUrl,
      p_enabled: removeApiKey ? false : input.enabled,
      p_is_default: removeApiKey ? false : input.isDefault,
      p_api_key: apiKey ?? null,
      p_remove_api_key: removeApiKey,
    })

    if (error) throw new Error('Provider settings could not be saved.')
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return jsonError('Provider settings could not be saved. Check the configuration and try again.', 500)
  }
}

export async function DELETE(request: Request) {
  const user = await getSignedInUser()
  if (!user) return jsonError('Please sign in again to continue.', 401)

  let input: z.infer<typeof deleteSchema>
  try {
    input = deleteSchema.parse(await request.json())
  } catch {
    return jsonError('Choose a provider to remove.', 400)
  }

  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('delete_user_ai_provider_config', {
      p_user_id: user.id,
      p_provider: input.provider,
    })
    if (error) throw new Error('Provider settings could not be removed.')
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return jsonError('Provider settings could not be removed. Try again shortly.', 500)
  }
}
