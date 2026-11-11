'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  Activity,
  AudioLines,
  BookOpen,
  BrainCircuit,
  CheckSquare2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  History,
  LayoutDashboard,
  KeyRound,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquareText,
  MonitorSmartphone,
  Search,
  Settings2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { AppUser, Section } from '@/components/vision/types'
import { ChatView } from '@/components/vision/chat-view'
import { DashboardView } from '@/components/vision/dashboard-view'
import { DevicesView, HistoryView, SecurityView, SettingsView } from '@/components/vision/other-views'
import { ApiSettingsView } from '@/components/vision/api-settings-view'
import { MemoryView } from '@/components/vision/memory-view'
import { NotesView } from '@/components/vision/notes-view'
import { ResearchView } from '@/components/vision/research-view'
import { TasksView } from '@/components/vision/tasks-view'

const navigation = [
  { section: 'dashboard', label: 'Overview', icon: LayoutDashboard, group: 'workspace' },
  { section: 'chat', label: 'AI workspace', icon: MessageSquareText, group: 'workspace' },
  { section: 'voice', label: 'Voice studio', icon: AudioLines, group: 'workspace' },
  { section: 'tasks', label: 'Tasks & reminders', icon: CheckSquare2, group: 'organize' },
  { section: 'notes', label: 'Notes', icon: BookOpen, group: 'organize' },
  { section: 'memory', label: 'Memory', icon: BrainCircuit, group: 'organize' },
  { section: 'research', label: 'Web research', icon: Search, group: 'organize' },
  { section: 'devices', label: 'Devices', icon: MonitorSmartphone, group: 'system' },
  { section: 'history', label: 'Conversation history', icon: History, group: 'system' },
  { section: 'settings', label: 'Preferences', icon: Settings2, group: 'system' },
  { section: 'api-settings', label: 'API settings', icon: KeyRound, group: 'system' },
  { section: 'security', label: 'Security & privacy', icon: LockKeyhole, group: 'system' },
] as const

const pageCopy: Record<Section, { title: string; description: string }> = {
  dashboard: { title: 'Your space, in focus.', description: 'A clear view of what matters today.' },
  chat: { title: 'AI workspace', description: 'Think out loud, make a plan, or ask anything.' },
  voice: { title: 'Voice studio', description: 'A private push-to-talk space for hands-free conversations.' },
  tasks: { title: 'Tasks & reminders', description: 'Keep the next step clear and the timing right.' },
  notes: { title: 'Notes', description: 'A calm place for the thoughts you want to keep.' },
  memory: { title: 'Memory', description: 'Review and control the details VISION is allowed to remember.' },
  research: { title: 'Web research', description: 'Search current sources and read a concise, sourced briefing.' },
  devices: { title: 'Connected devices', description: 'Manage the devices paired with your workspace.' },
  history: { title: 'Conversation history', description: 'Return to a conversation when you are ready.' },
  settings: { title: 'Preferences', description: 'Choose how VISION responds and speaks with you.' },
  'api-settings': { title: 'API settings', description: 'Connect your own model providers and manage their credentials.' },
  security: { title: 'Security & privacy', description: 'Your account, access, and personal data controls.' },
}

const groupLabels: Record<string, string> = {
  workspace: 'Workspace',
  organize: 'Organize',
  system: 'System',
}

async function healthFetcher(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('API unavailable')
  return response.json() as Promise<{ status: string; service: string }>
}

function PageContent({ section, user, initialConversationId }: { section: Section; user: AppUser; initialConversationId?: string }) {
  if (section === 'dashboard') return <DashboardView user={user} />
  if (section === 'chat') return <ChatView initialConversationId={initialConversationId} />
  if (section === 'voice') return <ChatView initialConversationId={initialConversationId} voiceMode />
  if (section === 'tasks') return <TasksView />
  if (section === 'notes') return <NotesView />
  if (section === 'memory') return <MemoryView />
  if (section === 'research') return <ResearchView />
  if (section === 'devices') return <DevicesView />
  if (section === 'history') return <HistoryView />
  if (section === 'settings') return <SettingsView user={user} />
  if (section === 'api-settings') return <ApiSettingsView />
  return <SecurityView user={user} />
}

export function VisionApp({ section, user, initialConversationId }: { section: Section; user: AppUser; initialConversationId?: string }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const pathname = usePathname()
  const page = pageCopy[section]
  const { data: health, error: healthError } = useSWR('/api/v1/health', healthFetcher, { refreshInterval: 45_000, revalidateOnFocus: false })

  async function signOut() {
    setSigningOut(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      setSigningOut(false)
      return
    }
    window.location.assign('/login')
  }

  return (
    <div className="app-frame vision-grid">
      {mobileNavOpen && <button className="mobile-nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`app-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <Link href="/" className="brand-lockup" aria-label="VISION overview">
            <span className="brand-mark" aria-hidden="true">V</span>
            <span className="brand-name">V.I.S.I.O.N.</span>
          </Link>
          <span className="brand-caption">PERSONAL INTELLIGENCE</span>
          <Button variant="ghost" size="icon" className="mobile-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}>
            <X aria-hidden="true" />
          </Button>
        </div>

        <nav className="sidebar-navigation">
          {(['workspace', 'organize', 'system'] as const).map((group) => (
            <div className="nav-group" key={group}>
              <p className="nav-group-label">{groupLabels[group]}</p>
              {navigation.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon
                const href = item.section === 'dashboard' ? '/' : `/${item.section}`
                const isActive = section === item.section
                return (
                  <Link
                    href={href}
                    key={item.section}
                    className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <Icon aria-hidden="true" size={17} />
                    <span>{item.label}</span>
                    {item.section === 'voice' && <span className="nav-live-dot" aria-label="Voice available" />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status-card">
            <div className="status-card-top">
              <span className={`status-indicator ${health ? '' : 'status-indicator-muted'}`} aria-hidden="true" />
              <span>Workspace status</span>
            </div>
            <p>{health ? 'API online' : healthError ? 'API unavailable' : 'Checking services'}</p>
            <span className="status-card-note">Supabase · AI Gateway</span>
          </div>
          <div className="sidebar-user">
            <div className="user-avatar" aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div className="user-identity">
              <span className="user-name">{user.displayName}</span>
              <span className="user-email">{user.email}</span>
            </div>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut} disabled={signingOut}>
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="app-main-column">
        <header className="app-header">
          <div className="header-title-wrap">
            <Button variant="ghost" size="icon" className="mobile-menu" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}>
              <Menu aria-hidden="true" />
            </Button>
            <div>
              <p className="header-breadcrumb"><Command aria-hidden="true" size={13} /> VISION / {section.toUpperCase()}</p>
              <h1>{page.title}</h1>
              <p className="header-description">{page.description}</p>
            </div>
          </div>
          <div className="header-actions">
            <Badge variant={health ? 'secondary' : 'outline'} className="connection-badge">
              <span className={`status-indicator ${health ? '' : 'status-indicator-muted'}`} aria-hidden="true" />
              {health ? 'API online' : healthError ? 'API offline' : 'Connecting'}
            </Badge>
            <Button render={<Link href="/chat" />}>
              <MessageSquareText aria-hidden="true" data-icon="inline-start" />
              New conversation
            </Button>
          </div>
        </header>

        <main className="app-content" id="main-content" key={pathname}>
          <PageContent section={section} user={user} initialConversationId={initialConversationId} />
        </main>

        <footer className="app-footer">
          <span><span className="footer-dot" aria-hidden="true" /> YOUR SPACE, YOUR PACE</span>
          <Link href="/security">Privacy & security <ChevronRight aria-hidden="true" size={13} /></Link>
        </footer>
      </div>
    </div>
  )
}
