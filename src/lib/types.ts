// Shared domain types. Amounts are always integer centavos (₱1.00 = 100) to avoid float drift.

export type AccountKind = 'income' | 'spending' | 'savings' | 'other'

export interface Account {
  id: string
  user_id: string
  name: string
  kind: AccountKind
  starting_balance: number
  archived_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Category {
  id: string
  user_id: string
  name: string
  is_default: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Merchant {
  id: string
  user_id: string
  name: string
  type: string // free text: Restaurant, Grocery, Online Shop, Subscription, Grab Food, or anything else
  archived_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number // centavos, always positive
  occurred_at: string
  from_account_id: string | null
  to_account_id: string | null
  category_id: string | null
  merchant_id: string | null // expenses only: which establishment
  note: string | null
  is_reimbursement: boolean
  reimbursement_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ReimbursementDirection = 'owed_to_me' | 'i_owe'
export type ReimbursementStatus = 'outstanding' | 'settled' | 'written_off'

export interface Reimbursement {
  id: string
  user_id: string
  direction: ReimbursementDirection
  counterparty_name: string
  amount: number // centavos, original amount
  description: string | null
  status: ReimbursementStatus
  created_transaction_id: string | null
  settlement_transaction_id: string | null
  created_at: string
  settled_at: string | null
  updated_at: string
  deleted_at: string | null
}

export type GoalStatus = 'active' | 'completed' | 'archived'

export interface SavingsGoal {
  id: string
  user_id: string
  name: string
  account_id: string
  target_amount: number // centavos
  target_date: string | null // date, YYYY-MM-DD
  status: GoalStatus
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface GoalContribution {
  id: string
  user_id: string
  goal_id: string
  transaction_id: string
  amount: number // centavos, signed: positive = contribution, negative = withdrawal for the goal
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface UserSettings {
  id: string
  user_id: string
  week_start_day: number // 0=Sun..6=Sat
  currency: string
  safety_net_auto_months: number
  safety_net_override_amount: number | null
  allowance_amount: number | null // centavos; null = allowance pacing not configured
  allowance_period: 'weekly' | 'monthly'
  created_at: string
  updated_at: string
}

// Every syncable table gets these two local-only bookkeeping fields in Dexie.
// _dirty is 0|1 (not boolean) because IndexedDB key comparisons treat true/1 as
// distinct types in some browsers - a plain number keeps the Dexie `.equals()` index query reliable.
export interface Syncable {
  _dirty: 0 | 1
  _local_updated_at: number // epoch ms, for local conflict comparisons
}

export type LocalAccount = Account & Syncable
export type LocalCategory = Category & Syncable
export type LocalMerchant = Merchant & Syncable
export type LocalTransaction = Transaction & Syncable
export type LocalReimbursement = Reimbursement & Syncable
export type LocalSavingsGoal = SavingsGoal & Syncable
export type LocalGoalContribution = GoalContribution & Syncable
export type LocalUserSettings = UserSettings & Syncable
