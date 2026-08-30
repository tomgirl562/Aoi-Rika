import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { BottomNav } from './components/BottomNav'
import { AuthPage } from './pages/AuthPage'
import { BalancesPage } from './pages/BalancesPage'
import { Dashboard } from './pages/Dashboard'
import { WeeklyCheckIn } from './pages/WeeklyCheckIn'
import { TransactionsPage } from './pages/TransactionsPage'
import { ReimbursementsPage } from './pages/ReimbursementsPage'
import { GoalsPage } from './pages/GoalsPage'
import { PlacesPage } from './pages/PlacesPage'
import { SettingsPage } from './pages/SettingsPage'

function Shell() {
  const { userId, loading, isLocalOnly } = useAuth()

  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    )
  }

  if (!userId && !isLocalOnly) {
    return <AuthPage />
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/balances" element={<BalancesPage />} />
          <Route path="/weekly" element={<WeeklyCheckIn />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/reimbursements" element={<ReimbursementsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/places" element={<PlacesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AuthProvider>
  )
}
