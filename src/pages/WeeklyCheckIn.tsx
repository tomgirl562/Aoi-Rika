import { useMemo } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useAccounts, useCategories, useReimbursements, useSettings, useTransactions } from '../hooks/useData'
import { computeAllowancePacing } from '../lib/calc/allowance'
import { accountBalance } from '../lib/calc/balances'
import { outstandingTotals } from '../lib/calc/reimbursements'
import {
  buildCategoryNudges,
  computeSafeToSpend,
  resolveSafetyNet,
  trailingAverageMonthlyExpense,
  weeklyTotals,
} from '../lib/calc/weekly'
import { currentWeekRange } from '../lib/dates'
import { formatMoney } from '../lib/money'

export function WeeklyCheckIn() {
  const accounts = useAccounts()
  const transactions = useTransactions()
  const categories = useCategories()
  const reimbursements = useReimbursements()
  const settings = useSettings()

  const now = new Date()
  const weekStartDay = settings?.week_start_day ?? 1

  const { totals, nudges, safeToSpend, spendingAccount, week, allowancePacing } = useMemo(() => {
    const week = currentWeekRange(now, weekStartDay)
    const totals = weeklyTotals(transactions, week)
    const nudges = buildCategoryNudges(transactions, categories, now, weekStartDay)
    const spendingAccount = accounts.find((a) => a.kind === 'spending')
    const trailingMonthly = trailingAverageMonthlyExpense(transactions, now, weekStartDay)
    const safetyNet = resolveSafetyNet(
      settings?.safety_net_override_amount ?? null,
      settings?.safety_net_auto_months ?? 1,
      trailingMonthly,
    )
    const iOwe = outstandingTotals(reimbursements).iOwe
    const balance = spendingAccount ? accountBalance(spendingAccount, transactions) : 0
    const safeToSpend = computeSafeToSpend(balance, safetyNet, iOwe)
    const allowancePacing = computeAllowancePacing(
      settings?.allowance_amount ?? null,
      settings?.allowance_period ?? 'weekly',
      now,
      weekStartDay,
      safeToSpend.safeToSpend,
    )
    return { totals, nudges, safeToSpend, spendingAccount, week, allowancePacing }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories, accounts, settings, reimbursements])

  const owedToMe = outstandingTotals(reimbursements).owedToMe

  return (
    <div>
      <PageHeader
        title="This week"
        subtitle={`${week.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(week.end.getTime() - 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
      />

      <div className="card" style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <div className="stat-label">Safe to spend, rest of the week</div>
        <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0.25rem 0', color: 'var(--accent)' }}>
          {spendingAccount ? formatMoney(safeToSpend.safeToSpend) : '—'}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {spendingAccount
            ? `${formatMoney(safeToSpend.spendingAccountBalance)} in ${spendingAccount.name}, minus your ${formatMoney(safeToSpend.safetyNet)} safety net${safeToSpend.outstandingIOwe > 0 ? ` and ${formatMoney(safeToSpend.outstandingIOwe)} you still owe` : ''}.`
            : 'Add a spending account in Settings to see this.'}
        </div>
        {owedToMe > 0 && (
          <div className="pill" style={{ marginTop: '0.5rem' }}>
            +{formatMoney(owedToMe)} owed to you, not counted yet
          </div>
        )}
      </div>

      {allowancePacing && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="stat-label">Today's budget</div>
            <span className={`pill ${allowancePacing.sustainable ? 'pill-good' : 'pill-watch'}`}>
              {allowancePacing.sustainable ? 'On plan' : 'Heads up'}
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.25rem 0' }}>
            {formatMoney(allowancePacing.dailyBudget)}
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>
              {' '}
              / day ({settings?.allowance_period})
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {allowancePacing.sustainable
              ? `That plan fits your ${formatMoney(allowancePacing.safeToSpend)} safe-to-spend for the ${allowancePacing.daysLeftInPeriod} day${allowancePacing.daysLeftInPeriod === 1 ? '' : 's'} left.`
              : `At this rate you'd need ${formatMoney(allowancePacing.neededForRestOfPeriod)} for the ${allowancePacing.daysLeftInPeriod} day${allowancePacing.daysLeftInPeriod === 1 ? '' : 's'} left, but you only have ${formatMoney(allowancePacing.safeToSpend)} safe to spend right now.`}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <div className="stat-tile" style={{ flex: 1 }}>
          <div className="stat-label">In</div>
          <div className="stat-value" style={{ color: 'var(--series-1)' }}>
            {formatMoney(totals.totalIn)}
          </div>
        </div>
        <div className="stat-tile" style={{ flex: 1 }}>
          <div className="stat-label">Out</div>
          <div className="stat-value" style={{ color: 'var(--series-2)' }}>
            {formatMoney(totals.totalOut)}
          </div>
        </div>
        <div className="stat-tile" style={{ flex: 1 }}>
          <div className="stat-label">Net</div>
          <div className="stat-value">{formatMoney(totals.net)}</div>
        </div>
      </div>

      <h2 style={{ fontSize: '1rem' }}>How you're pacing</h2>
      {nudges.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Not enough history yet - keep logging and nudges will show up here.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {nudges.map((n) => (
          <div key={n.categoryId} className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className={`pill pill-${n.severity === 'ok' ? 'good' : n.severity}`}>
              {n.severity === 'ok' ? 'On track' : n.severity === 'watch' ? 'Watch' : 'Over'}
            </span>
            <span style={{ fontSize: '0.85rem' }}>{n.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
