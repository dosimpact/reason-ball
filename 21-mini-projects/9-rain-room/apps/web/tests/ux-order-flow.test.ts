import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { build } from 'vite'
await build({
  publicDir: false,
  build: {
    ssr: 'src/pages/focus/ui/ritual/KioskExperience.tsx',
    outDir: 'node_modules/.cache/ux-order-flow',
    emptyOutDir: true,
  },
  logLevel: 'silent',
})
process.env.NODE_ENV = 'development'
const window = new Window({ url: 'http://localhost:3000' })
let landscape = false
const resizeListeners = new Set<() => void>()
Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['ko-KR'] })
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (media: string) => ({
    media,
    get matches() {
      return media.includes('orientation: landscape') ? landscape : false
    },
    addEventListener(_event: string, fn: () => void) {
      if (media.includes('orientation: landscape')) resizeListeners.add(fn)
    },
    removeEventListener(_event: string, fn: () => void) {
      resizeListeners.delete(fn)
    },
    addListener() {},
    removeListener() {},
  }),
})
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
  'NodeFilter',
  'MutationObserver',
  'ResizeObserver',
  'CustomEvent',
  'FocusEvent',
  'Node',
  'Event',
  'KeyboardEvent',
  'PointerEvent',
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
Object.defineProperty(window.Element.prototype, 'animate', { configurable: true, value: undefined })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
localStorage.setItem('rain-room.language', 'ko')
const { createElement, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { default: KioskExperience, SeatingTransition } = await import(
  '../node_modules/.cache/ux-order-flow/KioskExperience.js'
)
const order = { id: 'review-order', drinkId: 'matcha-latte', temperature: 'iced', createdAt: 1000 }
const noop = () => {}
const base = {
  state: { stage: 'menu', drinkId: 'matcha-latte', temperature: 'iced', order },
  focus: 25,
  rest: 5,
  backgroundName: 'Rain Room',
  muted: true,
  onSelectDrink: noop,
  onCheckout: noop,
  onBack: noop,
  onOrder: noop,
  onPrinted: noop,
  onTimeChange: noop,
  onSeat: noop,
  onMute: noop,
  customTimeOpen: false,
  onCustomTimeOpenChange: noop,
  onCustomTimeApply: noop,
}
const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
async function fixture(
  run: (
    host: HTMLElement,
    render: (patch?: Record<string, unknown>) => Promise<void>,
    props: typeof base,
  ) => Promise<void>,
) {
  landscape = false
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let current = { ...base }
  const render = async (patch: Record<string, unknown> = {}) => {
    current = { ...current, ...patch }
    await act(async () => root.render(createElement(KioskExperience, current)))
  }
  try {
    await render()
    await run(host, render, current)
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
}
const click = (el: HTMLElement) => act(async () => el.click())
const input = async (el: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(
      el,
      value,
    )
    el.dispatchEvent(new window.Event('input', { bubbles: true }))
    el.dispatchEvent(new window.Event('change', { bubbles: true }))
  })

test('icon-only portrait shows all ten drinks and rotation restores the selected landscape page', async () =>
  fixture(async (host, render) => {
    assert.equal(host.querySelectorAll('.ritual-menu-item').length, 10)
    assert.equal(host.querySelector('.ritual-menu-page'), null)
    for (const card of host.querySelectorAll<HTMLButtonElement>('.ritual-menu-item')) {
      assert.ok(card.getAttribute('aria-label'))
      assert.equal(card.textContent!.trim(), '', 'menu names must be accessibility labels only')
      assert.equal(card.hasAttribute('title'), false)
    }
    assert.ok(host.querySelector('[data-drink-id="matcha-latte"][aria-pressed="true"]'))
    await act(async () => {
      landscape = true
      for (const listener of resizeListeners) listener()
    })
    assert.equal(host.querySelector<HTMLElement>('.ritual-menu-page')!.dataset.menuPage, '1')
    assert.equal(host.querySelectorAll('.ritual-menu-item').length, 2)
    assert.ok(host.querySelector('[data-drink-id="matcha-latte"][aria-pressed="true"]'))
    await click(host.querySelector<HTMLElement>('.ritual-menu-prev')!)
    assert.equal(host.querySelectorAll('.ritual-menu-item').length, 8)
    await render({ focus: 55 })
    assert.equal(host.querySelector<HTMLElement>('.ritual-menu-page')!.dataset.menuPage, '0')
    await act(async () => {
      landscape = false
      for (const listener of resizeListeners) listener()
    })
    assert.equal(host.querySelectorAll('.ritual-menu-item').length, 10)
    assert.equal(host.querySelector('.ritual-menu-page'), null)
  }))

test('stage navigation focuses reading targets once and leaves ordinary edits alone', async () =>
  fixture(async (host, render) => {
    assert.ok(document.activeElement === host.querySelector('[data-drink-id="matcha-latte"]'))
    await render({ state: { ...base.state, stage: 'checkout' } })
    assert.ok(document.activeElement === host.querySelector('.ritual-checkout h2'))
    const back = host.querySelector<HTMLButtonElement>('.ritual-back')!
    back.focus()
    await render({ focus: 55 })
    assert.ok(document.activeElement === back, 'settings updates must not steal focus')
    await render({ state: { ...base.state, stage: 'receipt' } })
    assert.ok(document.activeElement === host.querySelector('.ritual-receipt'))
    const preset = host.querySelector<HTMLButtonElement>('.ritual-focus-presets button')!
    preset.focus()
    await render({ rest: 7 })
    assert.ok(document.activeElement === preset)
    assert.ok(
      host.querySelectorAll('legend')[1].textContent!.includes('7분'),
      'custom rest must remain visible on the final receipt',
    )
    await render({ state: { ...base.state, stage: 'menu' } })
    assert.ok(document.activeElement === host.querySelector('[data-drink-id="matcha-latte"]'))
    await act(async () => {
      landscape = true
      for (const listener of resizeListeners) listener()
    })
    await click(host.querySelector<HTMLElement>('.ritual-menu-prev')!)
    await render({ state: { ...base.state, stage: 'checkout' } })
    await render({ state: { ...base.state, stage: 'menu' } })
    assert.equal(host.querySelector<HTMLElement>('.ritual-menu-page')!.dataset.menuPage, '0')
    assert.ok(
      document.activeElement === host.querySelector('.ritual-menu-item'),
      'back preserves the browsed page and focuses its first drink if selection is on another page',
    )
  }))

test('custom times are a cancelable transaction and Apply commits both valid values once', async () =>
  fixture(async (host, render) => {
    let currentFocus = 25,
      currentRest = 5
    const applied: number[][] = []
    let callbacks = 0
    const paint = (patch: Record<string, unknown> = {}) =>
      render({ focus: currentFocus, rest: currentRest, ...patch })
    await paint({
      state: { ...base.state, stage: 'receipt' },
      onTimeChange() {
        callbacks++
      },
      onCustomTimeOpenChange(open: boolean) {
        void paint({ customTimeOpen: open })
      },
      onCustomTimeApply(focus: number, rest: number) {
        applied.push([focus, rest])
        currentFocus = focus
        currentRest = rest
        void paint({ customTimeOpen: false })
      },
    })
    const open = () => click(host.querySelector<HTMLElement>('.ritual-custom-time-open')!)
    const inputs = () => [
      ...document.querySelectorAll<HTMLInputElement>('.ritual-custom-time-dialog input'),
    ]
    await open()
    await input(inputs()[0], '40')
    await input(inputs()[1], '7')
    assert.equal(callbacks, 0)
    assert.equal(applied.length, 0)
    await click(document.querySelector<HTMLElement>('.ritual-custom-time-dialog .close')!)
    await open()
    assert.deepEqual(
      inputs().map((el) => el.value),
      ['25', '5'],
    )
    await input(inputs()[0], '40')
    await input(inputs()[0], '')
    assert.equal(
      document.querySelector<HTMLButtonElement>('.ritual-custom-time-dialog .save')!.disabled,
      true,
    )
    await act(async () => {
      inputs()[0].focus()
      inputs()[1].focus()
    })
    assert.equal(
      inputs()[0].value,
      '40',
      'invalid blur restores the last valid draft, not persisted 25',
    )
    await input(inputs()[1], '7')
    await click(document.querySelector<HTMLElement>('.ritual-custom-time-dialog .save')!)
    assert.deepEqual(applied, [[40, 7]])
    assert.equal(callbacks, 0)
    assert.ok(host.querySelectorAll('legend')[1].textContent!.includes('7분'))
    await open()
    await input(inputs()[0], '44')
    await paint({ customTimeOpen: false }) // parent Back/history closes the controlled editor
    await open()
    assert.deepEqual(
      inputs().map((el) => el.value),
      ['40', '7'],
    )
    assert.deepEqual(applied, [[40, 7]])
  }))

test('ready regression restores the cover and cancels a stale fade completion', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let completed = 0
  const render = (ready: boolean) =>
    act(async () =>
      root.render(
        createElement(SeatingTransition, {
          drinkId: 'americano',
          temperature: 'hot',
          reduced: true,
          ready,
          onComplete() {
            completed++
          },
        }),
      ),
    )
  try {
    await render(false)
    await wait(135)
    await render(true)
    await wait(40)
    assert.equal(host.querySelector<HTMLElement>('.ritual-seating')!.dataset.fading, 'true')
    await render(false)
    assert.equal(host.querySelector<HTMLElement>('.ritual-seating')!.dataset.fading, 'false')
    await wait(140)
    assert.equal(completed, 0)
    await render(true)
    await wait(140)
    assert.equal(completed, 1)
    await render(false)
    await render(true)
    await wait(140)
    assert.equal(completed, 1)
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
test.after(async () => {
  await window.happyDOM.abort()
})

test('receipt records the selected free order, full date and deterministic barcode in all locales', async () => {
  const { createInstance } = await import('i18next')
  const { I18nextProvider } = await import('react-i18next')
  const { readFile } = await import('node:fs/promises')
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let barcode = ''
  try {
    for (const language of ['ko', 'en', 'zh']) {
      const resource = JSON.parse(
        await readFile(
          new URL(`../src/shared/i18n/locales/${language}/ritual.json`, import.meta.url),
          'utf8',
        ),
      )
      const instance = createInstance()
      await instance.init({
        lng: language,
        resources: { [language]: { ritual: resource } },
        defaultNS: 'ritual',
        initImmediate: false,
      })
      await act(async () =>
        root.render(
          createElement(
            I18nextProvider,
            { i18n: instance },
            createElement(KioskExperience, { ...base, state: { ...base.state, stage: 'receipt' } }),
          ),
        ),
      )
      const receipt = host.querySelector('.ritual-receipt')!
      assert.ok(receipt.textContent!.includes(resource.receiptDetails.subtitle))
      assert.ok(receipt.textContent!.includes(resource.drinks['matcha-latte']))
      assert.ok(receipt.textContent!.includes(resource.receiptDetails.complimentary))
      assert.equal(receipt.querySelectorAll('[role="columnheader"]').length, 3)
      assert.deepEqual(
        [...receipt.querySelectorAll('.ritual-receipt-drink > span[role="cell"]')].map(
          (el) => el.textContent,
        ),
        ['1', '₩0'],
      )
      assert.equal(receipt.querySelector('.ritual-receipt-total strong')!.textContent, '₩0')
      const date = receipt.querySelector('time')!
      assert.equal(date.getAttribute('datetime'), new Date(order.createdAt).toISOString())
      assert.ok(date.textContent!.includes('1970'), 'receipt date includes year')
      const bars = receipt.querySelector('.ritual-receipt-barcode')!
      assert.equal(bars.getAttribute('aria-hidden'), 'true')
      if (barcode)
        assert.equal(bars.innerHTML, barcode, 'order barcode stays stable across languages')
      barcode = bars.innerHTML
      assert.doesNotMatch(receipt.textContent!, /card number|approval|税号|승인번호/i)
    }
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})

test('printing bands copy the actual receipt order details rather than a separate placeholder', async () =>
  fixture(async (host, render) => {
    await render({ state: { ...base.state, stage: 'printing' } })
    await wait(80)
    const copy = host.querySelector('.receipt-paper-snapshot .ritual-receipt')!
    assert.ok(copy, 'actual final receipt subtree is cloned into the print mesh')
    assert.equal(copy.querySelectorAll('[role="columnheader"]').length, 3)
    assert.equal(copy.querySelector('.ritual-receipt-total strong')!.textContent, '₩0')
    assert.equal(copy.querySelectorAll('.ritual-receipt-barcode rect').length, 32)
  }))
