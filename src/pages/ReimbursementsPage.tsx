import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useAccounts, useCategories, useReimbursements } from '../hooks/useData'
import { useAuth } from '../lib/auth'
import { outstandingTotals } from '../lib/calc/reimbursements'
import { createRecord, updateRecord } from '../lib/mutate'
import { formatMoney, pesosToCentavos } from '../lib/money'
import type { Reimbursement, ReimbursementDirection, Transaction } from '../lib/types'

type PendingAction = { id: string; kind: 'settle' | 'write_off' } | null

export function ReimbursementsPage() {
  const { userId } = useAuth()
  const accounts = useAccounts()
  const categories = useCategories().filter((c) => !c.archived_at)
  const reimbursements = useReimbursements()

  const [direction, setDirection] = useState<ReimbursementDirection>('owed_to_me')
  const [counterparty, setCounterparty] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionAccountId, setActionAccountId] = useState('')
  const [actionCategoryId, setActionCategoryId] = useState('')

  const outstanding = reimbursements.filter((r) => r.status === 'outstanding')
  const owedToMe = outstanding.filter((r) => r.direction === 'owed_to_me')
  const iOwe = outstanding.filter((r) => r.direction === 'i_owe')
  const totals = outstandingTotals(reimbursements)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amountNum = Number(amount)
    if (!counterparty.trim() || !amountNum || amountNum <= 0) {
      setError('Enter who this is with and an amount greater than zero.')
      return
    }
    const amountCentavos = pesosToCentavos(amountNum)

    let createdTransactionId: string | null = null
    if (direction === 'owed_to_me') {
      if (!accountId) {
        setError('Which account did you pay this from?')
        return
      }
      createdTransactionId = await createRecord<Transaction>('transactions', userId!, {
        type: 'expense',
        amount: amountCentavos,
        occurred_at: new Date().toISOString(),
        from_account_id: accountId,
        to_account_id: null,
        category_id: null,
        merchant_id: null,
        note: `Fronted for ${counterparty.trim()}`,
        is_reimbursement: true,
        reimbursement_id: null,
      })
    }

    const reimbursementId = await createRecord<Reimbursement>('reimbursements', userId!, {
      direction,
      counterparty_name: counterparty.trim(),
      amount: amountCentavos,
      description: description.trim() || null,
      status: 'outstanding',
      created_transaction_id: createdTransactionId,
      settlement_transaction_id: null,
      settled_at: null,
    })

    if (createdTransactionId) {
      await updateRecord<Transaction>('transactions', createdTransactionId, { reimbursement_id: reimbursementId })
    }

    setCounterparty('')
    setAmount('')
    setDescription('')
    setAccountId('')
  }

  function openSettle(r: Reimbursement) {
    setPendingAction({ id: r.id, kind: 'settle' })
    setActionAccountId('')
    setActionCategoryId('')
  }

  function openWriteOff(r: Reimbursement) {
    setPendingAction({ id: r.id, kind: 'write_off' })
    setActionAccountId('')
    setActionCategoryId('')
  }

  async function confirmSettle(r: Reimbursement) {
    if (!actionAccountId) return
    const isOwedToMe = r.direction === 'owed_to_me'
    const settlementTxId = await createRecord<Transaction>('transactions', userId!, {
      type: isOwedToMe ? 'income' : 'expense',
      amount: r.amount,
      occurred_at: new Date().toISOString(),
      from_account_id: isOwedToMe ? null : actionAccountId,
      to_account_id: isOwedToMe ? actionAccountId : null,
      category_id: null,
      merchant_id: null,
      note: isOwedToMe ? `${r.counterparty_name} paid you back` : `Paid ${r.counterparty_name} back`,
      is_reimbursement: true,
      reimbursement_id: r.id,
    })
    await updateRecord<Reimbursement>('reimbursements', r.id, {
      status: 'settled',
      settlement_transaction_id: settlementTxId,
      settled_at: new Date().toISOString(),
    })
    setPendingAction(null)
  }

  async function confirmWriteOff(r: Reimbursement) {
    if (r.direction === 'owed_to_me') {
      if (!actionCategoryId || !r.created_transaction_id) return
      await updateRecord<Transaction>('transactions', r.created_transaction_id, {
        is_reimbursement: false,
        category_id: actionCategoryId,
      })
    }
    await updateRecord<Reimbursement>('reimbursements', r.id, { status: 'written_off' })
    setPendingAction(null)
  }

  function renderItem(r: Reimbursement) {
    const isOpen = pendingAction?.id === r.id
    return (
      <div key={r.id} className="card" style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{r.counterparty_name}</div>
            {r.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.description}</div>}
          </div>
          <div style={{ fontWeight: 700 }}>{formatMoney(r.amount)}</div>
        </div>

        {!isOpen && (
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => openSettle(r)}>
              Settle
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openWriteOff(r)}>
              Write off
            </button>
          </div>
        )}

        {isOpen && pendingAction?.kind === 'settle' && (
          <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label className="label">
              {r.direction === 'owed_to_me' ? 'Which account did the repayment land in?' : 'Which account did you pay from?'}
            </label>
            <select className="input" value={actionAccountId} onChange={(e) => setActionAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => confirmSettle(r)}>
                Confirm settled
              </button>
              <button className="btn btn-secondary" onClick={() => setPendingAction(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {isOpen && pendingAction?.kind === 'write_off' && (
          <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {r.direction === 'owed_to_me' ? (
              <>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Not getting this back turns it into a real expense - pick a category for it.
                </p>
                <select className="input" value={actionCategoryId} onChange={(e) => setActionCategoryId(e.target.value)}>
                  <option value="">Select…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Marking this forgiven - since you never paid it, nothing changes in your accounts.
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => confirmWriteOff(r)}>
                Confirm write-off
              </button>
              <button className="btn btn-secondary" onClick={() => setPendingAction(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Money in transit" subtitle="Fronted money and IOUs, kept separate from your own spending." />

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <div className="stat-tile" style={{ flex: 1 }}>
          <div className="stat-label">Owed to you</div>
          <div className="stat-value" style={{ color: 'var(--good)' }}>
            {formatMoney(totals.owedToMe)}
          </div>
        </div>
        <div className="stat-tile" style={{ flex: 1 }}>
          <div className="stat-label">You owe</div>
          <div className="stat-value" style={{ color: 'var(--over)' }}>
            {formatMoney(totals.iOwe)}
          </div>
        </div>
      </div>

      <form className="card" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            className={`btn ${direction === 'owed_to_me' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setDirection('owed_to_me')}
          >
            I fronted money
          </button>
          <button
            type="button"
            className={`btn ${direction === 'i_owe' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setDirection('i_owe')}
          >
            I owe someone
          </button>
        </div>

        <div>
          <label className="label">Who</label>
          <input className="input" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="e.g. Mom" />
        </div>
        <div>
          <label className="label">Amount (₱)</label>
          <input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">What for (optional)</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {direction === 'owed_to_me' && (
          <div>
            <label className="label">Which account did you pay this from?</label>
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
        <button className="btn btn-primary btn-block" type="submit">
          Log it
        </button>
      </form>

      <h2 style={{ fontSize: '1rem' }}>Owed to you</h2>
      {owedToMe.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nothing outstanding.</p>}
      {owedToMe.map(renderItem)}

      <h2 style={{ fontSize: '1rem', marginTop: '1rem' }}>You owe</h2>
      {iOwe.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nothing outstanding.</p>}
      {iOwe.map(renderItem)}
    </div>
  )
}
