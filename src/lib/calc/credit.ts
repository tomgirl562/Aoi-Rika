import type { Account, Transaction } from '../types'

/**
 * A credit card tracks a liability, not cash - the sign is inverted from a normal asset account.
 * Charging the card (an expense with from_account = the card) increases what's owed; paying it
 * off (a transfer with to_account = the card) decreases it. starting_balance is read as the
 * amount already owed when the account was set up, not a cash balance.
 */
export function creditOwed(account: Account, transactions: Transaction[]): number {
  let owed = account.starting_balance
  for (const tx of transactions) {
    if (tx.deleted_at) continue
    if (tx.from_account_id === account.id) owed += tx.amount
    if (tx.to_account_id === account.id) owed -= tx.amount
  }
  return owed
}

function clampToMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
}

/** The next occurrence of the statement due day on or after `reference`. */
export function nextStatementDueDate(dueDay: number, reference: Date): Date {
  const candidate = clampToMonth(reference.getFullYear(), reference.getMonth(), dueDay)
  if (candidate >= reference) return candidate
  return clampToMonth(reference.getFullYear(), reference.getMonth() + 1, dueDay)
}

export interface CreditCardStatus {
  owed: number // centavos, what you currently owe
  limit: number // centavos, credit_limit or 0 if unset
  available: number // centavos, limit - owed (can go negative if over limit)
  nextDueDate: Date | null
  daysUntilDue: number | null
}

export function computeCreditCardStatus(account: Account, transactions: Transaction[], reference: Date): CreditCardStatus {
  const owed = creditOwed(account, transactions)
  const limit = account.credit_limit ?? 0
  const available = limit - owed

  let nextDueDate: Date | null = null
  let daysUntilDue: number | null = null
  if (account.statement_due_day) {
    nextDueDate = nextStatementDueDate(account.statement_due_day, reference)
    daysUntilDue = Math.ceil((nextDueDate.getTime() - reference.getTime()) / 86_400_000)
  }

  return { owed, limit, available, nextDueDate, daysUntilDue }
}
