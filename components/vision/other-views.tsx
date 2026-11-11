'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Activity, AudioLines, Check, Clock3, Laptop, LockKeyhole, LogOut, MonitorSmartphone, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { apiFetcher, apiRequest } from '@/components/vision/api-client'
import { createClient } from '@/lib/supabase/client'
import type { ActivityRecord, AppUser, ConversationRecord, DeviceRecord, UserSettings } from '@/components/vision/types'

type ProfileRecord = { display_name: string }

function activityLabel(action: string) {
  const labels: Record<string, string> = {
    'task.created': 'Created a task', 'task.updated': 'Updated a task', 'task.deleted': 'Removed a task',
    'reminder.created': 'Set a reminder', 'reminder.updated': 'Updated a reminder', 'reminder.deleted': 'Removed a reminder',
    'note.created': 'Saved a note', 'note.updated': 'Edited a note', 'note.deleted': 'Removed a note',
    'memory.created': 'Added a memory', 'memory.updated': 'Updated a memory', 'memory.deleted': 'Removed a memory',
    'research.completed': 'Finished web research', 'settings.updated': 'Updated preferences',
    'profile.updated': 'Updated account profile', 'conversation.deleted': 'Deleted a conversation',
  }
  return labels[action] ?? action.replaceAll('.', ' ')
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function DevicesView() {
  const { data, error, isLoading, mutate } = useSWR<DeviceRecord[]>('/api/v1/devices', apiFetcher)
  const devices = data ?? []

  async function removeDevice(device: DeviceRecord) {
    if (!window.confirm(`Remove ${device.name} from this account?`)) return
    await apiRequest(`/api/v1/devices/${device.id}`, { method: 'DELETE' })
    await mutate()
  }

  return (
    <div className="device-grid">
      <Card className="workspace-card">
        <CardHeader><CardTitle>Paired devices</CardTitle><CardDescription>Only devices linked to your account appear here.</CardDescription></CardHeader>
        <CardContent>
          {error ? <p className="inline-error" role="alert">{error.message}</p> : isLoading ? <div className="list-skeleton" aria-label="Loading devices"><span /><span /><span /></div> : devices.length ? (
            devices.map((device) => {
              const DeviceIcon = device.platform === 'desktop' ? Laptop : device.platform === 'mobile' ? Smartphone : MonitorSmartphone
              return <div className="device-row" key={device.id}><span className="history-row-icon"><DeviceIcon aria-hidden="true" size={16} /></span><span className="device-row-copy"><strong>{device.name}</strong><small>{device.platform} · Last active {formatDate(device.last_seen_at)}</small></span><Badge variant={device.status === 'connected' ? 'secondary' : 'outline'}>{device.status}</Badge><Button variant="ghost" size="icon" aria-label={`Remove ${device.name}`} onClick={() => void removeDevice(device)}><Trash2 aria-hidden="true" /></Button></div>
            })
          ) : (
            <div className="device-empty"><span className="device-empty-icon"><MonitorSmartphone aria-hidden="true" size={19} /></span><h3>No companion devices paired</h3><p>This browser session is active, but no separate desktop or mobile companion is connected. App-level actions will stay in this browser until a device is paired.</p><Badge variant="outline">0 PAIRED DEVICES</Badge></div>
          )}
        </CardContent>
      </Card>
      <Card className="workspace-card">
        <CardHeader><CardTitle>Device privacy</CardTitle><CardDescription>Pairing is always explicit.</CardDescription></CardHeader>
        <CardContent className="view-stack">
          <div className="security-callout"><ShieldCheck aria-hidden="true" size={17} /><p><strong>No background access.</strong> VISION does not control your desktop, read files, or launch apps from this web preview. Those capabilities require a paired companion app and explicit permissions.</p></div>
          <div className="security-row"><span className="history-row-icon"><AudioLines aria-hidden="true" size={16} /></span><span className="security-row-copy"><strong>Microphone</strong><small>Requested only when you start recording in Voice Studio.</small></span><Badge variant="outline">ON DEMAND</Badge></div>
          <div className="security-row"><span className="history-row-icon"><LockKeyhole aria-hidden="true" size={16} /></span><span className="security-row-copy"><strong>Session access</strong><small>Protected by Supabase Auth and row-level security.</small></span><Badge variant="secondary">ACTIVE</Badge></div>
          <p className="muted-copy">A desktop pairing flow and native action bridge are part of the companion-app phase; no pairing codes or device records are simulated here.</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function HistoryView() {
  const { data, error, isLoading, mutate } = useSWR<ConversationRecord[]>('/api/v1/conversations', apiFetcher)
  const [errorMessage, setErrorMessage] = useState('')
  const conversations = data ?? []

  async function deleteConversation(conversation: ConversationRecord) {
    if (!window.confirm(`Delete “${conversation.title}” and all of its messages? This cannot be undone.`)) return
    setErrorMessage('')
    try {
      await apiRequest(`/api/v1/conversations/${conversation.id}`, { method: 'DELETE' })
      await mutate()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The conversation could not be deleted.')
    }
  }

  return (
    <div className="view-stack">
      <Card className="workspace-card">
        <CardHeader className="dashboard-card-header"><div><CardTitle>Your conversations</CardTitle><CardDescription>Stored privately under your signed-in account.</CardDescription></div><Badge variant="outline">{isLoading ? 'LOADING' : `${conversations.length} SAVED`}</Badge></CardHeader>
        <CardContent>
          {errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
          {error ? <p className="inline-error" role="alert">{error.message}</p> : isLoading ? <div className="list-skeleton" aria-label="Loading conversations"><span /><span /><span /></div> : conversations.length ? (
            <div className="history-list">
              {conversations.map((conversation) => (
                <div className="history-row" key={conversation.id}>
                  <Link href={`/${conversation.channel === 'voice' ? 'voice' : 'chat'}?conversation=${conversation.id}`}>
                    <span className="history-row-icon">{conversation.channel === 'voice' ? <AudioLines aria-hidden="true" size={16} /> : <Clock3 aria-hidden="true" size={16} />}</span>
                    <span className="history-row-copy"><strong>{conversation.title}</strong><small>{conversation.channel} · Updated {formatDate(conversation.updated_at)}</small></span>
                  </Link>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${conversation.title}`} onClick={() => void deleteConversation(conversation)}><Trash2 aria-hidden="true" /></Button>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><span className="empty-state-icon"><Activity aria-hidden="true" size={17} /></span><p className="empty-state-title">No conversations saved.</p><p className="muted-copy">Your next conversation will be stored here.</p><Button render={<Link href="/chat" />}>Start a conversation</Button></div>}
        </CardContent>
      </Card>
    </div>
  )
}

export function SettingsView({ user }: { user: AppUser }) {
  const { data: remoteSettings, error, isLoading, mutate } = useSWR<UserSettings>('/api/v1/settings', apiFetcher)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [displayName, setDisplayName] = useState(user.displayName)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (remoteSettings) setSettings(remoteSettings)
  }, [remoteSettings])

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settings || !displayName.trim()) return
    setSaving(true)
    setNotice('')
    setErrorMessage('')
    try {
      await Promise.all([
        apiRequest('/api/v1/settings', { method: 'PUT', body: JSON.stringify(settings) }),
        apiRequest('/api/v1/profile', { method: 'PUT', body: JSON.stringify({ display_name: displayName.trim() }) }),
      ])
      await mutate(settings, false)
      setNotice('Your preferences are saved to your account.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Your preferences could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  function updateSetting<Key extends keyof UserSettings>(key: Key, value: UserSettings[Key]) {
    setSettings((current) => current ? { ...current, [key]: value } : current)
  }

  return (
    <div className="settings-grid">
      <Card className="workspace-card">
        <CardHeader><CardTitle>How VISION responds</CardTitle><CardDescription>These settings are stored in your private Supabase account.</CardDescription></CardHeader>
        <CardContent>
          {error && <p className="inline-error" role="alert">{error.message}</p>}
          {errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
          {isLoading || !settings ? <div className="list-skeleton" aria-label="Loading preferences"><span /><span /><span /></div> : (
            <form className="settings-form" onSubmit={savePreferences}>
              <FieldGroup>
                <Field><FieldLabel htmlFor="profile-name">Display name</FieldLabel><Input id="profile-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required /></Field>
                <Field><FieldLabel htmlFor="preferred-language">Preferred language</FieldLabel><select id="preferred-language" className="native-select" value={settings.preferred_language} onChange={(event) => updateSetting('preferred_language', event.target.value as UserSettings['preferred_language'])}><option value="en">English</option><option value="ur">Urdu</option><option value="roman-ur">Roman Urdu</option></select></Field>
                <Field><FieldLabel htmlFor="voice-name">Voice</FieldLabel><select id="voice-name" className="native-select" value={settings.voice_name} onChange={(event) => updateSetting('voice_name', event.target.value as UserSettings['voice_name'])}><option value="alloy">Alloy</option><option value="echo">Echo</option><option value="fable">Fable</option><option value="nova">Nova</option><option value="onyx">Onyx</option><option value="shimmer">Shimmer</option></select></Field>
                <Field><FieldLabel htmlFor="speech-rate">Speech rate</FieldLabel><div className="range-row"><input id="speech-rate" type="range" min="0.75" max="1.25" step="0.05" value={settings.speech_rate} onChange={(event) => updateSetting('speech_rate', Number(event.target.value))} /><span className="range-value">{settings.speech_rate.toFixed(2)}×</span></div></Field>
              </FieldGroup>
              <div className="settings-toggle-row"><input id="memory-enabled" type="checkbox" checked={settings.memory_enabled} onChange={(event) => updateSetting('memory_enabled', event.target.checked)} /><label className="settings-toggle-copy" htmlFor="memory-enabled"><strong>Use saved memory</strong><span>Include the details you have saved in future assistant context.</span></label></div>
              <div className="settings-toggle-row"><input id="confirm-actions" type="checkbox" checked={settings.confirm_sensitive_actions} onChange={(event) => updateSetting('confirm_sensitive_actions', event.target.checked)} /><label className="settings-toggle-copy" htmlFor="confirm-actions"><strong>Confirm sensitive actions</strong><span>Keep an extra confirmation before any future desktop or account-level action.</span></label></div>
              <div className="settings-save-row"><Button type="submit" disabled={saving || !displayName.trim()}>{saving ? 'Saving…' : 'Save preferences'}</Button>{notice && <p role="status">{notice}</p>}</div>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="view-stack">
        <Card className="workspace-card">
          <CardHeader><CardTitle>Language behavior</CardTitle><CardDescription>Automatic language matching stays enabled.</CardDescription></CardHeader>
          <CardContent className="view-stack">
            <div className="security-callout"><Check aria-hidden="true" size={16} /><p><strong>English, Urdu, and Roman Urdu.</strong> The assistant is instructed to respond in the language you use. Voice transcription detects speech language automatically where the model supports it.</p></div>
            <p className="muted-copy">The selected language guides the assistant when your message is ambiguous. You can still use any language at any time.</p>
          </CardContent>
        </Card>
        <Card className="workspace-card">
          <CardHeader><CardTitle>AI provider</CardTitle><CardDescription>Protected server-side model access.</CardDescription></CardHeader>
          <CardContent className="view-stack">
            <div className="security-row"><span className="history-row-icon"><AudioLines aria-hidden="true" size={16} /></span><span className="security-row-copy"><strong>Google Gemini AI</strong><small>Gemini free tier chat, transcription, speech, and vision tools.</small></span><Badge variant="secondary">CONNECTED</Badge></div>
            <p className="muted-copy">Provider calls run on the server. Provider credentials are never sent to the browser.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function SecurityView({ user }: { user: AppUser }) {
  const { data: activity, error, isLoading } = useSWR<ActivityRecord[]>('/api/v1/activity', apiFetcher)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  async function signOut() {
    setSigningOut(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      setSignOutError('We could not end this session. Please try again.')
      setSigningOut(false)
      return
    }
    window.location.assign('/login')
  }

  return (
    <div className="view-stack">
      <div className="security-grid">
        <Card className="workspace-card">
          <CardHeader><CardTitle>Account access</CardTitle><CardDescription>Manage the account that owns this workspace.</CardDescription></CardHeader>
          <CardContent className="view-stack">
            <div className="security-row"><span className="user-avatar" aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</span><span className="security-row-copy"><strong>{user.displayName}</strong><small>{user.email}</small></span><Badge variant="secondary">SIGNED IN</Badge></div>
            <div className="security-callout"><ShieldCheck aria-hidden="true" size={17} /><p><strong>Protected data access.</strong> Every user data table enforces Supabase row-level security. The API verifies your Supabase session and never accepts a client-supplied user ID.</p></div>
            {signOutError && <p className="inline-error" role="alert">{signOutError}</p>}
            <Button variant="outline" onClick={() => void signOut()} disabled={signingOut}><LogOut aria-hidden="true" data-icon="inline-start" />{signingOut ? 'Signing out…' : 'Sign out of this browser'}</Button>
          </CardContent>
        </Card>
        <Card className="workspace-card">
          <CardHeader><CardTitle>Privacy controls</CardTitle><CardDescription>Data remains associated with this account.</CardDescription></CardHeader>
          <CardContent className="view-stack">
            <div className="security-row"><span className="history-row-icon"><LockKeyhole aria-hidden="true" size={16} /></span><span className="security-row-copy"><strong>Conversations, notes, tasks, and memories</strong><small>Private tables protected by RLS policies scoped to your user ID.</small></span><Badge variant="outline">RLS</Badge></div>
            <div className="security-row"><span className="history-row-icon"><AudioLines aria-hidden="true" size={16} /></span><span className="security-row-copy"><strong>Voice recordings</strong><small>Transcribed on the server; the uploaded audio is not stored.</small></span><Badge variant="outline">EPHEMERAL</Badge></div>
            <div className="security-row"><span className="history-row-icon"><MonitorSmartphone aria-hidden="true" size={16} /></span><span className="security-row-copy"><strong>Desktop access</strong><small>No desktop companion is paired to this account.</small></span><Badge variant="outline">NOT PAIRED</Badge></div>
            <Link className="text-link" href="/memory">Review saved memory <span aria-hidden="true">→</span></Link>
          </CardContent>
        </Card>
      </div>
      <Card className="workspace-card">
        <CardHeader><CardTitle>Recent account activity</CardTitle><CardDescription>Events from your own workspace only.</CardDescription></CardHeader>
        <CardContent>
          {error ? <p className="inline-error" role="alert">{error.message}</p> : isLoading ? <div className="list-skeleton" aria-label="Loading activity"><span /><span /><span /></div> : activity?.length ? (
            <ul className="activity-list">{activity.slice(0, 8).map((item) => <li key={item.id}><span className="activity-icon"><Activity aria-hidden="true" size={15} /></span><span className="activity-copy"><strong>{activityLabel(item.action)}</strong><small>{formatDate(item.created_at)}</small></span></li>)}</ul>
          ) : <p className="muted-copy">There is no activity to show yet.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

export function ProfileNameField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Field><FieldLabel htmlFor="profile-name">Display name</FieldLabel><Input id="profile-name" value={value} onChange={(event) => onChange(event.target.value)} maxLength={80} required /></Field>
}
