import test from 'node:test'
import assert from 'node:assert/strict'
import {
  coffeeTotals,
  coffeeCompletion,
  emptyCoffeeLedger,
  mergeCoffeeLedgers,
  observeCoffeeTimer,
  parseCoffeeLedger,
  serializeCoffeeLedger,
  type CoffeeTimer,
  type CoffeeLedger,
} from '../src/pages/focus/model/coffeeRewards.ts'
import {
  COFFEE_STORAGE_KEY,
  LocalCoffeeRewardsStorage,
} from '../src/pages/focus/model/coffeeRewardsStorage.ts'
const minute = 60_000
function timer(
  minutes: number,
  status: CoffeeTimer['status'],
  remaining = minutes * minute,
  deadline: number | null = null,
  phase: CoffeeTimer['phase'] = 'focus',
): CoffeeTimer {
  return { phase, status, duration: minutes * minute, remaining, deadline }
}
let sequence = 0
const id = () => `test-${++sequence}`
function completed(minutes: number, ledger = emptyCoffeeLedger(), now = 0) {
  const started = observeCoffeeTimer(
    ledger,
    null,
    timer(minutes, 'running', minutes * minute, now + minutes * minute),
    now,
    id,
  )
  return observeCoffeeTimer(
    started.ledger,
    started.runId,
    timer(minutes, 'complete', 0),
    now + minutes * minute,
    id,
  )
}
test('completed focus awards 25/35/50 minutes correctly and carries 10+15 minutes without spending lifetime coffee', () => {
  for (const [minutes, coffees, remainder] of [
    [25, 1, 0],
    [35, 1, 10],
    [50, 2, 0],
  ]) {
    const result = coffeeTotals(completed(minutes).ledger)
    assert.equal(result.coffees, coffees)
    assert.equal(result.remainderMs, remainder * minute)
    assert.equal(result.focusMs, minutes * minute)
  }
  const ten = completed(10),
    fifteen = completed(15, ten.ledger, 10 * minute)
  assert.deepEqual(coffeeTotals(fifteen.ledger), {
    coffees: 1,
    remainderMs: 0,
    focusMs: 25 * minute,
  })
  const replay = observeCoffeeTimer(
    fifteen.ledger,
    fifteen.runId,
    timer(15, 'complete', 0),
    100 * minute,
    id,
  )
  assert.deepEqual(coffeeTotals(replay.ledger), coffeeTotals(fifteen.ledger))
})
test('pause and rest never earn time; reset and duration reconfiguration abandon incomplete runs', () => {
  let state = observeCoffeeTimer(
    emptyCoffeeLedger(),
    null,
    timer(35, 'running', 35 * minute, 35 * minute),
    0,
    id,
  )
  state = observeCoffeeTimer(
    state.ledger,
    state.runId,
    timer(35, 'paused', 30 * minute),
    5 * minute,
    id,
  )
  assert.equal(state.ledger.active[state.runId!].activeMs, 5 * minute)
  state = observeCoffeeTimer(
    state.ledger,
    state.runId,
    timer(35, 'paused', 30 * minute),
    200 * minute,
    id,
  )
  state = observeCoffeeTimer(
    state.ledger,
    state.runId,
    timer(35, 'running', 30 * minute, 230 * minute),
    200 * minute,
    id,
  )
  state = observeCoffeeTimer(state.ledger, state.runId, timer(35, 'complete', 0), 230 * minute, id)
  assert.equal(coffeeTotals(state.ledger).focusMs, 35 * minute)
  const rest = observeCoffeeTimer(
    state.ledger,
    null,
    timer(15, 'running', 15 * minute, 245 * minute, 'rest'),
    230 * minute,
    id,
  )
  assert.equal(rest.runId, null)
  assert.equal(coffeeTotals(rest.ledger).focusMs, 35 * minute)
  const baseline = emptyCoffeeLedger()
  for (const reset of [
    timer(35, 'idle'),
    timer(35, 'running', 35 * minute, 45 * minute),
    timer(25, 'running', 25 * minute, 35 * minute),
  ]) {
    const start = observeCoffeeTimer(
      baseline,
      null,
      timer(35, 'running', 35 * minute, 35 * minute),
      0,
      id,
    )
    const next = observeCoffeeTimer(start.ledger, start.runId, reset, 10 * minute, id)
    assert.ok(next.runId !== start.runId)
    assert.equal(coffeeTotals(next.ledger).focusMs, 0)
    if (reset.status === 'running') {
      const end = observeCoffeeTimer(
        next.ledger,
        next.runId,
        timer(reset.duration / minute, 'complete', 0),
        reset.deadline!,
        id,
      )
      assert.equal(coffeeTotals(end.ledger).focusMs, reset.duration)
    }
  }
})
test('running checkpoints survive reload and expired completion is credited once across merged tab ledgers', () => {
  let state = observeCoffeeTimer(
    emptyCoffeeLedger(),
    null,
    timer(35, 'running', 35 * minute, 35 * minute),
    0,
    id,
  )
  state = observeCoffeeTimer(
    state.ledger,
    state.runId,
    timer(35, 'paused', 30 * minute),
    5 * minute,
    id,
  )
  state = observeCoffeeTimer(
    state.ledger,
    state.runId,
    timer(35, 'running', 30 * minute, 100 * minute),
    70 * minute,
    id,
  )
  const checkpoint = parseCoffeeLedger(JSON.parse(serializeCoffeeLedger(state.ledger)))!
  const loaded = observeCoffeeTimer(
    checkpoint,
    state.runId,
    timer(35, 'complete', 0),
    120 * minute,
    id,
  )
  assert.equal(coffeeTotals(loaded.ledger).focusMs, 35 * minute)
  const staleTab = mergeCoffeeLedgers(checkpoint, loaded.ledger)
  const replay = observeCoffeeTimer(
    staleTab,
    state.runId,
    timer(35, 'complete', 0),
    130 * minute,
    id,
  )
  assert.equal(Object.keys(replay.ledger.completed).length, 1)
  assert.equal(coffeeTotals(replay.ledger).coffees, 1)
  assert.equal(
    coffeeTotals(
      observeCoffeeTimer(emptyCoffeeLedger(), null, timer(35, 'complete', 0), 130 * minute, id)
        .ledger,
    ).focusMs,
    0,
  )
})
test('a prematurely reduced remaining value cannot mint active time that has not elapsed', () => {
  let state = observeCoffeeTimer(
    emptyCoffeeLedger(),
    null,
    timer(35, 'running', 35 * minute, 35 * minute),
    0,
    id,
  )
  state = observeCoffeeTimer(state.ledger, state.runId, timer(35, 'paused', 0), minute, id)
  state = observeCoffeeTimer(state.ledger, state.runId, timer(35, 'running', 0, minute), minute, id)
  state = observeCoffeeTimer(state.ledger, state.runId, timer(35, 'complete', 0), minute, id)
  assert.equal(coffeeTotals(state.ledger).focusMs, minute)
})
function memory(raw: string | null = null) {
  return {
    raw,
    writes: 0,
    getItem() {
      return this.raw
    },
    setItem(_key: string, next: string) {
      this.writes++
      this.raw = next
    },
  }
}
test('local repository reads before writing, merges completion IDs, and skips unchanged checkpoints', () => {
  const storage = memory(),
    a = new LocalCoffeeRewardsStorage(() => storage),
    b = new LocalCoffeeRewardsStorage(() => storage)
  const first = completed(25),
    second = completed(25)
  assert.ok(a.update((latest) => mergeCoffeeLedgers(first.ledger, latest)).ok)
  assert.ok(b.update((latest) => mergeCoffeeLedgers(second.ledger, latest)).ok)
  const result = a.read()
  assert.ok(result.ok)
  assert.equal(coffeeTotals(result.ledger).coffees, 2)
  const writes = storage.writes
  assert.ok(a.update((latest) => mergeCoffeeLedgers(first.ledger, latest)).ok)
  assert.equal(storage.writes, writes)
  const start = observeCoffeeTimer(
    result.ledger,
    null,
    timer(35, 'running', 35 * minute, 35 * minute),
    0,
    id,
  )
  a.update(() => start.ledger)
  const checkpointWrites = storage.writes
  for (let elapsed = 250; elapsed < 5000; elapsed += 250)
    a.update(
      (latest) =>
        observeCoffeeTimer(
          latest,
          start.runId,
          timer(35, 'running', 35 * minute - elapsed, 35 * minute),
          elapsed,
          id,
        ).ledger,
    )
  assert.equal(
    storage.writes,
    checkpointWrites,
    'running ticks never rewrite the active checkpoint',
  )
})
test('malformed, out-of-bounds and quota-limited records stay intact and report errors instead of fake credit', () => {
  for (const raw of [
    '{bad',
    JSON.stringify({ version: 99 }),
    JSON.stringify({ version: 1, completed: 4, active: {} }),
    JSON.stringify({ version: 1, completed: {}, active: { constructor: { id: 'constructor' } } }),
  ]) {
    const storage = memory(raw),
      repository = new LocalCoffeeRewardsStorage(() => storage)
    assert.equal(repository.read().ok, false)
    assert.equal(repository.update(() => completed(25).ledger).ok, false)
    assert.equal(storage.raw, raw)
    assert.equal(storage.writes, 0)
  }
  const storage = memory(serializeCoffeeLedger(emptyCoffeeLedger()))
  storage.setItem = () => {
    throw new Error('quota')
  }
  const result = new LocalCoffeeRewardsStorage(() => storage).update(() => completed(25).ledger)
  assert.equal(result.ok, false)
  assert.equal(coffeeTotals(JSON.parse(storage.raw!)).coffees, 0)
  const oversized: CoffeeLedger = emptyCoffeeLedger()
  for (let i = 0; i < 9000; i++) {
    const key = `run-${String(i).padStart(5, '0')}-${'x'.repeat(98)}`
    oversized.completed[key] = {
      id: key,
      durationMs: 25 * minute,
      activeMs: 25 * minute,
      deadline: 25 * minute,
      completedAt: 25 * minute,
    }
  }
  assert.ok(serializeCoffeeLedger(oversized).length > 2_500_000)
  const valid = memory(serializeCoffeeLedger(emptyCoffeeLedger())),
    repository = new LocalCoffeeRewardsStorage(() => valid)
  assert.equal(repository.update(() => oversized).ok, false)
  assert.equal(valid.writes, 0)
  const corrupt = completed(25).ledger
  Object.values(corrupt.completed)[0].activeMs = Infinity
  assert.equal(parseCoffeeLedger(corrupt), null)
})

test('confirmed per-visit coupons count threshold crossings with carry, stable ordering and no duplicate credit', () => {
  for (const [minutes, earned, remainder] of [
    [35, 1, 10],
    [55, 2, 5],
    [10, 0, 10],
  ]) {
    const result = completed(minutes)
    assert.equal(coffeeCompletion(result.ledger, result.runId)?.earned, earned)
    assert.equal(coffeeTotals(result.ledger).remainderMs, remainder * minute)
    assert.equal(coffeeCompletion(emptyCoffeeLedger(), result.runId), null)
    const duplicate = mergeCoffeeLedgers(result.ledger, result.ledger)
    assert.deepEqual(
      coffeeCompletion(duplicate, result.runId),
      coffeeCompletion(result.ledger, result.runId),
    )
  }
  const previous = completed(20)
  const current = completed(10, previous.ledger, 25 * minute)
  assert.equal(coffeeCompletion(current.ledger, current.runId)?.earned, 1)
  assert.equal(coffeeTotals(current.ledger).remainderMs, 5 * minute)
  const reversed = {
    ...current.ledger,
    completed: Object.fromEntries(Object.entries(current.ledger.completed).reverse()),
  }
  assert.deepEqual(
    coffeeCompletion(reversed, current.runId),
    coffeeCompletion(current.ledger, current.runId),
  )
  const resting = observeCoffeeTimer(
    current.ledger,
    current.runId,
    timer(5, 'complete', 0, null, 'rest'),
    40 * minute,
  )
  assert.deepEqual(coffeeTotals(resting.ledger), coffeeTotals(current.ledger))
})
