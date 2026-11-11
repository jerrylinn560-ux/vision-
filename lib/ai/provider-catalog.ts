import 'server-only'

import type { AIProviderId } from '@/lib/ai/types'

export class ProviderHttpError extends Error {
  constructor(readonly statusCode: number) {
    super('Provider request failed.')
    this.name = 'ProviderHttpError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toModelId(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/^models\//, '').trim()
  if (!normalized || normalized.length > 200 || /(?:embedding|whisper|tts|speech|transcription|moderation|dall-e|image|audio|realtime|safety)/i.test(normalized)) {
    return null
  }
  return normalized
}

function parseModels(payload: unknown) {
  if (!isRecord(payload)) return []
  const entries = Array.isArray(payload.models) ? payload.models : Array.isArray(payload.data) ? payload.data : []

  const models = entries.flatMap((entry) => {
    if (typeof entry === 'string') return [toModelId(entry)].filter((id): id is string => Boolean(id))
    if (!isRecord(entry)) return []

    const methods = Array.isArray(entry.supportedGenerationMethods) ? entry.supportedGenerationMethods : []
    if (methods.length && !methods.includes('generateContent')) return []

    const id = toModelId(entry.name ?? entry.id)
    return id ? [id] : []
  })

  const results = [...new Set(models)].sort((a, b) => a.localeCompare(b))
  return results.length ? results : ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-1.5-pro']
}

export async function fetchProviderModels(_provider: AIProviderId, apiKey: string, _baseUrl?: string | null) {
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models'
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-goog-api-key': apiKey,
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('Google Gemini API did not respond before the timeout.')
    }
    throw new Error('Could not reach Google Gemini API. Check your network connection.')
  }

  if (!response.ok) throw new ProviderHttpError(response.status)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('Google Gemini returned an invalid model list.')
  }

  return parseModels(payload)
}

export function providerErrorResponse(error: unknown) {
  if (error instanceof ProviderHttpError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return { status: 401, detail: 'Google Gemini rejected this API key. Verify your Gemini key in Google AI Studio.' }
    }
    if (error.statusCode === 404) {
      return { status: 400, detail: 'The Gemini model was not found.' }
    }
    if (error.statusCode === 429) {
      return { status: 429, detail: 'Google Gemini rate limit reached (Free tier limit). Wait a moment and try again.' }
    }
    if (error.statusCode >= 500) {
      return { status: 502, detail: 'Google Gemini service is temporarily unavailable. Try again shortly.' }
    }
  }

  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return { status: 504, detail: 'Google Gemini did not respond before the timeout.' }
  }

  const statusCode = isRecord(error) && typeof error.statusCode === 'number' ? error.statusCode : null
  if (statusCode === 401 || statusCode === 403) {
    return { status: 401, detail: 'Google Gemini rejected this API key.' }
  }
  if (statusCode === 429) {
    return { status: 429, detail: 'Gemini free tier quota/rate limit reached. Please wait a moment.' }
  }
  if (statusCode && statusCode >= 500) {
    return { status: 502, detail: 'Google Gemini service is temporarily unavailable.' }
  }

  return { status: 502, detail: 'Connection to Google Gemini failed. Check your API key and try again.' }
}
