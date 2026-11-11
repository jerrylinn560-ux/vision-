'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

type AuthMode = 'sign-in' | 'sign-up'

function authErrorMessage(message: string, code?: string) {
  if (code === 'over_email_send_rate_limit') return 'Too many email requests. Wait a little before trying again.'
  if (code === 'email_address_invalid') return 'Enter a valid email address.'
  if (code === 'weak_password') return 'Choose a stronger password with at least 8 characters.'
  if (code === 'user_already_exists' || /already registered|already exists/i.test(message)) {
    return 'If an account can use this email, confirmation instructions will arrive. Try signing in if you already have an account.'
  }
  if (/email not confirmed/i.test(message)) return 'Confirm your email from the link we sent before signing in.'
  if (/invalid login credentials/i.test(message)) return 'Invalid email or password.'
  return 'We could not complete sign-in. Check your details and try again.'
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const supabase = createClient()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    setNotice('')

    try {
      if (mode === 'sign-in') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          setError(authErrorMessage(signInError.message, signInError.code))
          return
        }
        window.location.assign('/')
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
          data: { display_name: displayName.trim() },
        },
      })

      if (signUpError) {
        setError(authErrorMessage(signUpError.message, signUpError.code))
        return
      }

      if (data.session) {
        window.location.assign('/')
        return
      }

      setNotice('Check your inbox for the confirmation link. VISION will be ready after you verify your email.')
    } catch {
      setError('The secure sign-in service is temporarily unavailable. Please try again.')
    } finally {
      setPending(false)
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
  }

  return (
    <main className="auth-page vision-grid">
      <section className="auth-layout">
        <div className="auth-story">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">V</span>
            <span className="brand-name">V.I.S.I.O.N.</span>
          </div>
          <p className="eyebrow">VIRTUAL INTELLIGENCE SYSTEM</p>
          <h1>Your ideas,<br /><span>in motion.</span></h1>
          <p className="muted-copy">A private, voice-first workspace for clearer thinking, thoughtful planning, and the small things worth remembering.</p>
          <div className="auth-proof-row">
            <span><LockKeyhole aria-hidden="true" size={15} /> Private by default</span>
            <span><Radio aria-hidden="true" size={15} /> Ready when you are</span>
          </div>
          <div className="auth-orb-wrap" aria-hidden="true">
            <div className="vision-orb auth-orb" data-state="idle"><span>V</span></div>
            <div className="orb-caption">YOUR PERSONAL INTELLIGENCE</div>
          </div>
        </div>

        <div className="auth-card glass-panel">
          <div className="auth-card-heading">
            <span className="eyebrow">WELCOME TO VISION</span>
            <h2>{mode === 'sign-in' ? 'Sign in to your workspace' : 'Create your workspace'}</h2>
            <p className="muted-copy">{mode === 'sign-in' ? 'Pick up where your mind left off.' : 'Your conversations and notes stay yours.'}</p>
          </div>

          <div className="auth-tabs" role="group" aria-label="Account action">
            <button type="button" className={mode === 'sign-in' ? 'auth-tab active' : 'auth-tab'} onClick={() => changeMode('sign-in')}>Sign in</button>
            <button type="button" className={mode === 'sign-up' ? 'auth-tab active' : 'auth-tab'} onClick={() => changeMode('sign-up')}>Create account</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <FieldGroup>
              {mode === 'sign-up' && (
                <Field>
                  <FieldLabel htmlFor="display-name">Your name</FieldLabel>
                  <Input id="display-name" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <div className="password-field">
                  <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
                  <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>
                    {showPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
                  </button>
                </div>
                <FieldDescription>{mode === 'sign-in' ? 'Your session is protected by Supabase Auth.' : 'Use at least 8 characters.'}</FieldDescription>
              </Field>
            </FieldGroup>
            {error && <p className="form-feedback error-feedback" role="alert">{error}</p>}
            {notice && <p className="form-feedback success-feedback" role="status">{notice}</p>}
            <Button type="submit" size="lg" className="auth-submit" disabled={pending}>
              {pending ? 'Securing your session…' : mode === 'sign-in' ? 'Continue securely' : 'Create account'}
              {!pending && <ArrowRight aria-hidden="true" data-icon="inline-end" />}
            </Button>
          </form>
          <p className="auth-legal">By continuing, you agree to keep your account credentials private.</p>
        </div>
      </section>
    </main>
  )
}
