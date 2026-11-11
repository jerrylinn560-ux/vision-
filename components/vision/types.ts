export const sections = [
  'dashboard',
  'chat',
  'voice',
  'tasks',
  'notes',
  'memory',
  'research',
  'devices',
  'history',
  'settings',
  'api-settings',
  'security',
] as const

export type Section = (typeof sections)[number]

export type AppUser = {
  id: string
  email: string
  displayName: string
}

export type TaskRecord = {
  id: string
  title: string
  description: string
  category: string
  priority: 'low' | 'medium' | 'high'
  status: 'planned' | 'in_progress' | 'completed'
  due_at: string | null
  created_at: string
  updated_at: string
}

export type ReminderRecord = {
  id: string
  task_id: string | null
  title: string
  remind_at: string
  status: 'pending' | 'completed' | 'cancelled'
}

export type NoteRecord = {
  id: string
  title: string
  content: string
  category: string
  pinned: boolean
  created_at: string
  updated_at: string
}

export type MemoryRecord = {
  id: string
  category: 'preference' | 'language' | 'instruction' | 'summary'
  content: string
  source: 'user' | 'assistant'
  created_at: string
  updated_at: string
}

export type ActivityRecord = {
  id: string
  action: string
  details: Record<string, unknown>
  created_at: string
}

export type ConversationRecord = {
  id: string
  title: string
  channel: 'text' | 'voice'
  created_at: string
  updated_at: string
}

export type MessageRecord = {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type UserSettings = {
  preferred_language: 'en' | 'ur' | 'roman-ur'
  voice_name: 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer'
  speech_rate: number
  memory_enabled: boolean
  confirm_sensitive_actions: boolean
}

export type DeviceRecord = {
  id: string
  name: string
  platform: 'web' | 'desktop' | 'mobile'
  status: 'connected' | 'disconnected'
  last_seen_at: string
  created_at: string
}
