export const COFFEE_INTERVAL_MS = 25 * 60_000
export const MAX_COFFEE_RUNS = 20_000
const MAX_FOCUS_MS = 180 * 60_000
export type CoffeeTimer = {
  phase: 'focus' | 'rest'
  status: 'idle' | 'running' | 'paused' | 'complete'
  duration: number
  remaining: number
  deadline: number | null
}
export type ActiveCoffeeRun = {
  id: string
  durationMs: number
  activeMs: number
  remainingMs: number
  status: 'running' | 'paused'
  deadline: number | null
  updatedAt: number
}
export type CompletedCoffeeRun = {
  id: string
  durationMs: number
  activeMs: number
  deadline: number
  completedAt: number
}
export type CoffeeLedger = {
  version: 1
  completed: Record<string, CompletedCoffeeRun>
  active: Record<string, ActiveCoffeeRun>
}
export function emptyCoffeeLedger(): CoffeeLedger {
  return { version: 1, completed: {}, active: {} }
}
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
  Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max
export const validCoffeeId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9:_-]{1,110}$/.test(value) &&
  !Object.hasOwn(Object.prototype, value) &&
  value !== 'prototype'
export function parseCoffeeLedger(raw: unknown): CoffeeLedger | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as CoffeeLedger
  if (
    value.version !== 1 ||
    !value.completed ||
    typeof value.completed !== 'object' ||
    !value.active ||
    typeof value.active !== 'object' ||
    Array.isArray(value.completed) ||
    Array.isArray(value.active) ||
    Object.keys(value.completed).length > MAX_COFFEE_RUNS ||
    Object.keys(value.active).length > 64
  )
    return null
  const result = emptyCoffeeLedger()
  for (const [key, run] of Object.entries(value.completed)) {
    if (
      !run ||
      !validCoffeeId(key) ||
      key !== run.id ||
      !integer(run.durationMs, 60_000, MAX_FOCUS_MS) ||
      !integer(run.activeMs, 0, run.durationMs) ||
      !integer(run.deadline) ||
      !integer(run.completedAt, run.deadline)
    )
      return null
    result.completed[key] = {
      id: key,
      durationMs: run.durationMs,
      activeMs: run.activeMs,
      deadline: run.deadline,
      completedAt: run.completedAt,
    }
  }
  for (const [key, run] of Object.entries(value.active)) {
    if (
      !run ||
      !validCoffeeId(key) ||
      key !== run.id ||
      !integer(run.durationMs, 60_000, MAX_FOCUS_MS) ||
      !integer(run.activeMs, 0, run.durationMs) ||
      !integer(run.remainingMs, 0, run.durationMs - run.activeMs) ||
      !integer(run.updatedAt) ||
      !['running', 'paused'].includes(run.status) ||
      (run.status === 'running' && !integer(run.deadline)) ||
      (run.status === 'paused' && run.deadline !== null)
    )
      return null
    if (!result.completed[key])
      result.active[key] = {
        id: key,
        durationMs: run.durationMs,
        activeMs: run.activeMs,
        remainingMs: run.remainingMs,
        status: run.status,
        deadline: run.deadline,
        updatedAt: run.updatedAt,
      }
  }
  return result
}
/** Commutative immutable-completion union; latest active checkpoints remain authoritative. */
export function mergeCoffeeLedgers(earlier: CoffeeLedger, latest: CoffeeLedger): CoffeeLedger {
  const completed = { ...latest.completed }
  for (const [id, run] of Object.entries(earlier.completed)) {
    const other = completed[id]
    if (
      !other ||
      run.activeMs > other.activeMs ||
      (run.activeMs === other.activeMs && run.completedAt < other.completedAt)
    )
      completed[id] = run
  }
  return {
    version: 1,
    completed,
    active: Object.fromEntries(Object.entries(latest.active).filter(([id]) => !completed[id])),
  }
}
export function coffeeTotals(ledger: CoffeeLedger) {
  const focusMs = Object.values(ledger.completed).reduce((sum, run) => sum + run.activeMs, 0)
  return {
    focusMs,
    coffees: Math.floor(focusMs / COFFEE_INTERVAL_MS),
    remainderMs: focusMs % COFFEE_INTERVAL_MS,
  }
}
export function serializeCoffeeLedger(ledger: CoffeeLedger) {
  return JSON.stringify({
    version: 1,
    completed: Object.fromEntries(
      Object.entries(ledger.completed).sort(([a], [b]) => a.localeCompare(b)),
    ),
    active: Object.fromEntries(
      Object.entries(ledger.active).sort(([a], [b]) => a.localeCompare(b)),
    ),
  })
}
export function newCoffeeRunId() {
  return `focus-${Date.now().toString(36)}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
}
/** Running time means time consumed by the focus timer, never time spent paused or resting. */
export function observeCoffeeTimer(
  ledger: CoffeeLedger,
  runId: string | null,
  session: CoffeeTimer,
  now: number,
  createId = newCoffeeRunId,
): { ledger: CoffeeLedger; runId: string | null } {
  let next: CoffeeLedger = {
    version: 1,
    completed: { ...ledger.completed },
    active: { ...ledger.active },
  }
  const finish = (id: string | null) => ({ ledger: next, runId: id })
  const abandon = () => {
    if (runId) delete next.active[runId]
  }
  if (session.phase !== 'focus' || session.status === 'idle') {
    abandon()
    return finish(null)
  }
  const completed = runId ? next.completed[runId] : undefined
  if (
    completed &&
    session.duration === completed.durationMs &&
    (session.status === 'complete' || session.deadline === completed.deadline)
  )
    return finish(runId)
  let run = runId ? next.active[runId] : undefined
  const start = () => {
    abandon()
    if (session.status !== 'running' && session.status !== 'paused') return finish(null)
    const id = createId()
    next.active[id] = {
      id,
      durationMs: session.duration,
      activeMs: 0,
      remainingMs: session.remaining,
      status: session.status,
      deadline: session.deadline,
      updatedAt: now,
    }
    return finish(id)
  }
  if (!run || run.durationMs !== session.duration) return start()
  if (session.status === 'complete') {
    if (
      run.status === 'running' &&
      run.deadline !== null &&
      now >= run.deadline &&
      session.remaining === 0
    ) {
      if (!next.completed[run.id])
        next.completed[run.id] = {
          id: run.id,
          durationMs: run.durationMs,
          activeMs: Math.min(run.durationMs, run.activeMs + run.remainingMs),
          deadline: run.deadline,
          completedAt: now,
        }
      delete next.active[run.id]
      return finish(run.id)
    }
    abandon()
    return finish(null)
  }
  if (session.remaining > run.remainingMs) return start()
  if (run.status === 'running' && session.status === 'running')
    return run.deadline === session.deadline ? finish(run.id) : start()
  if (run.status === 'paused' && session.status === 'paused')
    return run.remainingMs === session.remaining ? finish(run.id) : start()
  const deadline = run.status === 'running' ? run.deadline : session.deadline
  if (deadline === null) return start()
  const consumed = Math.min(
    run.remainingMs - session.remaining,
    Math.max(0, now - (deadline - run.remainingMs)),
  )
  run = {
    ...run,
    activeMs: Math.min(run.durationMs, run.activeMs + consumed),
    remainingMs: session.remaining,
    status: session.status,
    deadline: session.deadline,
    updatedAt: now,
  }
  next.active[run.id] = run
  return finish(run.id)
}

/** Attribute a threshold crossing to its confirmed completion, independent of object insertion order. */
export function coffeeCompletion(ledger: CoffeeLedger, id: string | null) {
  if (!id || !ledger.completed[id]) return null
  let consumed = 0
  const ordered = Object.values(ledger.completed).sort(
    (a, b) => a.completedAt - b.completedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
  for (const run of ordered) {
    const prior = consumed
    consumed += run.activeMs
    if (run.id === id)
      return {
        id,
        focusMs: run.activeMs,
        earned: Math.floor(consumed / COFFEE_INTERVAL_MS) - Math.floor(prior / COFFEE_INTERVAL_MS),
      }
  }
  return null
}
