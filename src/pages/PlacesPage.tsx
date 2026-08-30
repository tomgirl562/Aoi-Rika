import { PageHeader } from '../components/PageHeader'
import { useMerchants, useTransactions } from '../hooks/useData'
import { computeMerchantStats } from '../lib/calc/merchants'
import { updateRecord } from '../lib/mutate'
import { formatMoney } from '../lib/money'
import type { Merchant } from '../lib/types'

export function PlacesPage() {
  const merchants = useMerchants()
  const transactions = useTransactions()

  const activeMerchants = merchants.filter((m) => !m.archived_at)
  const archivedMerchants = merchants.filter((m) => m.archived_at)
  const stats = computeMerchantStats(activeMerchants, transactions)

  async function toggleArchive(merchant: Merchant) {
    await updateRecord<Merchant>('merchants', merchant.id, {
      archived_at: merchant.archived_at ? null : new Date().toISOString(),
    })
  }

  return (
    <div>
      <PageHeader title="Places" subtitle="Where you spend, and what you usually get there." />

      {stats.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>
          No establishments logged yet - tag one next time you add an expense and it'll show up here.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {stats.map(({ merchant, totalSpent, visitCount, averagePerVisit, recentNotes, lastVisit }) => (
          <div key={merchant.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{merchant.name}</div>
                <span className="pill">{merchant.type}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{formatMoney(totalSpent)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {visitCount} visit{visitCount === 1 ? '' : 's'} · {formatMoney(averagePerVisit)} avg
                </div>
              </div>
            </div>

            {recentNotes.length > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                What you usually get: {recentNotes.join(', ')}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {lastVisit ? `Last visit ${new Date(lastVisit).toLocaleDateString()}` : ''}
              </span>
              <button className="btn btn-secondary" onClick={() => toggleArchive(merchant)}>
                Archive
              </button>
            </div>
          </div>
        ))}
      </div>

      {archivedMerchants.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', marginTop: '1.25rem' }}>Archived</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {archivedMerchants.map((merchant) => (
              <div key={merchant.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                <span style={{ opacity: 0.5 }}>
                  {merchant.name} <span className="pill">{merchant.type}</span>
                </span>
                <button className="btn btn-secondary" onClick={() => toggleArchive(merchant)}>
                  Unarchive
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
