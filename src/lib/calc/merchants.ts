import type { Merchant, Transaction } from '../types'

export interface MerchantStats {
  merchant: Merchant
  totalSpent: number // centavos, across all time
  visitCount: number
  averagePerVisit: number // centavos
  recentNotes: string[] // most recent "what you got" notes first, deduped, capped
  lastVisit: string | null // ISO date of the most recent transaction
}

/**
 * Per-establishment spend stats from the transaction history. Reimbursement-tagged transactions
 * are excluded, same as everywhere else - fronted/owed money isn't "your" spending at that place.
 */
export function computeMerchantStats(merchants: Merchant[], transactions: Transaction[]): MerchantStats[] {
  const stats = merchants.map((merchant) => {
    const visits = transactions
      .filter((tx) => !tx.deleted_at && !tx.is_reimbursement && tx.type === 'expense' && tx.merchant_id === merchant.id)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))

    const totalSpent = visits.reduce((sum, tx) => sum + tx.amount, 0)
    const visitCount = visits.length
    const averagePerVisit = visitCount > 0 ? totalSpent / visitCount : 0

    const recentNotes: string[] = []
    for (const tx of visits) {
      if (!tx.note) continue
      if (recentNotes.includes(tx.note)) continue
      recentNotes.push(tx.note)
      if (recentNotes.length >= 3) break
    }

    return {
      merchant,
      totalSpent,
      visitCount,
      averagePerVisit,
      recentNotes,
      lastVisit: visits[0]?.occurred_at ?? null,
    }
  })

  return stats
    .filter((s) => s.visitCount > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent)
}
