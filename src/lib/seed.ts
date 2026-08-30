import { db } from './db'
import { createRecord } from './mutate'
import type { Account, Category, UserSettings } from './types'

const DEFAULT_ACCOUNTS: Array<Pick<Account, 'name' | 'kind' | 'starting_balance' | 'archived_at'>> = [
  { name: 'Payroll', kind: 'income', starting_balance: 0, archived_at: null },
  { name: 'Daily Savings / Expenses', kind: 'spending', starting_balance: 0, archived_at: null },
  { name: 'Personal Savings', kind: 'savings', starting_balance: 0, archived_at: null },
]

const DEFAULT_CATEGORIES: Array<Pick<Category, 'name' | 'is_default' | 'archived_at'>> = [
  { name: 'Food', is_default: true, archived_at: null },
  { name: 'Transportation', is_default: true, archived_at: null },
  { name: 'Shopping', is_default: true, archived_at: null },
]

/**
 * Seeds the three default accounts, default categories, and settings row for a brand-new user.
 * Safe to call every login - it no-ops once seeded. Runs as one Dexie transaction so that two
 * concurrent calls (e.g. React StrictMode double-invoking the auth effect in dev) serialize
 * instead of both racing past the same "is it empty?" check and double-seeding.
 */
export async function seedDefaultsIfNeeded(userId: string) {
  await db.transaction('rw', db.accounts, db.categories, db.user_settings, async () => {
    const [accountCount, categoryCount, settings] = await Promise.all([
      db.accounts.where('user_id').equals(userId).count(),
      db.categories.where('user_id').equals(userId).count(),
      db.user_settings.where('user_id').equals(userId).first(),
    ])

    if (accountCount === 0) {
      for (const account of DEFAULT_ACCOUNTS) {
        await createRecord<Account>('accounts', userId, account)
      }
    }

    if (categoryCount === 0) {
      for (const category of DEFAULT_CATEGORIES) {
        await createRecord<Category>('categories', userId, category)
      }
    }

    if (!settings) {
      await createRecord<UserSettings>('user_settings', userId, {
        week_start_day: 1,
        currency: 'PHP',
        safety_net_auto_months: 1.0,
        safety_net_override_amount: null,
      })
    }
  })
}
