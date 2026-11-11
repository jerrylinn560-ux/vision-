'use client'

import { useState, type FormEvent } from 'react'
import useSWR, { mutate as mutateCache } from 'swr'
import { ArrowUpRight, BookOpen, Clock3, ExternalLink, Search, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { apiFetcher } from '@/components/vision/api-client'
import type { ActivityRecord } from '@/components/vision/types'

type SearchSource = { title: string; url: string; snippet?: string }
type ResearchResult = { query: string; summary: string; sources: SearchSource[]; createdAt: string }

async function researchFetcher(url: string): Promise<ResearchResult> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Web research could not be completed.')
  return payload as ResearchResult
}

export function ResearchView() {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const key = submittedQuery ? `/api/research?q=${encodeURIComponent(submittedQuery)}` : null
  const { data: result, error: searchError, isLoading: searching } = useSWR<ResearchResult>(key, researchFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    onSuccess: () => { void mutateCache('/api/v1/activity') },
  })
  const { data: activity } = useSWR<ActivityRecord[]>('/api/v1/activity', apiFetcher)
  const priorResearch = (activity ?? []).filter((item) => item.action === 'research.completed').slice(0, 5)

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = query.trim()
    if (value) setSubmittedQuery(value)
  }

  return (
    <div className="research-layout">
      <div className="view-stack">
        <Card className="research-panel">
          <CardHeader><CardTitle>Ask the web, not just the model</CardTitle><CardDescription>VISION searches current sources and returns a short briefing with links.</CardDescription></CardHeader>
          <CardContent className="view-stack">
            <form className="research-form" onSubmit={submitSearch}>
              <Field className="research-input-field"><FieldLabel htmlFor="research-query" className="sr-only">Research topic</FieldLabel><Input id="research-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What would you like to research?" maxLength={300} required /></Field>
              <Button type="submit" disabled={!query.trim() || searching}><Search aria-hidden="true" data-icon="inline-start" />{searching ? 'Searching…' : 'Research'}</Button>
            </form>
            <p className="muted-copy">Searches are run on demand using the connected Vercel AI Gateway. Results are stored in your private activity history.</p>
            {searchError && <p className="inline-error" role="alert">{searchError.message}</p>}
            {searching && <div className="list-skeleton" aria-label="Searching the web"><span /><span /><span /></div>}
            {result && !searching && (
              <div className="research-results" aria-live="polite">
                <div className="section-heading-row"><div><p className="eyebrow"><Sparkles aria-hidden="true" size={13} /> RESEARCH BRIEFING</p><h2>{result.query}</h2></div><Badge variant="secondary">{result.sources.length} SOURCES</Badge></div>
                <p className="research-summary">{result.summary}</p>
                {result.sources.length ? (
                  <div>
                    <h3 className="small-section-title">Sources</h3>
                    <ul className="source-list">{result.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || source.url} <ExternalLink aria-hidden="true" size={12} /></a>{source.snippet && <p>{source.snippet}</p>}</li>)}</ul>
                  </div>
                ) : <p className="muted-copy">The search provider returned no source links for this request.</p>}
              </div>
            )}
            {!result && !searching && !searchError && <div className="research-empty"><span className="empty-state-icon"><Search aria-hidden="true" size={17} /></span><p>Start with a question that needs current information.</p><span>Examples: “What changed in the latest web accessibility guidance?” or “Compare current battery recycling approaches.”</span></div>}
          </CardContent>
        </Card>
      </div>

      <Card className="workspace-card">
        <CardHeader><CardTitle>Recent research</CardTitle><CardDescription>Saved searches from this account.</CardDescription></CardHeader>
        <CardContent>
          {priorResearch.length ? <div className="research-history-list">{priorResearch.map((item) => {
            const details = item.details as { query?: string; summary?: string }
            return <button className="research-history-item" key={item.id} type="button" onClick={() => { if (details.query) { setQuery(details.query); setSubmittedQuery(details.query) } }}><strong>{details.query || 'Research session'}</strong><p>{details.summary || new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</p><span><Clock3 aria-hidden="true" size={11} /> {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(item.created_at))}<ArrowUpRight aria-hidden="true" size={12} /></span></button>
          })}</div> : <div className="empty-state"><span className="empty-state-icon"><BookOpen aria-hidden="true" size={17} /></span><p className="empty-state-title">No research saved yet.</p><p className="muted-copy">Your completed research briefs will appear here.</p></div>}
        </CardContent>
      </Card>
    </div>
  )
}
