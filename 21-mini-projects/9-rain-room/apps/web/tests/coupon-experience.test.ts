import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { build } from 'vite'
await build({
  publicDir: false,
  build: {
    ssr: 'src/pages/focus/ui/ritual/CouponExperience.tsx',
    outDir: 'node_modules/.cache/coupon-experience',
    emptyOutDir: true,
  },
  logLevel: 'silent',
})
process.env.NODE_ENV = 'development'
const window = new Window({ url: 'http://localhost:3000' })
Object.defineProperty(window.navigator, 'languages', { value: ['ko-KR'], configurable: true })
let reducedMotion = false
const reducedListeners = new Set<(event: { matches: boolean }) => void>()
Object.defineProperty(window, 'matchMedia', {
  value: () => ({
    get matches() {
      return reducedMotion
    },
    addListener(listener) {
      reducedListeners.add(listener)
    },
    removeListener(listener) {
      reducedListeners.delete(listener)
    },
    addEventListener(_type, listener) {
      reducedListeners.add(listener)
    },
    removeEventListener(_type, listener) {
      reducedListeners.delete(listener)
    },
  }),
  configurable: true,
})
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'MutationObserver',
  'CustomEvent',
  'Event',
  'KeyboardEvent',
  'PointerEvent',
  'getComputedStyle',
] as const)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value:
      name === 'window'
        ? window
        : typeof window[name] === 'function' && name === 'getComputedStyle'
          ? window[name].bind(window)
          : window[name],
  })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const { createElement, act, StrictMode } = await import('react')
const { createRoot } = await import('react-dom/client')

const { default: Coupon, DepartureTransition } = await import(
  '../node_modules/.cache/coupon-experience/CouponExperience.js'
)
const noop = () => {}
const base = {
  drinkId: 'americano',
  focusMs: 25 * 60000,
  earned: 1,
  totalCoupons: 1,
  remainderMs: 0,
  confirmed: false,
  error: '',
  phase: 'coupon',
  restRemaining: 300000,
  restComplete: false,
  restMinutes: 5,
  onRetry: noop,
  onRest: noop,
  onReturn: noop,
}
async function fixture(run) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const render = async (props = {}) =>
    act(async () => root.render(createElement(Coupon, { ...base, ...props })))
  try {
    await render()
    await run(host, render, root)
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
}
test('pending and failed saves never claim coupons; retry and exit remain usable', async () =>
  fixture(async (host, render) => {
    let retry = 0,
      returned = 0,
      rest = 0
    assert.equal(host.querySelectorAll('.completion-stamp').length, 0)
    assert.equal(host.querySelector('.completion-actions .primary').disabled, true)
    assert.ok(document.activeElement === host.querySelector('h1'))
    await render({
      error: 'Storage unavailable',
      onRetry: () => retry++,
      onReturn: () => returned++,
      onRest: () => rest++,
    })
    assert.equal(
      host.querySelector('[role="alert"]').textContent.includes('Storage unavailable'),
      true,
    )
    await act(async () => host.querySelector('.completion-retry').click())
    await act(async () => host.querySelector('.completion-return').click())
    assert.equal(retry, 1)
    assert.equal(returned, 1)
    assert.equal(rest, 0)
    assert.equal(host.querySelectorAll('.completion-stamp').length, 0)
  }))
test('confirmed completion bounds stamp DOM, handles zero awards and keeps rest actions independent', async () =>
  fixture(async (host, render) => {
    let rested = 0,
      returned = 0
    await render({
      confirmed: true,
      totalCoupons: 125,
      earned: 0,
      focusMs: 600000,
      remainderMs: 600000,
      onRest: () => rested++,
    })
    assert.equal(host.querySelectorAll('.completion-stamp').length, 10)
    assert.equal(host.querySelectorAll('.completion-stamp-filled').length, 5)
    assert.equal(host.querySelectorAll('[data-new-stamp="true"]').length, 0)
    assert.ok(host.querySelector('[role="status"]').textContent.includes('다음 커피'))
    assert.equal(host.querySelector('progress').value, 600000)
    await act(async () => host.querySelector('.completion-actions .primary').click())
    assert.equal(rested, 1)
    await render({
      confirmed: true,
      phase: 'rest',
      restRemaining: 61000,
      onReturn: () => returned++,
    })
    assert.equal(host.querySelector('time').textContent, '01:01')
    await render({
      confirmed: true,
      phase: 'rest',
      restRemaining: 0,
      restComplete: true,
      onReturn: () => returned++,
    })
    assert.ok(host.querySelector('h1').textContent.includes('휴식을 마쳤'))
    await act(async () => host.querySelector('.completion-actions button').click())
    assert.equal(returned, 1)
  }))
test('departure is overlay-only, completes once and cancels its fallback on unmount', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let calls = 0
  await act(async () =>
    root.render(createElement(DepartureTransition, { onComplete: () => calls++ })),
  )
  assert.equal(host.querySelector('.completion-coupon'), null)
  await act(async () => {
    host.firstElementChild.dispatchEvent(new Event('animationend', { bubbles: true }))
    host.firstElementChild.dispatchEvent(new Event('animationend', { bubbles: true }))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 720))
  })
  assert.equal(calls, 1)
  await act(async () => root.unmount())
  host.remove()
  const second = document.createElement('div')
  document.body.append(second)
  const other = createRoot(second)
  await act(async () =>
    other.render(createElement(DepartureTransition, { onComplete: () => calls++ })),
  )
  await act(async () => other.unmount())
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 720))
  })
  assert.equal(calls, 1)
  second.remove()
  reducedMotion = true
  await act(async () => {
    for (const listener of reducedListeners) listener({ matches: true })
  })
  const third = document.createElement('div')
  document.body.append(third)
  const reducedRoot = createRoot(third)
  await act(async () =>
    reducedRoot.render(createElement(DepartureTransition, { onComplete: () => calls++ })),
  )
  assert.equal(third.firstElementChild.getAttribute('data-reduced-motion'), 'true')
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 180))
  })
  assert.equal(calls, 2, 'reduced-motion departure uses a short completion fallback')
  await act(async () => reducedRoot.unmount())
  third.remove()
  await window.happyDOM.abort()
})

test('confirmed coupon starts rest once after ink settles, using the latest callback', async (context) => {
  reducedMotion = false
  for (const listener of reducedListeners) listener({ matches: false })
  context.mock.timers.enable({ apis: ['setTimeout'] })
  try {
    await fixture(async (_host, render) => {
      let oldCalls = 0,
        latestCalls = 0
      await render({ confirmed: true, onRest: () => oldCalls++ })
      await act(async () => context.mock.timers.tick(2099))
      assert.equal(oldCalls, 0)
      await render({ confirmed: true, onRest: () => latestCalls++ })
      await act(async () => context.mock.timers.tick(1))
      assert.equal(oldCalls, 0)
      assert.equal(latestCalls, 1, 'callback identity changes do not restart the issuance delay')
      await render({ confirmed: true, onRest: () => latestCalls++ })
      await act(async () => context.mock.timers.tick(10000))
      assert.equal(latestCalls, 1)
    })
  } finally {
    context.mock.timers.reset()
  }
})

test('auto rest waits for successful saving and cancels on error, phase change, manual exit and unmount', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0
  try {
    await fixture(async (_host, render) => {
      const props = { onRest: () => calls++ }
      await render(props)
      await act(async () => context.mock.timers.tick(5000))
      assert.equal(calls, 0, 'pending save does not start rest')
      await render({ ...props, confirmed: true })
      await act(async () => context.mock.timers.tick(1000))
      await render({ ...props, confirmed: true, error: 'Storage unavailable' })
      await act(async () => context.mock.timers.tick(5000))
      assert.equal(calls, 0)
      await render({ ...props, confirmed: true })
      await act(async () => context.mock.timers.tick(2100))
      assert.equal(calls, 1, 'successful retry permits automatic rest')
    })
    await fixture(async (_host, render) => {
      await render({ confirmed: true, onRest: () => calls++ })
      await act(async () => context.mock.timers.tick(1000))
      await render({ confirmed: true, phase: 'rest', onRest: () => calls++ })
      await act(async () => context.mock.timers.tick(5000))
      assert.equal(calls, 1, 'rest phase cancels pending transition')
    })
    await fixture(async (host, render) => {
      await render({ confirmed: true, onRest: () => calls++ })
      await act(async () => host.querySelector('.completion-return').click())
      await act(async () => context.mock.timers.tick(5000))
      assert.equal(calls, 1, 'exit cancels even before parent unmount')
    })
    await fixture(async (_host, render) => render({ confirmed: true, onRest: () => calls++ }))
    await act(async () => context.mock.timers.tick(5000))
    assert.equal(calls, 1, 'unmount cancels pending transition')
  } finally {
    context.mock.timers.reset()
  }
})

test('reduced-motion coupon allows a short reading pause and manual rest remains an exactly-once shortcut', async (context) => {
  reducedMotion = true
  for (const listener of reducedListeners) listener({ matches: true })
  context.mock.timers.enable({ apis: ['setTimeout'] })
  try {
    await fixture(async (_host, render) => {
      let calls = 0
      await render({ confirmed: true, onRest: () => calls++ })
      await act(async () => context.mock.timers.tick(799))
      assert.equal(calls, 0)
      await act(async () => context.mock.timers.tick(1))
      assert.equal(calls, 1)
    })
    await fixture(async (host, render) => {
      let calls = 0
      await render({ confirmed: true, onRest: () => calls++ })
      await act(async () => host.querySelector('.completion-actions .primary').click())
      await act(async () => context.mock.timers.tick(5000))
      assert.equal(calls, 1)
    })
  } finally {
    context.mock.timers.reset()
  }
})

test('StrictMode effect replay schedules one automatic transition', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let calls = 0
  try {
    await act(async () =>
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(Coupon, { ...base, confirmed: true, onRest: () => calls++ }),
        ),
      ),
    )
    await act(async () => context.mock.timers.tick(2100))
    assert.equal(calls, 1)
    await act(async () => context.mock.timers.tick(10000))
    assert.equal(calls, 1)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    context.mock.timers.reset()
  }
})
