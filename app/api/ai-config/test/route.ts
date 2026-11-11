import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AI_PROVIDER_IDS } from '@/lib/ai/types'
import { createLanguageModel, getSavedProviderApiKey, normalizeProviderBaseUrl } from '@/lib/ai/providers'
import { providerErrorResponse } from '@/lib/ai/provider-catalog'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  provider: z.enum(AI_PROVIDER_IDS),
  model: z.string().trim().min(1).max(200),
  apiKey: z.string().trim().min(8).max(8192).optional(),
  baseUrl: z.string().trim().max(1000).nullable().optional(),
})

function jsonError(detail: string, status: number) {
  return NextResponse.json({ detail }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return jsonError('Please sign in again to continue.', 401)

  let input: z.infer<typeof requestSchema>
  try {
    input = requestSchema.parse(await request.json())
  } catch {
    return jsonError('Enter a valid model ID and provider configuration.', 400)
  }

  try {
    const apiKey = input.apiKey?.trim() || await getSavedProviderApiKey(data.user.id, input.provider)
    if (!apiKey) return jsonError('Enter an API key or save one for this provider first.', 400)
    const baseUrl = await normalizeProviderBaseUrl(input.provider, input.baseUrl)
    const result = await generateText({
      model: createLanguageModel({ provider: input.provider, model: input.model, apiKey, baseUrl }),
      prompt: 'Reply with exactly: VISION_OK',
      maxOutputTokens: 16,
    })

    if (!result.text.trim()) return jsonError('The provider returned an empty response. Check the selected model.', 502)
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const failure = providerErrorResponse(error)
    return jsonError(failure.detail, failure.status)
  }
}
