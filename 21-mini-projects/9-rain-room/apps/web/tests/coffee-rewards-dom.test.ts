import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { build } from 'vite'
import { defaults, fresh } from '../src/pages/focus/model/timer.ts'
import {
  coffeeTotals,
  emptyCoffeeLedger,
  observeCoffeeTimer,
  serializeCoffeeLedger,
} from '../src/pages/focus/model/coffeeRewards.ts'
import { COFFEE_STORAGE_KEY } from '../src/pages/focus/model/coffeeRewardsStorage.ts'
await build({
  publicDir: false,
  build: {
    ssr: 'src/app/App.tsx',
    outDir: 'node_modules/.cache/coffee-rewards-dom',
    emptyOutDir: true,
  },
  logLevel: 'silent',
})
process.env.NODE_ENV = 'development'
const window = new Window({ url: 'http://localhost:3000/legacy' })
Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['ko-KR'] })
Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'ko-KR' })
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLDivElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'Element',
  'SVGElement',
  'Node',
  'NodeFilter',
  'Event',
  'KeyboardEvent',
  'PointerEvent',
  'MutationObserver',
  'ResizeObserver',
  'CustomEvent',
  'FocusEvent',
  'localStorage',
] as const)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: name === 'window' ? window : window[name],
  })
for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: window[name].bind(window),
  })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
const audios: { element: any; plays: number }[] = []
Object.defineProperty(globalThis, 'Audio', {
  configurable: true,
  value: function () {
    const element = new window.Audio()
    let paused = true
    const record = { element, plays: 0 }
    Object.defineProperty(element, 'paused', { get: () => paused })
    element.play = async () => {
      paused = false
      record.plays++
      element.dispatchEvent(new window.Event('playing'))
    }
    element.pause = () => {
      paused = true
      element.dispatchEvent(new window.Event('pause'))
    }
    audios.push(record)
    return element
  },
})
const { createElement, StrictMode, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { default: App } = await import('../node_modules/.cache/coffee-rewards-dom/App.js')
const document = window.document,
  minute = 60_000
const settings = {
  ...defaults,
  focus: 35,
  ambient: Object.fromEntries(
    Object.entries(defaults.ambient).map(([id, value]) => [id, { ...value, enabled: false }]),
  ),
} as typeof defaults
let now = 2_000_000_000_000
const originalNow = Date.now
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
async function mount() {
  document.body.innerHTML = '<div id="root"></div>'
  const root = createRoot(document.getElementById('root')!)
  await act(async () => root.render(createElement(StrictMode, null, createElement(App))))
  await settle()
  return async () => {
    await act(async () => root.unmount())
    await settle()
    await window.happyDOM.abort()
  }
}
async function click(element: Element) {
  const modal = document.querySelector('.settings-dialog')
  if (modal && !modal.contains(element))
    await click(modal.querySelector('[aria-label="설정 닫기"]')!)
  if (element.closest('.header-settings-panel')?.hasAttribute('hidden'))
    await click(document.querySelector('header [aria-label="설정"]')!)
  await act(async () => {
    element.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }))
    element.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true }))
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  })
  await settle()
}
async function elapsed(ms: number) {
  now += ms
  await act(async () => document.dispatchEvent(new window.Event('visibilitychange')))
  await settle()
}
const coffee = async () => {
  if (document.querySelector('#sheet-title')?.textContent !== '커피 쿠폰')
    await click(document.querySelector('header [aria-label="커피 쿠폰"]')!)
  return document.querySelector('.coffee-coupon-heading strong')!.textContent
}
const saved = () => JSON.parse(localStorage.getItem(COFFEE_STORAGE_KEY)!)
test('real App restores an expired tracked run, credits once under StrictMode, repairs tab unions and shows its count in coupon settings while premium spaces stay public', async () => {
  Date.now = () => now
  localStorage.clear()
  const session = {
    ...fresh('focus', settings),
    status: 'running' as const,
    deadline: now + 35 * minute,
  }
  const started = observeCoffeeTimer(emptyCoffeeLedger(), null, session, now, () => 'reload-focus')
  localStorage.setItem(COFFEE_STORAGE_KEY, serializeCoffeeLedger(started.ledger))
  localStorage.setItem(
    'rain-room.v1',
    JSON.stringify({ version: 3, settings, session, coffeeRunId: started.runId }),
  )
  let unmount = await mount()
  try {
    assert.equal(await coffee(), '0잔')
    await unmount()
    now += 35 * minute + 1
    unmount = await mount()
    assert.equal(await coffee(), '1잔')
    assert.equal(coffeeTotals(saved()).remainderMs, 10 * minute)
    assert.equal(Object.keys(saved().completed).length, 1)
    await elapsed(10000)
    assert.equal(await coffee(), '1잔')
    await unmount()
    unmount = await mount()
    assert.equal(await coffee(), '1잔')
    assert.ok(
      !document.querySelector('.coffee-notice'),
      'completed restores never announce another award',
    )
    const otherStart = observeCoffeeTimer(
      emptyCoffeeLedger(),
      null,
      {
        ...fresh('focus', { ...settings, focus: 25 }),
        status: 'running',
        deadline: now + 25 * minute,
      },
      now,
      () => 'other-tab',
    )
    const other = observeCoffeeTimer(
      otherStart.ledger,
      otherStart.runId,
      { ...fresh('focus', { ...settings, focus: 25 }), status: 'complete', remaining: 0 },
      now + 25 * minute,
    )
    localStorage.setItem(COFFEE_STORAGE_KEY, serializeCoffeeLedger(other.ledger))
    await act(async () =>
      window.dispatchEvent(new window.StorageEvent('storage', { key: COFFEE_STORAGE_KEY })),
    )
    assert.equal(await coffee(), '2잔')
    assert.equal(Object.keys(saved().completed).length, 2)
    await click(document.querySelector('.change-background')!)
    assert.ok(
      [...document.querySelectorAll<HTMLButtonElement>('.background-card')].every(
        (button) => !button.disabled,
      ),
    )
  } finally {
    await unmount()
    Date.now = originalNow
  }
})
test('pause, abandoned resets and running time edits do not farm coffee or restart the music transport', async () => {
  Date.now = () => now
  localStorage.clear()
  localStorage.setItem(
    'rain-room.v1',
    JSON.stringify({ version: 3, settings, session: fresh('focus', settings) }),
  )
  const unmount = await mount()
  try {
    await click(document.querySelector('.timer-actions>.primary')!)
    const live = audios.at(-1)!,
      plays = live.plays
    await elapsed(10 * minute)
    await click(document.querySelector('.timer-actions>.primary')!)
    await elapsed(100 * minute)
    assert.equal(await coffee(), '0잔')
    await click(document.querySelector('[aria-label="현재 타이머 초기화"]')!)
    assert.equal(Object.keys(saved().active).length, 0)
    await click(document.querySelector('.timer-actions>.primary')!)
    await elapsed(10 * minute)
    await click(document.querySelector('header [aria-label="시간 설정"]')!)
    await click(
      [...document.querySelectorAll<HTMLButtonElement>('.presets button')].find(
        (button) => button.textContent === '25분',
      )!,
    )
    await act(async () =>
      document
        .querySelector('.settings-dialog form')!
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })),
    )
    await settle()
    assert.equal(await coffee(), '0잔')
    await elapsed(25 * minute + 1)
    assert.equal(await coffee(), '1잔')
    assert.equal(coffeeTotals(saved()).focusMs, 25 * minute)
    assert.equal(live.plays, plays, 'rewards never operate the existing music transport')
  } finally {
    await unmount()
    Date.now = originalNow
  }
})
test('quota failures keep the displayed count unconfirmed, show an error and retry without losing or duplicating the pending completion', async () => {
  Date.now = () => now
  localStorage.clear()
  localStorage.setItem(COFFEE_STORAGE_KEY, serializeCoffeeLedger(emptyCoffeeLedger()))
  localStorage.setItem(
    'rain-room.v1',
    JSON.stringify({
      version: 3,
      settings: { ...settings, focus: 25 },
      session: fresh('focus', { ...settings, focus: 25 }),
    }),
  )
  const originalStorage = window.localStorage
  const windowDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')!
  const globalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!
  let blocked = true
  const limited = {
    getItem: (key: string) => originalStorage.getItem(key),
    setItem: (key: string, value: string) => {
      if (key === COFFEE_STORAGE_KEY && blocked) throw new Error('quota')
      originalStorage.setItem(key, value)
    },
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, get: () => limited })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: limited })
  const unmount = await mount()
  try {
    await click(document.querySelector('.timer-actions>.primary')!)
    await elapsed(25 * minute + 1)
    assert.equal(await coffee(), '0잔')
    assert.ok(document.querySelector('.coffee-error'))
    assert.ok(!document.querySelector('.coffee-notice'))
    assert.equal(Object.keys(saved().completed).length, 0)
    blocked = false
    await act(async () =>
      window.dispatchEvent(new window.StorageEvent('storage', { key: COFFEE_STORAGE_KEY })),
    )
    assert.equal(await coffee(), '1잔')
    assert.ok(!document.querySelector('.coffee-error'))
    assert.equal(Object.keys(saved().completed).length, 1)
    await act(async () =>
      window.dispatchEvent(new window.StorageEvent('storage', { key: COFFEE_STORAGE_KEY })),
    )
    assert.equal(await coffee(), '1잔')
    localStorage.setItem(COFFEE_STORAGE_KEY, '{bad')
    await act(async () =>
      window.dispatchEvent(new window.StorageEvent('storage', { key: COFFEE_STORAGE_KEY })),
    )
    assert.equal(await coffee(), '1잔')
    assert.ok(document.querySelector('.coffee-error'))
    assert.equal(localStorage.getItem(COFFEE_STORAGE_KEY), '{bad')
  } finally {
    await unmount()
    Object.defineProperty(window, 'localStorage', windowDescriptor)
    Object.defineProperty(globalThis, 'localStorage', globalDescriptor)
    Date.now = originalNow
  }
})

test('an unreadable initial reward record is shown as unknown, never a fabricated zero balance', async () => {
  Date.now = () => now
  localStorage.clear()
  localStorage.setItem(COFFEE_STORAGE_KEY, '{bad')
  localStorage.setItem(
    'rain-room.v1',
    JSON.stringify({ version: 3, settings, session: fresh('focus', settings) }),
  )
  const unmount = await mount()
  try {
    assert.equal(await coffee(), '—')
    assert.ok(document.querySelector('.coffee-error'))
    assert.ok(!document.querySelector('.coffee-coupons [role=progressbar]'))
    assert.equal(localStorage.getItem(COFFEE_STORAGE_KEY), '{bad')
  } finally {
    await unmount()
    Date.now = originalNow
  }
})

test('coffee coupons stay inside settings, render only ten stamps and expose all earned pages plus a new empty sheet', async () => {
  for (const count of [125, 10]) {
    Date.now = () => now
    localStorage.clear()
    const ledger = emptyCoffeeLedger()
    for (let index = 0; index < count; index++) {
      const id = `coupon-${index}`,
        deadline = now - (count - index) * 25 * minute
      ledger.completed[id] = {
        id,
        durationMs: 25 * minute,
        activeMs: 25 * minute,
        deadline,
        completedAt: deadline,
      }
    }
    localStorage.setItem(COFFEE_STORAGE_KEY, serializeCoffeeLedger(ledger))
    localStorage.setItem(
      'rain-room.v1',
      JSON.stringify({ version: 3, settings, session: fresh('focus', settings) }),
    )
    const unmount = await mount()
    try {
      assert.ok(!document.querySelector('main .coffee-coupons'))
      assert.ok(!document.querySelector('main .coffee-collection'))
      assert.equal(await coffee(), `${count}잔`)
      assert.equal(document.querySelector('#sheet-title')!.textContent, '커피 쿠폰')
      assert.equal(document.querySelectorAll('.header-settings-panel button').length, 5)
      const earned = new Set<number>()
      while (true) {
        const stamps = [...document.querySelectorAll<HTMLElement>('.coffee-stamps li')]
        assert.equal(stamps.length, 10)
        for (const stamp of stamps)
          if (stamp.dataset.filled === 'true')
            earned.add(Number(stamp.getAttribute('aria-label')!.match(/^\d+/)![0]))
        const previous = document.querySelector<HTMLButtonElement>('[aria-label="이전 쿠폰"]')!
        if (previous.disabled) break
        await click(previous)
      }
      assert.equal(earned.size, count)
      const next = document.querySelector<HTMLButtonElement>('[aria-label="다음 쿠폰"]')!
      while (!next.disabled) {
        await click(next)
        assert.equal(document.querySelectorAll('.coffee-stamps li').length, 10)
      }
      assert.equal(document.querySelectorAll('.coffee-stamp[data-filled=true]').length, count % 10)
      await click(document.querySelector('[aria-label="설정 닫기"]')!)
      assert.ok(document.activeElement === document.querySelector('header [aria-label="설정"]'))
    } finally {
      await unmount()
      Date.now = originalNow
    }
  }
})
