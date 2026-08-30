import type { Account, Transaction } from '../types'

/**
 * Current balance = starting balance + everything that ever flowed in - everything that ever flowed out.
 * Reimbursement-tagged transactions still move real cash, so they count here even though they're
 * excluded from personal spend/income analytics elsewhere.
 */
export function accountBalance(account: Account, transactions: Transaction[]): number {
  let balance = account.starting_balance
  for (const tx of transactions) {
    if (tx.deleted_at) continue
    if (tx.to_account_id === account.id) balance += tx.amount
    if (tx.from_account_id === account.id) balance -= tx.amount
  }
  return balance
}

export function allAccountBalances(accounts: Account[], transactions: Transaction[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const account of accounts) {
    map.set(account.id, accountBalance(account, transactions))
  }
  return map
}
