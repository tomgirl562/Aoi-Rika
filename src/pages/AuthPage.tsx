import { useState } from 'react'
import { useAuth } from '../lib/auth'

export function AuthPage() {
  const { signInWithPassword, signUpWithPassword } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const fn = mode === 'signin' ? signInWithPassword : signUpWithPassword
    const err = await fn(email, password)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <div className="app-shell" style={{ justifyContent: 'center', padding: '1.5rem' }}>
      <div className="card" style={{ maxWidth: 360, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '1.4rem', marginTop: 0 }}>Aoi-Rika</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {mode === 'signin' ? 'Welcome back.' : 'Create an account to sync across your devices.'}
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>
        <button
          className="btn btn-secondary btn-block"
          style={{ marginTop: '0.75rem' }}
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
