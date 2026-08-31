import { differenceInCalendarMonths, differenceInCalendarWeeks } from 'date-fns'
import { useMemo, useState } from 'react'
import { BarChart, type BarChartItem } from '../components/BarChart'
import { PageHeader } from '../components/PageHeader'
import { useAccounts, useReimbursements, useSettings, useTransactions } from '../hooks/useData'
import { allAccountBalances } from '../lib/calc/balances'
import { computeCreditCardStatus } from '../lib/calc/credit'
import { outstandingTotals } from '../lib/calc/reimbursements'
import { trailingAverageWeeklyNet } from '../lib/calc/weekly'
import { formatMoney, pesosToCentavos } from '../lib/money'

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

const MILESTONES = [
  { label: '1 month', weeks: 4 },
  { label: '3 months', weeks: 13 },
  { label: '1 year', weeks: 52 },
]

export function BalancesPage() {
  const allAccounts = useAccounts().filter((a) => !a.archived_at)
  const accounts = allAccounts.filter((a) => a.kind !== 'credit')
  const creditCards = allAccounts.filter((a) => a.kind === 'credit')
  const transactions = useTransactions()
  const reimbursements = useReimbursements()
  const settings = useSettings()

  const [whatIfAmount, setWhatIfAmount] = useState('')
  const [whatIfPeriod, setWhatIfPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [whatIfDate, setWhatIfDate] = useState('')

  const now = new Date()
  const weekStartDay = settings?.week_start_day ?? 1

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

  const byKind: BarChartItem[] = useMemo(() => {
    const totals = new Map<string, number>()
    for (const a of accounts) {
      totals.set(a.kind, (totals.get(a.kind) ?? 0) + (balances.get(a.id) ?? 0))
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
    return sorted.map(([label, value], i) => ({
      label,
      value,
      color: `var(${SERIES_VARS[i % SERIES_VARS.length]})`,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, transactions])

  const reimbTotals = outstandingTotals(reimbursements)
  const projectedTotal = total + reimbTotals.owedToMe - reimbTotals.iOwe

  const weeklyNetRate = useMemo(
    () => trailingAverageWeeklyNet(transactions, now, weekStartDay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, weekStartDay],
  )

  const whatIfTargetDate = whatIfDate ? new Date(`${whatIfDate}T00:00:00`) : null
  const whatIfPeriodsUntil = whatIfTargetDate
    ? Math.max(
        0,
        whatIfPeriod === 'weekly'
          ? differenceInCalendarWeeks(whatIfTargetDate, now)
          : differenceInCalendarMonths(whatIfTargetDate, now),
      )
    : 0
  const whatIfProjected = total + pesosToCentavos(Number(whatIfAmount) || 0) * whatIfPeriodsUntil

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

      {(reimbTotals.owedToMe > 0 || reimbTotals.iOwe > 0) && (
        <section className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>If everything settled today</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', fontSize: '0.85rem' }}>
            <span>Current total</span>
            <span>{formatMoney(total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', fontSize: '0.85rem' }}>
            <span>+ Owed to you</span>
            <span style={{ color: 'var(--good)' }}>{formatMoney(reimbTotals.owedToMe)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', fontSize: '0.85rem' }}>
            <span>− You owe</span>
            <span style={{ color: 'var(--over)' }}>{formatMoney(reimbTotals.iOwe)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.4rem 0 0',
              marginTop: '0.3rem',
              borderTop: '1px solid var(--border)',
              fontWeight: 700,
            }}
          >
            <span>Projected total</span>
            <span>{formatMoney(projectedTotal)}</span>
          </div>
        </section>
      )}

      {creditCards.length > 0 && (
        <section className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>Credit cards</h2>
          {creditCards.map((card) => {
            const status = computeCreditCardStatus(card, transactions, now)
            return (
              <div key={card.id} style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>
                    {card.institution && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{card.institution} · </span>}
                    {card.name}
                  </span>
                  <span style={{ fontWeight: 700 }}>{formatMoney(status.owed)} owed</span>
                </div>
                {card.credit_limit != null && (
                  <>
                    <div className="progress-track" style={{ margin: '0.4rem 0' }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(100, Math.round((status.owed / card.credit_limit) * 100))}%`,
                          background: status.owed > card.credit_limit ? 'var(--over)' : 'var(--accent)',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {formatMoney(status.available)} available of {formatMoney(card.credit_limit)} limit
                    </div>
                  </>
                )}
                {status.daysUntilDue != null && (
                  <div style={{ fontSize: '0.78rem', color: status.daysUntilDue <= 3 ? 'var(--over)' : 'var(--text-muted)' }}>
                    {status.daysUntilDue <= 0
                      ? `Due today (${status.nextDueDate!.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`
                      : `Due in ${status.daysUntilDue} day${status.daysUntilDue === 1 ? '' : 's'} (${status.nextDueDate!.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}

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

      {byKind.length > 1 && (
        <section className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>By type</h2>
          <BarChart items={byKind} formatValue={formatMoney} />
        </section>
      )}

      <section className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>Savings projection</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 0 }}>
          At your actual pace lately ({formatMoney(weeklyNetRate)}/week net), here's where your total could be:
        </p>
        {MILESTONES.map((m) => (
          <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', fontSize: '0.85rem' }}>
            <span>In {m.label}</span>
            <span style={{ fontWeight: 600 }}>{formatMoney(total + weeklyNetRate * m.weeks)}</span>
          </div>
        ))}

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1rem', marginBottom: '0.4rem' }}>
          Or play with your own numbers:
        </p>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
          <input
            className="input"
            type="number"
            placeholder="₱ amount"
            value={whatIfAmount}
            onChange={(e) => setWhatIfAmount(e.target.value)}
          />
          <select className="input" value={whatIfPeriod} onChange={(e) => setWhatIfPeriod(e.target.value as 'weekly' | 'monthly')}>
            <option value="weekly">per week</option>
            <option value="monthly">per month</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem' }}>by</span>
          <input className="input" type="date" value={whatIfDate} onChange={(e) => setWhatIfDate(e.target.value)} />
        </div>
        {whatIfAmount && whatIfTargetDate && (
          <p style={{ fontSize: '0.9rem', marginTop: '0.6rem', marginBottom: 0 }}>
            By{' '}
            {whatIfTargetDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}, you'd
            have <strong>{formatMoney(whatIfProjected)}</strong>
            <span style={{ color: 'var(--text-muted)' }}>
              {' '}
              ({whatIfPeriodsUntil} {whatIfPeriod === 'weekly' ? 'week' : 'month'}
              {whatIfPeriodsUntil === 1 ? '' : 's'} of {formatMoney(pesosToCentavos(Number(whatIfAmount) || 0))}/
              {whatIfPeriod === 'weekly' ? 'week' : 'month'})
            </span>
            .
          </p>
        )}
      </section>

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
