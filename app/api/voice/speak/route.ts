import { generateSpeech } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getUserSpeechModel } from '@/lib/ai/providers'

export const runtime = 'nodejs'
export const maxDuration = 60

const requestSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  voice: z.enum(['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer']).default('alloy'),
  speed: z.number().min(0.75).max(1.25).default(1),
})

const googleVoiceByOpenAIVoice = {
  alloy: 'Kore',
  echo: 'Charon',
  fable: 'Puck',
  nova: 'Aoede',
  onyx: 'Orus',
  shimmer: 'Zephyr',
} as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return NextResponse.json({ error: 'Please sign in again to continue.' }, { status: 401 })

  let input: z.infer<typeof requestSchema>
  try {
    input = requestSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Provide text under 4,000 characters and a supported voice.' }, { status: 400 })
  }

  try {
    const speech = await getUserSpeechModel(data.user.id)
    const result = await generateSpeech({
      model: speech.model,
      text: input.text,
      providerOptions: { google: { speechMetadata: { speaker: googleVoiceByOpenAIVoice[input.voice] } } },
    })
    return new Response(result.audio.uint8Array, {
      headers: {
        'Content-Type': result.audio.mediaType || 'audio/mpeg',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[VISION] Speech generation failed:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ error: 'Speech generation is unavailable right now.' }, { status: 502 })
  }
}
