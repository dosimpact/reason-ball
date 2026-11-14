import {
  emptyObjectCollection,
  parseObjectCollection,
  type ObjectCollectionLedger,
} from './objectCollection.ts'
export const OBJECT_COLLECTION_STORAGE_KEY = 'rain-room.object-collection.v1'
export type ObjectCollectionStorageResult =
  | { ok: true; ledger: ObjectCollectionLedger }
  | { ok: false }
/** Adapter boundary: a backend implementation must supply atomic merge/update semantics. */
export interface ObjectCollectionStorage {
  read(): ObjectCollectionStorageResult
  update(
    change: (latest: ObjectCollectionLedger) => ObjectCollectionLedger,
  ): ObjectCollectionStorageResult
  subscribe(listener: () => void): () => void
}
export class LocalObjectCollectionStorage implements ObjectCollectionStorage {
  private access: () => Pick<Storage, 'getItem' | 'setItem'>
  private events: Pick<Window, 'addEventListener' | 'removeEventListener'> | undefined
  constructor(
    access: () => Pick<Storage, 'getItem' | 'setItem'> = () => window.localStorage,
    events?: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  ) {
    this.access = access
    this.events = events ?? (typeof window === 'undefined' ? undefined : window)
  }
  read(): ObjectCollectionStorageResult {
    try {
      const raw = this.access().getItem(OBJECT_COLLECTION_STORAGE_KEY)
      if (raw === null) return { ok: true, ledger: emptyObjectCollection() }
      const ledger = raw.length <= 1500000 ? parseObjectCollection(JSON.parse(raw)) : null
      return ledger ? { ok: true, ledger } : { ok: false }
    } catch {
      return { ok: false }
    }
  }
  update(
    change: (latest: ObjectCollectionLedger) => ObjectCollectionLedger,
  ): ObjectCollectionStorageResult {
    const latest = this.read()
    if (!latest.ok) return latest
    try {
      const ledger = parseObjectCollection(change(latest.ledger))
      if (!ledger) return { ok: false }
      const raw = JSON.stringify(ledger)
      const storage = this.access()
      if (storage.getItem(OBJECT_COLLECTION_STORAGE_KEY) !== raw)
        storage.setItem(OBJECT_COLLECTION_STORAGE_KEY, raw)
      return { ok: true, ledger }
    } catch {
      return { ok: false }
    }
  }
  subscribe(listener: () => void) {
    const changed = (event: Event) => {
      const key = (event as StorageEvent).key
      if (key === OBJECT_COLLECTION_STORAGE_KEY || key === null) listener()
    }
    this.events?.addEventListener('storage', changed)
    return () => this.events?.removeEventListener('storage', changed)
  }
}
