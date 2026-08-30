import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useAccounts, useGoalContributions, useGoals, useReimbursements, useSettings, useTransactions } from '../hooks/useData'
import { useAuth } from '../lib/auth'
import { accountBalance } from '../lib/calc/balances'
import { flagGoalsAgainstSafetyNet, projectGoal } from '../lib/calc/goals'
import { outstandingTotals } from '../lib/calc/reimbursements'
import { computeSafeToSpend, resolveSafetyNet, trailingAverageMonthlyExpense } from '../lib/calc/weekly'
import { createRecord } from '../lib/mutate'
import { formatMoney, pesosToCentavos } from '../lib/money'
import type { GoalContribution, SavingsGoal, Transaction } from '../lib/types'

export function GoalsPage() {
  const { userId } = useAuth()
  const accounts = useAccounts()
  const transactions = useTransactions()
  const reimbursements = useReimbursements()
  const goals = useGoals()
  const contributions = useGoalContributions()
  const settings = useSettings()

  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [accountId, setAccountId] = useState('')

  const [contributeFor, setContributeFor] = useState<string | null>(null)
  const [contributeAmount, setContributeAmount] = useState('')
  const [contributeFrom, setContributeFrom] = useState('')

  const now = new Date()
  const weekStartDay = settings?.week_start_day ?? 1
  const savingsAccounts = accounts.filter((a) => a.kind === 'savings')
  const spendingAccount = accounts.find((a) => a.kind === 'spending')
  const activeGoals = useMemo(
    () =>
      goals
        .filter((g) => g.status === 'active')
        .sort((a, b) => (a.target_date ?? '9999').localeCompare(b.target_date ?? '9999')),
    [goals],
  )

  const safeToSpend = useMemo(() => {
    if (!spendingAccount) return 0
    const balance = accountBalance(spendingAccount, transactions)
    const trailingMonthly = trailingAverageMonthlyExpense(transactions, now, weekStartDay)
    const safetyNet = resolveSafetyNet(
      settings?.safety_net_override_amount ?? null,
      settings?.safety_net_auto_months ?? 1,
      trailingMonthly,
    )
    const iOwe = outstandingTotals(reimbursements).iOwe
    return computeSafeToSpend(balance, safetyNet, iOwe).safeToSpend
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spendingAccount, transactions, settings, reimbursements])

  const projections = activeGoals.map((goal) => ({
    goal,
    projection: projectGoal(goal, contributions, now, weekStartDay),
  }))
  const safetyFlags = flagGoalsAgainstSafetyNet(projections, safeToSpend)

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = Number(targetAmount)
    if (!name.trim() || !amountNum || amountNum <= 0 || !accountId) return
    await createRecord<SavingsGoal>('savings_goals', userId!, {
      name: name.trim(),
      account_id: accountId,
      target_amount: pesosToCentavos(amountNum),
      target_date: targetDate || null,
      status: 'active',
    })
    setName('')
    setTargetAmount('')
    setTargetDate('')
    setAccountId('')
  }

  async function handleContribute(goal: SavingsGoal) {
    const pesos = Number(contributeAmount)
    if (!pesos || pesos <= 0 || !contributeFrom) return
    const centavos = pesosToCentavos(pesos)
    const txId = await createRecord<Transaction>('transactions', userId!, {
      type: 'transfer',
      amount: centavos,
      occurred_at: new Date().toISOString(),
      from_account_id: contributeFrom,
      to_account_id: goal.account_id,
      category_id: null,
      note: `Toward ${goal.name}`,
      is_reimbursement: false,
      reimbursement_id: null,
    })
    await createRecord<GoalContribution>('goal_contributions', userId!, {
      goal_id: goal.id,
      transaction_id: txId,
      amount: centavos,
    })
    setContributeFor(null)
    setContributeAmount('')
    setContributeFrom('')
  }

  return (
    <div>
      <PageHeader title="Savings goals" subtitle="Run as many as you like - each tracked on its own." />

      <form className="card" onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', margin: 0 }}>New goal</h2>
        <input className="input" placeholder="e.g. Mom's birthday" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <input
            className="input"
            type="number"
            placeholder="Target ₱"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
          />
          <input className="input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
        <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Which account holds this?</option>
          {(savingsAccounts.length > 0 ? savingsAccounts : accounts).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary btn-block" type="submit">
          Create goal
        </button>
      </form>

      {projections.map(({ goal, projection }) => {
        const compromised = safetyFlags.get(goal.id)
        const isContributing = contributeFor === goal.id
        return (
          <div key={goal.id} className="card" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>{goal.name}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {formatMoney(projection.progress)} / {formatMoney(goal.target_amount)}
              </div>
            </div>
            <div className="progress-track" style={{ margin: '0.5rem 0' }}>
              <div className="progress-fill" style={{ width: `${Math.round(projection.percentComplete * 100)}%` }} />
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {projection.remaining <= 0
                ? 'Goal reached! 🎉'
                : projection.projectedCompletionDate
                  ? `At your current pace, projected around ${projection.projectedCompletionDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}.`
                  : 'Add a contribution to see a projected completion date.'}
              {goal.target_date && projection.remaining > 0 && (
                <>
                  {' '}
                  {projection.onPaceForTargetDate
                    ? `On pace for your ${new Date(goal.target_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} target.`
                    : `Behind your ${new Date(goal.target_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} target at this pace.`}
                </>
              )}
            </div>
            {compromised && (
              <div className="pill pill-watch" style={{ marginTop: '0.5rem' }}>
                Keeping pace here would dip into your safety net
              </div>
            )}

            {!isContributing && (
              <button
                className="btn btn-secondary btn-block"
                style={{ marginTop: '0.6rem' }}
                onClick={() => {
                  setContributeFor(goal.id)
                  setContributeAmount('')
                  setContributeFrom('')
                }}
              >
                Add money
              </button>
            )}
            {isContributing && (
              <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <input
                  className="input"
                  type="number"
                  placeholder="₱"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                />
                <select className="input" value={contributeFrom} onChange={(e) => setContributeFrom(e.target.value)}>
                  <option value="">From which account?</option>
                  {accounts
                    .filter((a) => a.id !== goal.account_id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleContribute(goal)}>
                    Confirm
                  </button>
                  <button className="btn btn-secondary" onClick={() => setContributeFor(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {activeGoals.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No goals yet - add one above.</p>}
    </div>
  )
}
