import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { LOCAL_USER_KEY } from './localMigration'
import { seedDefaultsIfNeeded } from './seed'
import { initSync } from './sync'

function getOrCreateLocalUserId(): string {
  let id = localStorage.getItem(LOCAL_USER_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(LOCAL_USER_KEY, id)
  }
  return id
}

interface AuthState {
  userId: string | null
  loading: boolean
  isLocalOnly: boolean
  signInWithPassword: (email: string, password: string) => Promise<string | null>
  signUpWithPassword: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const isLocalOnly = supabase === null

  useEffect(() => {
    let active = true

    async function init() {
      if (!supabase) {
        const id = getOrCreateLocalUserId()
        if (active) {
          setUserId(id)
          setLoading(false)
        }
        await seedDefaultsIfNeeded(id)
        return
      }

      const { data } = await supabase.auth.getSession()
      const id = data.session?.user.id ?? null
      if (active) {
        setUserId(id)
        setLoading(false)
      }
      if (id) {
        await seedDefaultsIfNeeded(id)
        initSync()
      }
    }
    void init()

    if (supabase) {
      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const id = session?.user.id ?? null
        setUserId(id)
        if (id) {
          await seedDefaultsIfNeeded(id)
          initSync()
        }
      })
      return () => {
        active = false
        sub.subscription.unsubscribe()
      }
    }
    return () => {
      active = false
    }
  }, [])

  async function signInWithPassword(email: string, password: string) {
    if (!supabase) return 'Sync is not configured, so there is no sign-in - the app is running in local-only mode.'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }

  async function signUpWithPassword(email: string, password: string) {
    if (!supabase) return 'Sync is not configured, so there is no sign-up - the app is running in local-only mode.'
    const { error } = await supabase.auth.signUp({ email, password })
    return error?.message ?? null
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ userId, loading, isLocalOnly, signInWithPassword, signUpWithPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
