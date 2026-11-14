import {
  emptyCoffeeLedger,
  parseCoffeeLedger,
  serializeCoffeeLedger,
  type CoffeeLedger,
} from './coffeeRewards.ts'
export const COFFEE_STORAGE_KEY = 'rain-room.coffee.v1'
export type CoffeeStorageResult = { ok: true; ledger: CoffeeLedger } | { ok: false; error: string }
/** Persistence is isolated from accrual rules; a future backend repository needs its own transaction semantics. */
export interface CoffeeRewardsStorage {
  read(): CoffeeStorageResult
  update(change: (latest: CoffeeLedger) => CoffeeLedger): CoffeeStorageResult
  subscribe(listener: () => void): () => void
}
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>
export class LocalCoffeeRewardsStorage implements CoffeeRewardsStorage {
  private access: StorageAccess
  private events: Pick<Window, 'addEventListener' | 'removeEventListener'> | undefined
  constructor(
    access: StorageAccess = () => window.localStorage,
    events?: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  ) {
    this.access = access
    this.events = events ?? (typeof window === 'undefined' ? undefined : window)
  }
  read(): CoffeeStorageResult {
    try {
      const raw = this.access().getItem(COFFEE_STORAGE_KEY)
      if (raw === null) return { ok: true, ledger: emptyCoffeeLedger() }
      const ledger = raw.length <= 2_500_000 ? parseCoffeeLedger(JSON.parse(raw)) : null
      return ledger
        ? { ok: true, ledger }
        : { ok: false, error: '커피 기록을 읽지 못했어요. 기존 기록은 덮어쓰지 않았어요.' }
    } catch {
      return {
        ok: false,
        error: '커피 기록에 접근하지 못했어요. 브라우저 저장 설정을 확인해 주세요.',
      }
    }
  }
  update(change: (latest: CoffeeLedger) => CoffeeLedger): CoffeeStorageResult {
    const current = this.read()
    if (!current.ok) return current
    try {
      const ledger = parseCoffeeLedger(change(current.ledger))
      if (!ledger)
        return {
          ok: false,
          error: '커피 기록을 저장하지 못했어요. 기록 용량과 형식을 확인해 주세요.',
        }
      const raw = serializeCoffeeLedger(ledger),
        storage = this.access()
      if (raw.length > 2_500_000)
        return { ok: false, error: '커피 기록 용량이 가득 찼어요. 기존 기록은 유지했어요.' }
      if (storage.getItem(COFFEE_STORAGE_KEY) !== raw) storage.setItem(COFFEE_STORAGE_KEY, raw)
      return { ok: true, ledger }
    } catch {
      return {
        ok: false,
        error: '커피 기록을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.',
      }
    }
  }
  subscribe(listener: () => void) {
    const changed = (event: Event) => {
      const key = (event as StorageEvent).key
      if (key === COFFEE_STORAGE_KEY || key === null) listener()
    }
    this.events?.addEventListener('storage', changed)
    return () => this.events?.removeEventListener('storage', changed)
  }
}
