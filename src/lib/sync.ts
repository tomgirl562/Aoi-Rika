import { db, SYNCABLE_TABLES, type SyncableTableName } from './db'
import { supabase } from './supabase'

let syncing = false
let pendingRerun = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function stripLocalFields<T extends Record<string, unknown>>(row: T) {
  const { _dirty, _local_updated_at, ...rest } = row as T & { _dirty?: unknown; _local_updated_at?: unknown }
  return rest
}

async function pushTable(table: SyncableTableName) {
  if (!supabase) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dirtyRows = await (db[table] as any).where('_dirty').equals(1).toArray()
  if (dirtyRows.length === 0) return
  const payload = dirtyRows.map(stripLocalFields)
  const { error } = await supabase.from(table).upsert(payload)
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`sync push failed for ${table}:`, error.message)
    return
  }
  await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dirtyRows.map((row: any) => (db[table] as any).update(row.id, { _dirty: 0 })),
  )
}

async function pullTable(table: SyncableTableName, userId: string) {
  if (!supabase) return
  const watermarkKey = `watermark:${table}`
  const meta = await db.sync_meta.get(watermarkKey)
  const since = meta?.value ?? '1970-01-01T00:00:00.000Z'

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', since)
    .order('updated_at', { ascending: true })
    .limit(500)

  if (error) {
    // eslint-disable-next-line no-console
    console.error(`sync pull failed for ${table}:`, error.message)
    return
  }
  if (!data || data.length === 0) return

  for (const remote of data as Array<Record<string, unknown> & { id: string; updated_at: string }>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const local = await (db[table] as any).get(remote.id)
    // Never clobber an unpushed local edit; it'll win on the next push and reconcile then.
    if (local?._dirty) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db[table] as any).put({ ...remote, _dirty: 0, _local_updated_at: Date.now() })
  }

  const latest = data[data.length - 1].updated_at
  await db.sync_meta.put({ key: watermarkKey, value: latest })
}

async function runSync() {
  if (!supabase) return
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) return

  for (const table of SYNCABLE_TABLES) {
    await pushTable(table)
  }
  for (const table of SYNCABLE_TABLES) {
    await pullTable(table, userId)
  }
}

/** Debounced, re-entrant-safe sync trigger. Safe to call after every local mutation. */
export function requestSync() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void syncNow()
  }, 800)
}

export async function syncNow() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  if (syncing) {
    pendingRerun = true
    return
  }
  syncing = true
  try {
    await runSync()
  } finally {
    syncing = false
    if (pendingRerun) {
      pendingRerun = false
      void syncNow()
    }
  }
}

export function initSync() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => void syncNow())
  // Retry periodically in case a push/pull silently failed (e.g. transient network blip).
  setInterval(() => void syncNow(), 60_000)
  void syncNow()
}
