'use client'

import { useState, type FormEvent } from 'react'
import useSWR, { mutate as mutateCache } from 'swr'
import { BookOpen, Check, Edit3, Pin, Plus, Save, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiFetcher, apiRequest } from '@/components/vision/api-client'
import type { NoteRecord } from '@/components/vision/types'

export function NotesView() {
  const { data, error, isLoading, mutate } = useSWR<NoteRecord[]>('/api/v1/notes', apiFetcher)
  const notes = data ?? []
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('General')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  function startEdit(note: NoteRecord) {
    setEditingId(note.id)
    setTitle(note.title)
    setContent(note.content)
    setCategory(note.category)
    setErrorMessage('')
  }

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setContent('')
    setCategory('General')
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setErrorMessage('')
    try {
      const body = { title: title.trim(), content: content.trim(), category: category.trim() || 'General' }
      if (editingId) {
        await apiRequest(`/api/v1/notes/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await apiRequest('/api/v1/notes', { method: 'POST', body: JSON.stringify(body) })
      }
      resetForm()
      await Promise.all([mutate(), mutateCache('/api/v1/dashboard')])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The note could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePinned(note: NoteRecord) {
    try {
      await apiRequest(`/api/v1/notes/${note.id}`, { method: 'PATCH', body: JSON.stringify({ pinned: !note.pinned }) })
      await Promise.all([mutate(), mutateCache('/api/v1/dashboard')])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The note could not be updated.')
    }
  }

  async function deleteNote(note: NoteRecord) {
    if (!window.confirm(`Delete “${note.title}”? This cannot be undone.`)) return
    try {
      await apiRequest(`/api/v1/notes/${note.id}`, { method: 'DELETE' })
      if (editingId === note.id) resetForm()
      await Promise.all([mutate(), mutateCache('/api/v1/dashboard')])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The note could not be deleted.')
    }
  }

  return (
    <div className="notes-layout">
      <Card className="workspace-card note-editor-card">
        <CardHeader><CardTitle>{editingId ? 'Edit note' : 'Capture a thought'}</CardTitle><CardDescription>Your notes are private to your account.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={saveNote}>
            <FieldGroup>
              <Field><FieldLabel htmlFor="note-title">Title</FieldLabel><Input id="note-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A thought to keep" maxLength={180} required /></Field>
              <Field><FieldLabel htmlFor="note-category">Category</FieldLabel><Input id="note-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={60} /></Field>
              <Field><FieldLabel htmlFor="note-content">Note</FieldLabel><Textarea id="note-content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write freely. This stays in your private workspace." rows={8} maxLength={12000} /></Field>
              {errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
              <div className="form-actions">
                <Button type="submit" disabled={saving || !title.trim()}><Save aria-hidden="true" data-icon="inline-start" />{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save note'}</Button>
                {editingId && <Button type="button" variant="ghost" onClick={resetForm}><X aria-hidden="true" data-icon="inline-start" />Cancel</Button>}
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <section className="notes-list-section" aria-labelledby="notes-heading">
        <div className="section-heading-row"><div><h2 id="notes-heading">Your notes</h2><p className="muted-copy">{notes.length} saved in your workspace</p></div><Badge variant="outline">{isLoading ? 'LOADING' : `${notes.length} NOTES`}</Badge></div>
        {error ? <p className="inline-error" role="alert">{error.message}</p> : isLoading ? <div className="list-skeleton" aria-label="Loading notes"><span /><span /><span /></div> : notes.length ? (
          <div className="notes-grid">
            {notes.map((note) => (
              <Card className={`note-card ${note.pinned ? 'note-card-pinned' : ''}`} key={note.id}>
                <CardHeader className="note-card-header">
                  <div><Badge variant="secondary">{note.category}</Badge>{note.pinned && <span className="pinned-label"><Pin aria-hidden="true" size={12} /> Pinned</span>}</div>
                  <div className="note-card-actions">
                    <Button variant="ghost" size="icon" aria-label={note.pinned ? `Unpin ${note.title}` : `Pin ${note.title}`} onClick={() => void togglePinned(note)}><Pin aria-hidden="true" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${note.title}`} onClick={() => startEdit(note)}><Edit3 aria-hidden="true" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${note.title}`} onClick={() => void deleteNote(note)}><Trash2 aria-hidden="true" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <h3>{note.title}</h3>
                  <p className="note-content">{note.content || 'No additional details.'}</p>
                  <time dateTime={note.updated_at}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(note.updated_at))}</time>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="empty-state notes-empty"><span className="empty-state-icon"><BookOpen aria-hidden="true" size={17} /></span><p className="empty-state-title">No notes yet.</p><p className="muted-copy">Start with one thought you do not want to lose.</p><Button variant="outline" onClick={() => document.getElementById('note-title')?.focus()}><Plus aria-hidden="true" data-icon="inline-start" />Write a note</Button></div>
        )}
      </section>
    </div>
  )
}
