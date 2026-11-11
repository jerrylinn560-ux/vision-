import { transcribe } from 'ai'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserTranscriptionModel } from '@/lib/ai/providers'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_AUDIO_BYTES = 15 * 1024 * 1024
const ALLOWED_AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return NextResponse.json({ error: 'Please sign in again to continue.' }, { status: 401 })

  try {
    const formData = await request.formData()
    const audio = formData.get('audio')
    if (!(audio instanceof File)) return NextResponse.json({ error: 'Choose an audio recording to transcribe.' }, { status: 400 })
    if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: 'Audio must be between 1 byte and 15 MB.' }, { status: 413 })

    const mediaType = audio.type.split(';')[0].toLowerCase()
    if (!ALLOWED_AUDIO_TYPES.has(mediaType)) return NextResponse.json({ error: 'Use a supported WebM, Ogg, MP4, WAV, or MPEG audio recording.' }, { status: 415 })

    const result = await transcribe({
      model: await getUserTranscriptionModel(data.user.id),
      audio: new Uint8Array(await audio.arrayBuffer()),
    })
    return NextResponse.json({ text: result.text.trim() })
  } catch (error) {
    console.error('[VISION] Audio transcription failed:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ error: 'Audio transcription is unavailable right now. You can type your message instead.' }, { status: 502 })
  }
}
