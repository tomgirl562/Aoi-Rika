import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useAccounts, useCategories, useGoals, useMerchants, useTransactions } from '../hooks/useData'
import { useAuth } from '../lib/auth'
import { createRecord, softDeleteRecord } from '../lib/mutate'
import { formatMoney, pesosToCentavos } from '../lib/money'
import type { GoalContribution, Merchant, Transaction, TransactionType } from '../lib/types'

interface GoalAllocation {
  goalId: string
  amountPesos: string
}

const MERCHANT_TYPE_SUGGESTIONS = ['Restaurant', 'Grocery', 'Online Shop', 'Subscription', 'Grab Food', 'Other']

export function TransactionsPage() {
  const { userId } = useAuth()
  const accounts = useAccounts()
  const categories = useCategories().filter((c) => !c.archived_at)
  const goals = useGoals().filter((g) => g.status === 'active')
  const merchants = useMerchants()
  const transactions = useTransactions()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [merchantType, setMerchantType] = useState('')
  const [note, setNote] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [allocations, setAllocations] = useState<GoalAllocation[]>([])
  const [error, setError] = useState<string | null>(null)

  const trimmedMerchantName = merchantName.trim()
  const existingMerchant = merchants.find((m) => m.name.trim().toLowerCase() === trimmedMerchantName.toLowerCase())
  const isNewMerchant = trimmedMerchantName !== '' && !existingMerchant

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 40),
    [transactions],
  )

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—'
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—'
  const merchantLabel = (id: string | null) => merchants.find((m) => m.id === id)?.name ?? null

  const toAccountIsSavings = accounts.find((a) => a.id === toAccountId)?.kind === 'savings'
  const goalsForToAccount = goals.filter((g) => g.account_id === toAccountId)

  function resetForm() {
    setAmount('')
    setNote('')
    setCategoryId('')
    setMerchantName('')
    setMerchantType('')
    setAllocations([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (type !== 'income' && !fromAccountId) {
      setError('Choose which account this came from.')
      return
    }
    if (type !== 'expense' && !toAccountId) {
      setError('Choose which account this went to.')
      return
    }
    if (type === 'transfer' && fromAccountId === toAccountId) {
      setError('Transfer needs two different accounts.')
      return
    }
    if (type === 'expense' && !categoryId) {
      setError('Pick a category.')
      return
    }

    const amountCentavos = pesosToCentavos(amountNum)

    if (allocations.length > 0) {
      const allocatedTotal = allocations.reduce((s, a) => s + (Number(a.amountPesos) || 0), 0)
      if (pesosToCentavos(allocatedTotal) > amountCentavos) {
        setError("Goal allocations can't add up to more than the transfer amount.")
        return
      }
    }

    let merchantId: string | null = null
    if (type === 'expense' && trimmedMerchantName) {
      merchantId = existingMerchant
        ? existingMerchant.id
        : await createRecord<Merchant>('merchants', userId!, {
            name: trimmedMerchantName,
            type: merchantType || 'Other',
            archived_at: null,
          })
    }

    const txId = await createRecord<Transaction>('transactions', userId!, {
      type,
      amount: amountCentavos,
      occurred_at: new Date(occurredAt).toISOString(),
      from_account_id: type === 'income' ? null : fromAccountId,
      to_account_id: type === 'expense' ? null : toAccountId,
      category_id: type === 'expense' ? categoryId : null,
      merchant_id: merchantId,
      note: note.trim() || null,
      is_reimbursement: false,
      reimbursement_id: null,
    })

    for (const allocation of allocations) {
      const pesos = Number(allocation.amountPesos)
      if (!allocation.goalId || !pesos || pesos <= 0) continue
      await createRecord<GoalContribution>('goal_contributions', userId!, {
        goal_id: allocation.goalId,
        transaction_id: txId,
        amount: pesosToCentavos(pesos),
      })
    }

    resetForm()
  }

  return (
    <div>
      <PageHeader title="Add money movement" subtitle="Log income, spending, or a transfer between your own accounts." />

      <form className="card" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`btn ${type === t ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setType(t)}
            >
              {t === 'expense' ? 'Expense' : t === 'income' ? 'Income' : 'Transfer'}
            </button>
          ))}
        </div>

        <div>
          <label className="label">Amount (₱)</label>
          <input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        {type !== 'income' && (
          <div>
            <label className="label">From account</label>
            <select className="input" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {type !== 'expense' && (
          <div>
            <label className="label">To account</label>
            <select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {type === 'expense' && (
          <div>
            <label className="label">Category</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {type === 'expense' && (
          <div>
            <label className="label">Where? (optional)</label>
            <input
              className="input"
              list="merchant-options"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="e.g. Jollibee, Landmark Grocery"
            />
            <datalist id="merchant-options">
              {merchants.map((m) => (
                <option key={m.id} value={m.name} />
              ))}
            </datalist>
            {existingMerchant && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>
                Tagged as <span className="pill">{existingMerchant.type}</span>
              </p>
            )}
            {isNewMerchant && (
              <div style={{ marginTop: '0.5rem' }}>
                <label className="label">What kind of place is this?</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {MERCHANT_TYPE_SUGGESTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`btn ${merchantType === t ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setMerchantType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {type === 'transfer' && toAccountIsSavings && goalsForToAccount.length > 0 && (
          <div>
            <label className="label">Put toward a goal (optional, can split)</label>
            {allocations.map((allocation, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <select
                  className="input"
                  value={allocation.goalId}
                  onChange={(e) =>
                    setAllocations(allocations.map((a, idx) => (idx === i ? { ...a, goalId: e.target.value } : a)))
                  }
                >
                  <option value="">Goal…</option>
                  {goalsForToAccount.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  placeholder="₱"
                  value={allocation.amountPesos}
                  onChange={(e) =>
                    setAllocations(allocations.map((a, idx) => (idx === i ? { ...a, amountPesos: e.target.value } : a)))
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAllocations([...allocations, { goalId: '', amountPesos: amount }])}
            >
              + Split toward a goal
            </button>
          </div>
        )}

        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div>
          <label className="label">When</label>
          <input
            className="input"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>{error}</p>}

        <button className="btn btn-primary btn-block" type="submit">
          Save
        </button>
      </form>

      <h2 style={{ fontSize: '1rem' }}>Recent</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sortedTransactions.map((tx) => (
          <div key={tx.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {tx.type === 'expense' && `${accountName(tx.from_account_id)} → ${categoryName(tx.category_id)}`}
                {tx.type === 'income' && `${accountName(tx.to_account_id)} ← income`}
                {tx.type === 'transfer' && `${accountName(tx.from_account_id)} → ${accountName(tx.to_account_id)}`}
                {merchantLabel(tx.merchant_id) && (
                  <span className="pill" style={{ marginLeft: '0.4rem' }}>
                    {merchantLabel(tx.merchant_id)}
                  </span>
                )}
                {tx.is_reimbursement && <span className="pill" style={{ marginLeft: '0.4rem' }}>reimbursement</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {new Date(tx.occurred_at).toLocaleString()} {tx.note ? `· ${tx.note}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, color: tx.type === 'income' ? 'var(--good)' : undefined }}>
                {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                {formatMoney(tx.amount)}
              </span>
              <button className="btn btn-secondary" onClick={() => softDeleteRecord('transactions', tx.id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
        {sortedTransactions.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No transactions yet.</p>}
      </div>
    </div>
  )
}
