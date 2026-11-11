import { generateText, gateway, stepCountIs } from 'ai'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserLanguageModel } from '@/lib/ai/providers'

export const runtime = 'nodejs'
export const maxDuration = 60

type Source = { title: string; url: string; snippet?: string }

function collectSources(value: unknown, output: Source[], seen: Set<string>, depth = 0) {
  if (depth > 6 || output.length >= 10 || value == null) return
  if (Array.isArray(value)) {
    for (const item of value) collectSources(item, output, seen, depth + 1)
    return
  }
  if (typeof value !== 'object') return

  const record = value as Record<string, unknown>
  const rawUrl = typeof record.url === 'string' ? record.url : typeof record.uri === 'string' ? record.uri : null
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl)
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !seen.has(parsed.href)) {
        seen.add(parsed.href)
        output.push({
          url: parsed.href,
          title: typeof record.title === 'string' ? record.title.slice(0, 300) : parsed.hostname,
          snippet: typeof record.snippet === 'string' ? record.snippet.slice(0, 700) : typeof record.description === 'string' ? record.description.slice(0, 700) : undefined,
        })
      }
    } catch {
      return
    }
  }
  for (const [key, nested] of Object.entries(record)) {
    if (['results', 'sources', 'output', 'result', 'data', 'content'].includes(key)) {
      collectSources(nested, output, seen, depth + 1)
    }
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  const user = authData.user
  if (authError || !user) return NextResponse.json({ error: 'Please sign in again to continue.' }, { status: 401 })

  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query || query.length < 2 || query.length > 300) {
    return NextResponse.json({ error: 'Enter a research topic between 2 and 300 characters.' }, { status: 400 })
  }

  try {
    const result = await generateText({
      model: await getUserLanguageModel(user.id),
      system: 'You are VISION Research. Use the live web-search tool for every request. Summarize current facts in a concise, balanced briefing. Separate verified facts from uncertainty. Do not fabricate citations or dates. The app will display source URLs returned by the search tool separately.',
      prompt: `Research this question using current web sources: ${query}`,
      tools: { webSearch: gateway.tools.perplexitySearch({ maxResults: 6 }) },
      stopWhen: stepCountIs(5),
    })

    const collectedSources: Source[] = []
    const seen = new Set<string>()
    const resultParts = result as unknown as {
      sources?: unknown
      steps?: Array<{ toolResults?: Array<{ output?: unknown; result?: unknown }> }>
    }
    collectSources(resultParts.sources, collectedSources, seen)
    for (const step of resultParts.steps ?? []) {
      for (const toolResult of step.toolResults ?? []) {
        collectSources(toolResult.output ?? toolResult.result, collectedSources, seen)
      }
    }

    const summary = result.text.trim()
    const createdAt = new Date().toISOString()
    const sources = collectedSources.slice(0, 8)
    const { error: logError } = await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'research.completed',
      details: { query, summary: summary.slice(0, 5000), sources },
    })
    if (logError) console.error('[VISION] Research history save failed:', logError.code)

    return NextResponse.json({ query, summary, sources, createdAt })
  } catch (error) {
    console.error('[VISION] Research request failed:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ error: 'Live web research is temporarily unavailable. Try again shortly.' }, { status: 502 })
  }
}
