import { db, SYNCABLE_TABLES } from './db'
import { syncNow } from './sync'

export const LOCAL_USER_KEY = 'aoi-rika:local-user-id'

/** The random local-only id this device used before signing in, if it ever ran in local-only mode. */
export function getStoredLocalUserId(): string | null {
  return localStorage.getItem(LOCAL_USER_KEY)
}

/** How many rows on this device still belong to a given (typically local-only) user id. */
export async function countRowsForUser(userId: string): Promise<number> {
  const counts = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SYNCABLE_TABLES.map((table) => (db[table] as any).where('user_id').equals(userId).count()),
  )
  return counts.reduce((sum: number, c: number) => sum + c, 0)
}

/**
 * One-time move: reassigns every row still tagged with this device's old local-only id to the
 * signed-in cloud account, marks them dirty, and pushes them up. Safe to call more than once -
 * once a row's user_id is rewritten it no longer matches localUserId, so nothing double-migrates.
 */
export async function migrateLocalDataToAccount(localUserId: string, newUserId: string): Promise<number> {
  let migrated = 0
  const now = new Date().toISOString()
  for (const table of SYNCABLE_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (db[table] as any).where('user_id').equals(localUserId).toArray()
    for (const row of rows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db[table] as any).update(row.id, {
        user_id: newUserId,
        updated_at: now,
        _dirty: 1,
        _local_updated_at: Date.now(),
      })
      migrated++
    }
  }
  if (migrated > 0) await syncNow()
  return migrated
}
