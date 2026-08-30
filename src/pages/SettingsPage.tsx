import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useAccounts, useCategories, useSettings } from '../hooks/useData'
import { useAuth } from '../lib/auth'
import { createRecord, updateRecord } from '../lib/mutate'
import { formatMoney, pesosToCentavos } from '../lib/money'
import type { Account, AccountKind, Category, UserSettings } from '../lib/types'

export function SettingsPage() {
  const { userId, isLocalOnly, signOut } = useAuth()
  const accounts = useAccounts()
  const categories = useCategories()
  const settings = useSettings()

  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountInstitution, setNewAccountInstitution] = useState('')
  const [newAccountKind, setNewAccountKind] = useState<AccountKind>('other')
  const [newAccountBalance, setNewAccountBalance] = useState('')
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editInstitution, setEditInstitution] = useState('')
  const [editKind, setEditKind] = useState<AccountKind>('other')
  const [editBalance, setEditBalance] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [safetyNetInput, setSafetyNetInput] = useState('')
  const [allowanceInput, setAllowanceInput] = useState('')
  const [allowancePeriodInput, setAllowancePeriodInput] = useState<'weekly' | 'monthly'>('weekly')

  if (!userId) return null

  async function addAccount() {
    if (!newAccountName.trim()) return
    await createRecord<Account>('accounts', userId!, {
      name: newAccountName.trim(),
      institution: newAccountInstitution.trim() || null,
      kind: newAccountKind,
      starting_balance: newAccountBalance.trim() ? pesosToCentavos(Number(newAccountBalance)) : 0,
      archived_at: null,
    })
    setNewAccountName('')
    setNewAccountInstitution('')
    setNewAccountBalance('')
  }

  function startEditAccount(account: Account) {
    setEditingAccountId(account.id)
    setEditName(account.name)
    setEditInstitution(account.institution ?? '')
    setEditKind(account.kind)
    setEditBalance('')
  }

  async function saveEditAccount(account: Account) {
    if (!editName.trim()) return
    await updateRecord<Account>('accounts', account.id, {
      name: editName.trim(),
      institution: editInstitution.trim() || null,
      kind: editKind,
      // Balance here is the account's starting balance (before any logged transactions), so
      // leaving it blank keeps whatever was set before instead of silently zeroing it out.
      ...(editBalance.trim() ? { starting_balance: pesosToCentavos(Number(editBalance)) } : {}),
    })
    setEditingAccountId(null)
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return
    await createRecord<Category>('categories', userId!, {
      name: newCategoryName.trim(),
      is_default: false,
      archived_at: null,
    })
    setNewCategoryName('')
  }

  async function toggleArchiveAccount(account: Account) {
    await updateRecord<Account>('accounts', account.id, {
      archived_at: account.archived_at ? null : new Date().toISOString(),
    })
  }

  async function toggleArchiveCategory(category: Category) {
    await updateRecord<Category>('categories', category.id, {
      archived_at: category.archived_at ? null : new Date().toISOString(),
    })
  }

  async function applySafetyNetOverride() {
    if (!settings) return
    const trimmed = safetyNetInput.trim()
    await updateRecord<UserSettings>('user_settings', settings.id, {
      safety_net_override_amount: trimmed === '' ? null : pesosToCentavos(Number(trimmed)),
    })
    setSafetyNetInput('')
  }

  async function applyAllowance() {
    if (!settings) return
    const trimmed = allowanceInput.trim()
    await updateRecord<UserSettings>('user_settings', settings.id, {
      allowance_amount: trimmed === '' ? null : pesosToCentavos(Number(trimmed)),
      allowance_period: allowancePeriodInput,
    })
    setAllowanceInput('')
  }

  return (
    <div>
      <PageHeader title="Settings" />

      {isLocalOnly && (
        <div className="card" style={{ marginBottom: '1rem', background: 'var(--surface-2)' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Running in local-only mode - add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sync across
            devices. Everything still works offline right now.
          </p>
        </div>
      )}

      <section className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Allowance</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Set what you get per week or month and the Weekly check-in will split it evenly into a daily target,
          checked against what you can actually safely spend.
        </p>
        <p style={{ fontSize: '0.85rem' }}>
          Current:{' '}
          {settings?.allowance_amount != null
            ? `${formatMoney(settings.allowance_amount)} / ${settings.allowance_period}`
            : 'not set'}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            className="input"
            type="number"
            placeholder="e.g. 3500"
            value={allowanceInput}
            onChange={(e) => setAllowanceInput(e.target.value)}
          />
          <select
            className="input"
            value={allowancePeriodInput}
            onChange={(e) => setAllowancePeriodInput(e.target.value as 'weekly' | 'monthly')}
          >
            <option value="weekly">per week</option>
            <option value="monthly">per month</option>
          </select>
          <button className="btn btn-primary" onClick={applyAllowance}>
            Set
          </button>
        </div>
      </section>

      <section className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Weekly safety net</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Auto-calculated as {settings?.safety_net_auto_months ?? 1}× your trailing average monthly spend, unless you
          set a fixed amount below.
        </p>
        <p style={{ fontSize: '0.85rem' }}>
          Current override:{' '}
          {settings?.safety_net_override_amount != null ? formatMoney(settings.safety_net_override_amount) : 'none (auto)'}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            className="input"
            type="number"
            placeholder="e.g. 10000"
            value={safetyNetInput}
            onChange={(e) => setSafetyNetInput(e.target.value)}
          />
          <button className="btn btn-primary" onClick={applySafetyNetOverride}>
            Set
          </button>
        </div>
      </section>

      <section className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Accounts</h2>
        {accounts.map((account) => (
          <div key={account.id} style={{ padding: '0.4rem 0' }}>
            {editingAccountId === account.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
                <input
                  className="input"
                  value={editInstitution}
                  onChange={(e) => setEditInstitution(e.target.value)}
                  placeholder="Institution (e.g. BPI, GoTyme, Maya)"
                />
                <select className="input" value={editKind} onChange={(e) => setEditKind(e.target.value as AccountKind)}>
                  <option value="income">income</option>
                  <option value="spending">spending</option>
                  <option value="savings">savings</option>
                  <option value="other">other</option>
                </select>
                <input
                  className="input"
                  type="number"
                  placeholder={`Adjust balance (leave blank to keep current)`}
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveEditAccount(account)}>
                    Save
                  </button>
                  <button className="btn btn-secondary" onClick={() => setEditingAccountId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ opacity: account.archived_at ? 0.5 : 1 }}>
                  {account.institution && <span style={{ color: 'var(--text-muted)' }}>{account.institution} · </span>}
                  {account.name} <span className="pill">{account.kind}</span>
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-secondary" onClick={() => startEditAccount(account)}>
                    Edit
                  </button>
                  <button className="btn btn-secondary" onClick={() => toggleArchiveAccount(account)}>
                    {account.archived_at ? 'Unarchive' : 'Archive'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
          <input
            className="input"
            placeholder="New account name (e.g. Family Wallet)"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              className="input"
              placeholder="Institution (e.g. BPI)"
              value={newAccountInstitution}
              onChange={(e) => setNewAccountInstitution(e.target.value)}
            />
            <select className="input" value={newAccountKind} onChange={(e) => setNewAccountKind(e.target.value as AccountKind)}>
              <option value="income">income</option>
              <option value="spending">spending</option>
              <option value="savings">savings</option>
              <option value="other">other</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              className="input"
              type="number"
              placeholder="Current balance (₱, optional)"
              value={newAccountBalance}
              onChange={(e) => setNewAccountBalance(e.target.value)}
            />
            <button className="btn btn-primary" onClick={addAccount}>
              Add
            </button>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Categories</h2>
        {categories.map((category) => (
          <div key={category.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
            <span style={{ opacity: category.archived_at ? 0.5 : 1 }}>{category.name}</span>
            <button className="btn btn-secondary" onClick={() => toggleArchiveCategory(category)}>
              {category.archived_at ? 'Unarchive' : 'Archive'}
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <input
            className="input"
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <button className="btn btn-primary" onClick={addCategory}>
            Add
          </button>
        </div>
      </section>

      {!isLocalOnly && (
        <button className="btn btn-secondary btn-block" onClick={signOut}>
          Sign out
        </button>
      )}
    </div>
  )
}
