import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { useAuth } from '../lib/auth'
import type {
  Account,
  Category,
  GoalContribution,
  Merchant,
  Reimbursement,
  SavingsGoal,
  Transaction,
  UserSettings,
} from '../lib/types'

function notDeleted<T extends { deleted_at: string | null }>(rows: T[] | undefined): T[] {
  return (rows ?? []).filter((r) => !r.deleted_at)
}

export function useAccounts(): Account[] {
  const { userId } = useAuth()
  const rows = useLiveQuery(() => (userId ? db.accounts.where('user_id').equals(userId).toArray() : []), [userId])
  return notDeleted(rows)
}

export function useCategories(): Category[] {
  const { userId } = useAuth()
  const rows = useLiveQuery(() => (userId ? db.categories.where('user_id').equals(userId).toArray() : []), [userId])
  return notDeleted(rows)
}

export function useMerchants(): Merchant[] {
  const { userId } = useAuth()
  const rows = useLiveQuery(() => (userId ? db.merchants.where('user_id').equals(userId).toArray() : []), [userId])
  return notDeleted(rows)
}

export function useTransactions(): Transaction[] {
  const { userId } = useAuth()
  const rows = useLiveQuery(() => (userId ? db.transactions.where('user_id').equals(userId).toArray() : []), [userId])
  return notDeleted(rows)
}

export function useReimbursements(): Reimbursement[] {
  const { userId } = useAuth()
  const rows = useLiveQuery(() => (userId ? db.reimbursements.where('user_id').equals(userId).toArray() : []), [userId])
  return notDeleted(rows)
}

export function useGoals(): SavingsGoal[] {
  const { userId } = useAuth()
  const rows = useLiveQuery(() => (userId ? db.savings_goals.where('user_id').equals(userId).toArray() : []), [userId])
  return notDeleted(rows)
}

export function useGoalContributions(): GoalContribution[] {
  const { userId } = useAuth()
  const rows = useLiveQuery(
    () => (userId ? db.goal_contributions.where('user_id').equals(userId).toArray() : []),
    [userId],
  )
  return notDeleted(rows)
}

export function useSettings(): UserSettings | undefined {
  const { userId } = useAuth()
  return useLiveQuery(() => (userId ? db.user_settings.where('user_id').equals(userId).first() : undefined), [userId])
}
