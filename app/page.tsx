import { AuthScreen } from '@/components/vision/auth-screen'
import { VisionApp } from '@/components/vision/vision-app'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
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
      section="dashboard"
      user={{
        id: user.id,
        email: user.email ?? '',
        displayName: profile?.display_name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'there',
      }}
    />
  )
}
