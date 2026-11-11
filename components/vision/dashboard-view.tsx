'use client'

import Link from 'next/link'
import { type ReactNode } from 'react'
import useSWR from 'swr'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  CalendarClock,
  Check,
  CheckSquare2,
  Circle,
  Clock3,
  ExternalLink,
  Mic2,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetcher } from '@/components/vision/api-client'
import type { ActivityRecord, AppUser, TaskRecord } from '@/components/vision/types'

type DashboardData = {
  tasks: TaskRecord[]
  task_count: number
  open_task_count: number
  reminders: { id: string; title: string; remind_at: string; status: string }[]
  reminder_count: number
  notes: { id: string; title: string; category: string; pinned: boolean; updated_at: string }[]
  memory_count: number
  activity: ActivityRecord[]
}

const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

function activityLabel(action: string) {
  const labels: Record<string, string> = {
    'task.created': 'Created a task',
    'task.updated': 'Updated a task',
    'task.deleted': 'Removed a task',
    'reminder.created': 'Set a reminder',
    'reminder.updated': 'Updated a reminder',
    'note.created': 'Saved a note',
    'note.updated': 'Edited a note',
    'note.deleted': 'Removed a note',
    'memory.created': 'Added a memory',
    'memory.updated': 'Updated a memory',
    'memory.deleted': 'Removed a memory',
    'research.completed': 'Finished web research',
    'settings.updated': 'Updated preferences',
    'conversation.deleted': 'Deleted a conversation',
  }
  return labels[action] ?? action.replaceAll('.', ' ')
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><Circle aria-hidden="true" size={17} /></span>
      <p className="empty-state-title">{title}</p>
      <p className="muted-copy">{description}</p>
    </div>
  )
}

export function DashboardView({ user }: { user: AppUser }) {
  const { data, error, isLoading, mutate } = useSWR<DashboardData>('/api/v1/dashboard', apiFetcher)
  const firstName = user.displayName.trim().split(/\s+/)[0] || 'there'

  return (
    <div className="dashboard-view">
      <section className="dashboard-hero glass-panel">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles aria-hidden="true" size={13} /> YOUR PERSONAL INTELLIGENCE</p>
          <h2>Good to have you here,<br /><span>{firstName}.</span></h2>
          <p className="hero-description">Make room for what matters. Start a conversation, capture a thought, or take the next small step.</p>
          <div className="hero-actions">
            <Button render={<Link href="/voice" /> } size="lg">
              <Mic2 aria-hidden="true" data-icon="inline-start" /> Talk to VISION
              <ArrowRight aria-hidden="true" data-icon="inline-end" />
            </Button>
            <Button variant="outline" render={<Link href="/chat" />} size="lg">
              <span className="button-text-icon"><AudioLines aria-hidden="true" size={16} /></span> Open workspace
            </Button>
          </div>
          <div className="hero-footnote"><span className="status-indicator" aria-hidden="true" /> Private, multilingual, and ready when you are</div>
        </div>
        <Link className="hero-orb-link" href="/voice" aria-label="Open VISION voice studio">
          <div className="vision-orb hero-orb" data-state="idle"><span>V</span></div>
          <span className="orb-caption">VOICE STUDIO <ArrowUpRight aria-hidden="true" size={13} /></span>
        </Link>
        <div className="hero-glow" aria-hidden="true" />
      </section>

      <section className="metrics-grid" aria-label="Workspace summary">
        <MetricCard title="Open tasks" value={data?.open_task_count ?? 0} caption={data?.open_task_count ? 'A little progress goes a long way.' : 'No open tasks right now.'} icon={<CheckSquare2 aria-hidden="true" size={17} />} href="/tasks" isLoading={isLoading} />
        <MetricCard title="Reminders" value={data?.reminder_count ?? 0} caption={data?.reminder_count ? 'Coming up on your schedule.' : 'Nothing waiting on the clock.'} icon={<CalendarClock aria-hidden="true" size={17} />} href="/tasks" isLoading={isLoading} />
        <MetricCard title="Recent notes" value={data?.notes.length ?? 0} caption={data?.notes.length ? 'Your ideas, kept close.' : 'Make space for a thought.'} icon={<BookOpen aria-hidden="true" size={17} />} href="/notes" isLoading={isLoading} />
        <MetricCard title="Saved memories" value={data?.memory_count ?? 0} caption="Manage what VISION remembers." icon={<Sparkles aria-hidden="true" size={17} />} href="/memory" isLoading={isLoading} />
      </section>

      <div className="dashboard-columns">
        <Card className="dashboard-card">
          <CardHeader className="dashboard-card-header">
            <div>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>One click to get into a flow.</CardDescription>
            </div>
            <Badge variant="outline">SHORTCUTS</Badge>
          </CardHeader>
          <CardContent className="quick-actions-grid">
            <QuickAction href="/tasks" icon={<CalendarClock aria-hidden="true" size={17} />} label="Create a reminder" detail="Set a time to remember" />
            <QuickAction href="/notes" icon={<Plus aria-hidden="true" size={17} />} label="Capture a thought" detail="Write it down, keep moving" />
            <QuickAction href="/research" icon={<Search aria-hidden="true" size={17} />} label="Search the web" detail="Get a sourced briefing" />
            <a className="quick-action" href="https://www.youtube.com" target="_blank" rel="noreferrer">
              <span className="quick-action-icon"><ArrowRight aria-hidden="true" size={17} /></span>
              <span><strong>Open YouTube</strong><small>Continue in this browser</small></span>
              <ExternalLink aria-hidden="true" size={14} className="quick-action-arrow" />
            </a>
          </CardContent>
          <div className="desktop-bridge-note"><Circle aria-hidden="true" size={12} /> Desktop app actions are unavailable until a companion device is paired.</div>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="dashboard-card-header">
            <div>
              <CardTitle>Up next</CardTitle>
              <CardDescription>Your upcoming tasks, from your workspace.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" render={<Link href="/tasks" />}>View all <ArrowRight aria-hidden="true" data-icon="inline-end" /></Button>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="inline-error" role="alert">
                <p>Could not load your workspace data.</p>
                <Button variant="outline" size="sm" onClick={() => void mutate()}>Try again</Button>
              </div>
            ) : isLoading ? (
              <div className="list-skeleton" aria-label="Loading tasks"><span /><span /><span /></div>
            ) : data?.tasks.length ? (
              <ul className="up-next-list">
                {data.tasks.slice(0, 4).map((task) => (
                  <li key={task.id} className="up-next-item">
                    <span className={`task-status-icon status-${task.status}`} aria-hidden="true">
                      {task.status === 'completed' ? <Check size={13} /> : <Circle size={13} />}
                    </span>
                    <div className="up-next-copy">
                      <span className={task.status === 'completed' ? 'task-title completed' : 'task-title'}>{task.title}</span>
                      <span className="task-meta">{task.category} · {task.due_at ? formatter.format(new Date(task.due_at)) : 'No due date'}</span>
                    </div>
                    <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'}>{task.priority}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="A clear slate." description="Your tasks will appear here when you add them." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="dashboard-card activity-card">
        <CardHeader className="dashboard-card-header">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>A quiet record of what you have been working on.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" render={<Link href="/history" />}>Activity <ArrowRight aria-hidden="true" data-icon="inline-end" /></Button>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="inline-error" role="alert"><p>Activity could not be loaded.</p></div>
          ) : isLoading ? (
            <div className="list-skeleton" aria-label="Loading activity"><span /><span /><span /></div>
          ) : data?.activity.length ? (
            <ul className="activity-list">
              {data.activity.map((item) => (
                <li key={item.id}>
                  <span className="activity-icon"><Activity aria-hidden="true" size={15} /></span>
                  <span className="activity-copy"><strong>{activityLabel(item.action)}</strong><small>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</small></span>
                  <Clock3 aria-hidden="true" size={14} className="activity-clock" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Your activity begins here." description="When you save a note, plan a task, or finish research, it will show up here." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ title, value, caption, icon, href, isLoading }: { title: string; value: number | string; caption: string; icon: ReactNode; href: string; isLoading: boolean }) {
  return (
    <Link href={href} className="metric-link">
      <Card className="metric-card">
        <CardContent className="metric-content">
          <div className="metric-top"><span className="metric-icon">{icon}</span><ArrowUpRight aria-hidden="true" size={15} className="metric-arrow" /></div>
          <div className="metric-value">{isLoading ? <span className="metric-loading" aria-label="Loading" /> : value}</div>
          <div className="metric-title">{title}</div>
          <p className="metric-caption">{caption}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function QuickAction({ href, icon, label, detail }: { href: string; icon: ReactNode; label: string; detail: string }) {
  return (
    <Link className="quick-action" href={href}>
      <span className="quick-action-icon">{icon}</span>
      <span><strong>{label}</strong><small>{detail}</small></span>
      <ArrowUpRight aria-hidden="true" size={14} className="quick-action-arrow" />
    </Link>
  )
}
