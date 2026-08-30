import { useMemo } from 'react'
import { BarChart, type BarChartItem } from '../components/BarChart'
import { PageHeader } from '../components/PageHeader'
import { useAccounts, useTransactions } from '../hooks/useData'
import { allAccountBalances } from '../lib/calc/balances'
import { formatMoney } from '../lib/money'

const SERIES_VARS = [
  '--series-1',
  '--series-2',
  '--series-3',
  '--series-4',
  '--series-5',
  '--series-6',
  '--series-7',
  '--series-8',
]

export function BalancesPage() {
  const accounts = useAccounts().filter((a) => !a.archived_at)
  const transactions = useTransactions()

  const balances = allAccountBalances(accounts, transactions)
  const total = accounts.reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0)

  const byAccount: BarChartItem[] = useMemo(() => {
    const sorted = [...accounts].sort((a, b) => (balances.get(b.id) ?? 0) - (balances.get(a.id) ?? 0))
    return sorted.map((a, i) => ({
      label: a.name,
      value: balances.get(a.id) ?? 0,
      color: `var(${SERIES_VARS[i % SERIES_VARS.length]})`,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, transactions])

  const byInstitution: BarChartItem[] = useMemo(() => {
    const totals = new Map<string, number>()
    for (const a of accounts) {
      const key = a.institution?.trim() || 'Unassigned'
      totals.set(key, (totals.get(key) ?? 0) + (balances.get(a.id) ?? 0))
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
    return sorted.map(([label, value], i) => ({
      label,
      value,
      color: `var(${SERIES_VARS[i % SERIES_VARS.length]})`,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, transactions])

  return (
    <div>
      <PageHeader title="Balances" subtitle="Every account you hold money in, and what it adds up to." />

      <div className="card" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <div className="stat-label">Total money you currently hold</div>
        <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--accent)' }}>
          {formatMoney(total)}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Across {accounts.length} account{accounts.length === 1 ? '' : 's'}
        </div>
      </div>

      <section className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>By account</h2>
        {byAccount.length > 0 ? (
          <BarChart items={byAccount} formatValue={formatMoney} />
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No accounts yet.</p>
        )}
      </section>

      {byInstitution.length > 1 && (
        <section className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>By institution</h2>
          <BarChart items={byInstitution} formatValue={formatMoney} />
        </section>
      )}

      <h2 style={{ fontSize: '1rem' }}>All accounts</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {accounts.map((a) => (
          <div key={a.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{a.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                {a.institution && <span className="pill" style={{ marginRight: '0.35rem' }}>{a.institution}</span>}
                <span className="pill">{a.kind}</span>
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{formatMoney(balances.get(a.id) ?? 0)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
