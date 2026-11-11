import { notFound } from 'next/navigation'
import { AuthScreen } from '@/components/vision/auth-screen'
import { VisionApp } from '@/components/vision/vision-app'
import { createClient } from '@/lib/supabase/server'
import { sections, type Section } from '@/components/vision/types'

const validSections = new Set<string>(sections)
const conversationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SectionPageProps = {
  params: Promise<{ section: string }>
  searchParams: Promise<{ conversation?: string }>
}

export default async function SectionPage({ params, searchParams }: SectionPageProps) {
  const [{ section }, query] = await Promise.all([params, searchParams])
  if (!validSections.has(section)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <AuthScreen />

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <VisionApp
      section={section as Section}
      initialConversationId={query.conversation && conversationIdPattern.test(query.conversation) ? query.conversation : undefined}
      user={{
        id: user.id,
        email: user.email ?? '',
        displayName: profile?.display_name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'there',
      }}
    />
  )
}
