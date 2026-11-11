import { redirect } from 'next/navigation'
import { AuthScreen } from '@/components/vision/auth-screen'
import { createClient } from '@/lib/supabase/server'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')
  return <AuthScreen />
}
