import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, type BarChartItem } from '../components/BarChart'
import { PageHeader } from '../components/PageHeader'
import {
  useAccounts,
  useCategories,
  useGoalContributions,
  useGoals,
  useMerchants,
  useReimbursements,
  useSettings,
  useTransactions,
} from '../hooks/useData'
import { allAccountBalances } from '../lib/calc/balances'
import { computeCreditCardStatus } from '../lib/calc/credit'
import { projectGoal } from '../lib/calc/goals'
import { computeMerchantStats } from '../lib/calc/merchants'
import { outstandingTotals } from '../lib/calc/reimbursements'
import { categorySpendInRange, weeklyTotals } from '../lib/calc/weekly'
import { currentMonthRange, currentWeekRange, isWithin } from '../lib/dates'
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

export function Dashboard() {
  const accounts = useAccounts()
  const categories = useCategories()
  const merchants = useMerchants()
  const transactions = useTransactions()
  const reimbursements = useReimbursements()
  const goals = useGoals()
  const contributions = useGoalContributions()
  const settings = useSettings()

  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')

  const now = new Date()
  const weekStartDay = settings?.week_start_day ?? 1
  const range = period === 'weekly' ? currentWeekRange(now, weekStartDay) : currentMonthRange(now)

  const totals = useMemo(() => weeklyTotals(transactions, range), [transactions, range])

  const categorySeries: BarChartItem[] = useMemo(() => {
    const sorted = [...categories].filter((c) => !c.archived_at).sort((a, b) => a.created_at.localeCompare(b.created_at))
    return sorted
      .map((c, i) => ({
        label: c.name,
        value: categorySpendInRange(transactions, c.id, range),
        color: `var(${SERIES_VARS[i % SERIES_VARS.length]})`,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [categories, transactions, range])

  const activeAccounts = accounts.filter((a) => !a.archived_at && a.kind !== 'credit')
  const creditCards = accounts.filter((a) => !a.archived_at && a.kind === 'credit')
  const balances = allAccountBalances(activeAccounts, transactions)
  const totalBalance = activeAccounts.reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0)
  const sortedAccounts = [...activeAccounts].sort((a, b) => (balances.get(b.id) ?? 0) - (balances.get(a.id) ?? 0))
  const reimbTotals = outstandingTotals(reimbursements)
  const activeGoals = goals.filter((g) => g.status === 'active')

  const topPlaces = useMemo(() => {
    const inRange = transactions.filter((tx) => isWithin(new Date(tx.occurred_at), range))
    return computeMerchantStats(
      merchants.filter((m) => !m.archived_at),
      inRange,
    ).slice(0, 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchants, transactions, range])

  return (
    <div>
      <PageHeader title="Dashboard" />

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
        <button
          className={`btn ${period === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={() => setPeriod('weekly')}
        >
          This week
        </button>
        <button
          className={`btn ${period === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={() => setPeriod('monthly')}
        >
          This month
        </button>
      </div>

      <section className="card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
        <div className="stat-label">Total money you currently hold</div>
        <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--accent)' }}>
          {formatMoney(totalBalance)}
        </div>
        <div style={{ textAlign: 'left', marginTop: '0.5rem' }}>
          {sortedAccounts.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', fontSize: '0.85rem' }}>
              <span>
                {a.institution && <span style={{ color: 'var(--text-muted)' }}>{a.institution} · </span>}
                {a.name}
              </span>
              <span style={{ fontWeight: 600 }}>{formatMoney(balances.get(a.id) ?? 0)}</span>
            </div>
          ))}
        </div>
        <Link to="/balances" style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
          View full breakdown →
        </Link>
      </section>

      {creditCards.length > 0 && (
        <section className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>Credit cards</h2>
          {creditCards.map((card) => {
            const status = computeCreditCardStatus(card, transactions, now)
            return (
              <div key={card.id} style={{ marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>
                    {card.institution && <span style={{ color: 'var(--text-muted)' }}>{card.institution} · </span>}
                    {card.name}
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {formatMoney(status.owed)} owed
                    {card.credit_limit != null && ` · ${formatMoney(status.available)} available`}
                  </span>
                </div>
                {status.daysUntilDue != null && (
                  <div style={{ fontSize: '0.75rem', color: status.daysUntilDue <= 3 ? 'var(--over)' : 'var(--text-muted)' }}>
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
        <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>In vs out</h2>
        <BarChart
          items={[
            { label: 'In', value: totals.totalIn, color: 'var(--series-1)' },
            { label: 'Out', value: totals.totalOut, color: 'var(--series-2)' },
          ]}
          formatValue={formatMoney}
        />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
          Net {formatMoney(totals.net)}
        </p>
      </section>

      <section className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>Spend by category</h2>
        {categorySeries.length > 0 ? (
          <BarChart items={categorySeries} formatValue={formatMoney} />
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No spending logged for this period yet.</p>
        )}
      </section>

      <section className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>Top places</h2>
        {topPlaces.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            No establishments tagged for this period yet.
          </p>
        ) : (
          topPlaces.map(({ merchant, totalSpent, visitCount }) => (
            <div key={merchant.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
              <span>
                {merchant.name} <span className="pill">{merchant.type}</span>
              </span>
              <span style={{ fontWeight: 600 }}>
                {formatMoney(totalSpent)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {visitCount}x</span>
              </span>
            </div>
          ))
        )}
        <Link to="/places" style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
          View all places →
        </Link>
      </section>

      <section className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>Outstanding reimbursements</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
          <span>Owed to you</span>
          <span style={{ fontWeight: 600, color: 'var(--good)' }}>{formatMoney(reimbTotals.owedToMe)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
          <span>You owe</span>
          <span style={{ fontWeight: 600, color: 'var(--over)' }}>{formatMoney(reimbTotals.iOwe)}</span>
        </div>
        <Link to="/reimbursements" style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
          View details →
        </Link>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>Goal progress</h2>
        {activeGoals.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No goals yet.</p>}
        {activeGoals.map((g) => {
          const projection = projectGoal(g, contributions, now, weekStartDay)
          return (
            <div key={g.id} style={{ marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>{g.name}</span>
                <span>{Math.round(projection.percentComplete * 100)}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${Math.round(projection.percentComplete * 100)}%` }} />
              </div>
            </div>
          )
        })}
        <Link to="/goals" style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
          View goals →
        </Link>
      </section>
    </div>
  )
}
