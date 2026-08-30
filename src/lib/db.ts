import Dexie, { type EntityTable } from 'dexie'
import type {
  LocalAccount,
  LocalCategory,
  LocalGoalContribution,
  LocalReimbursement,
  LocalSavingsGoal,
  LocalTransaction,
  LocalUserSettings,
} from './types'

export interface SyncMeta {
  key: string // e.g. 'watermark:accounts'
  value: string
}

class AppDatabase extends Dexie {
  accounts!: EntityTable<LocalAccount, 'id'>
  categories!: EntityTable<LocalCategory, 'id'>
  transactions!: EntityTable<LocalTransaction, 'id'>
  reimbursements!: EntityTable<LocalReimbursement, 'id'>
  savings_goals!: EntityTable<LocalSavingsGoal, 'id'>
  goal_contributions!: EntityTable<LocalGoalContribution, 'id'>
  user_settings!: EntityTable<LocalUserSettings, 'id'>
  sync_meta!: EntityTable<SyncMeta, 'key'>

  constructor() {
    super('aoi-rika')
    this.version(1).stores({
      accounts: 'id, user_id, kind, archived_at, updated_at, _dirty',
      categories: 'id, user_id, archived_at, updated_at, _dirty',
      transactions: 'id, user_id, type, occurred_at, from_account_id, to_account_id, category_id, reimbursement_id, updated_at, _dirty',
      reimbursements: 'id, user_id, direction, status, updated_at, _dirty',
      savings_goals: 'id, user_id, account_id, status, updated_at, _dirty',
      goal_contributions: 'id, user_id, goal_id, transaction_id, updated_at, _dirty',
      user_settings: 'id, user_id, updated_at, _dirty',
      sync_meta: 'key',
    })
  }
}

export const db = new AppDatabase()

export const SYNCABLE_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'reimbursements',
  'savings_goals',
  'goal_contributions',
  'user_settings',
] as const

export type SyncableTableName = (typeof SYNCABLE_TABLES)[number]
