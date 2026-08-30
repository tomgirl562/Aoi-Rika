import { v4 as uuidv4 } from 'uuid'
import { db, type SyncableTableName } from './db'
import { requestSync } from './sync'

export const newId = () => uuidv4()
export const nowIso = () => new Date().toISOString()

/** Insert a new local record, stamped as dirty so the next sync push picks it up. */
export async function createRecord<T extends { id: string; user_id: string }>(
  table: SyncableTableName,
  userId: string,
  data: Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at' | '_dirty' | '_local_updated_at'> & {
    created_at?: string
    deleted_at?: string | null
  },
): Promise<string> {
  const id = newId()
  const now = nowIso()
  const record = {
    ...data,
    id,
    user_id: userId,
    created_at: data.created_at ?? now,
    updated_at: now,
    deleted_at: data.deleted_at ?? null,
    _dirty: 1,
    _local_updated_at: Date.now(),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db[table] as any).put(record)
  requestSync()
  return id
}

/** Patch an existing local record, stamped as dirty. */
export async function updateRecord<T extends { id: string }>(
  table: SyncableTableName,
  id: string,
  patch: Partial<T>,
): Promise<void> {
  const now = nowIso()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db[table] as any).update(id, {
    ...patch,
    updated_at: now,
    _dirty: 1,
    _local_updated_at: Date.now(),
  })
  requestSync()
}

/** Soft-delete: keep the tombstone so the deletion replicates to other devices. */
export async function softDeleteRecord(table: SyncableTableName, id: string): Promise<void> {
  await updateRecord(table, id, { deleted_at: nowIso() } as never)
}
