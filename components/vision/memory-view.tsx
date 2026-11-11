'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { BrainCircuit, LockKeyhole, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiFetcher, apiRequest } from '@/components/vision/api-client'
import type { MemoryRecord, UserSettings } from '@/components/vision/types'

const categories: MemoryRecord['category'][] = ['preference', 'language', 'instruction', 'summary']

export function MemoryView() {
  const { data, error, isLoading, mutate } = useSWR<MemoryRecord[]>('/api/v1/memories', apiFetcher)
  const { data: settings } = useSWR<UserSettings>('/api/v1/settings', apiFetcher)
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<MemoryRecord['category']>('preference')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function saveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    setErrorMessage('')
    try {
      await apiRequest('/api/v1/memories', { method: 'POST', body: JSON.stringify({ category, content: content.trim() }) })
      setContent('')
      await mutate()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The memory could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteMemory(memory: MemoryRecord) {
    if (!window.confirm('Remove this saved memory?')) return
    try {
      await apiRequest(`/api/v1/memories/${memory.id}`, { method: 'DELETE' })
      await mutate()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The memory could not be removed.')
    }
  }

  const memories = data ?? []

  return (
    <div className="view-stack">
      <Card className="memory-banner">
        <CardContent className="memory-banner-content">
          <span className="memory-banner-icon"><LockKeyhole aria-hidden="true" size={19} /></span>
          <div><strong>Memory is under your control.</strong><p>{settings?.memory_enabled ? 'VISION can use these saved details to personalize replies. Nothing is added automatically unless you explicitly ask it to remember.' : 'Memory is turned off. Saved details remain private here, but are not included in assistant context.'}</p></div>
          <Badge variant={settings?.memory_enabled ? 'secondary' : 'outline'}>{settings?.memory_enabled ? 'ON' : 'OFF'}</Badge>
        </CardContent>
      </Card>

      <div className="memory-layout">
        <Card className="workspace-card">
          <CardHeader><CardTitle>Save a memory</CardTitle><CardDescription>Only keep details that will genuinely help future conversations.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={saveMemory}>
              <FieldGroup>
                <Field><FieldLabel htmlFor="memory-category">Type</FieldLabel><select id="memory-category" className="native-select" value={category} onChange={(event) => setCategory(event.target.value as MemoryRecord['category'])}>{categories.map((item) => <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>)}</select></Field>
                <Field><FieldLabel htmlFor="memory-content">What should VISION remember?</FieldLabel><Textarea id="memory-content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="For example: I prefer concise answers with a short summary first." rows={5} maxLength={2000} required /></Field>
                {errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
                <Button type="submit" disabled={saving || !content.trim()}><Plus aria-hidden="true" data-icon="inline-start" />{saving ? 'Saving…' : 'Save memory'}</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card className="workspace-card">
          <CardHeader className="dashboard-card-header"><div><CardTitle>Saved details</CardTitle><CardDescription>Review or remove anything at any time.</CardDescription></div><Badge variant="outline">{isLoading ? 'LOADING' : `${memories.length} SAVED`}</Badge></CardHeader>
          <CardContent>
            {error ? <p className="inline-error" role="alert">{error.message}</p> : isLoading ? <div className="list-skeleton" aria-label="Loading memories"><span /><span /><span /></div> : memories.length ? (
              <ul className="memory-list">
                {memories.map((memory) => (
                  <li key={memory.id}>
                    <span className="memory-list-icon"><BrainCircuit aria-hidden="true" size={16} /></span>
                    <div className="memory-list-copy"><div><Badge variant="secondary">{memory.category}</Badge><span className="memory-source">{memory.source === 'user' ? 'Added by you' : 'Saved at your request'}</span></div><p>{memory.content}</p><time dateTime={memory.created_at}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(memory.created_at))}</time></div>
                    <Button variant="ghost" size="icon" aria-label="Remove memory" onClick={() => void deleteMemory(memory)}><Trash2 aria-hidden="true" /></Button>
                  </li>
                ))}
              </ul>
            ) : <div className="empty-state"><span className="empty-state-icon"><ShieldCheck aria-hidden="true" size={17} /></span><p className="empty-state-title">Nothing saved yet.</p><p className="muted-copy">Your memory starts empty. Add only what you choose.</p></div>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
