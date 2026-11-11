import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AuthErrorPage() {
  return (
    <main className="auth-page vision-grid">
      <section className="auth-card glass-panel">
        <div className="brand-mark" aria-hidden="true">V</div>
        <p className="eyebrow">SECURE SIGN-IN</p>
        <h1>That sign-in link could not be verified.</h1>
        <p className="muted-copy">It may have expired or already been used. Request a fresh link and try again.</p>
        <Button render={<Link href="/login" />}>Return to sign in</Button>
      </section>
    </main>
  )
}
