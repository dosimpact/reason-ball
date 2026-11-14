import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { build } from 'vite'
import { fileURLToPath } from 'node:url'
import { coffeeTotals } from '../src/pages/focus/model/coffeeRewards.ts'
import { defaults, fresh } from '../src/pages/focus/model/timer.ts'

const fakeRuntime = fileURLToPath(new URL('./fixtures/ritual-pixi-runtime.ts', import.meta.url))
await build({
  publicDir: false,
  plugins: [
    {
      name: 'ritual-gpu-only-fixture',
      enforce: 'pre',
      resolveId(source) {
        if (/(?:^|\/)pixiSceneRuntime(?:\.ts)?$/.test(source)) return fakeRuntime
      },
    },
  ],
  build: { ssr: 'src/app/App.tsx', outDir: 'node_modules/.cache/ritual-app', emptyOutDir: true },
  logLevel: 'silent',
})
process.env.NODE_ENV = 'development'
const window = new Window({ url: 'http://localhost:3000' })
Object.defineProperty(window.navigator, 'languages', { configurable: true, value: ['ko-KR'] })
Object.defineProperty(window.navigator, 'language', { configurable: true, value: 'ko-KR' })
let reducedMotionForTest = true
const reducedMotionListeners = new Set<() => void>()
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (media: string) => ({
    media,
    get matches() {
      return media.includes('prefers-reduced-motion') && reducedMotionForTest
    },
    onchange: null,
    addEventListener(_event: string, listener: () => void) {
      if (media.includes('prefers-reduced-motion')) reducedMotionListeners.add(listener)
    },
    removeEventListener(_event: string, listener: () => void) {
      reducedMotionListeners.delete(listener)
    },
    addListener(listener: () => void) {
      if (media.includes('prefers-reduced-motion')) reducedMotionListeners.add(listener)
    },
    removeListener(listener: () => void) {
      reducedMotionListeners.delete(listener)
    },
    dispatchEvent() {
      return true
    },
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
// happy-dom's partial WAAPI rejects canceled promises unlike browser handling;
// exercise Motion's real JS fallback by exposing no native animation API.
Object.defineProperty(window.Element.prototype, 'animate', { configurable: true, value: undefined })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  writable: true,
  value: true,
})
const audioStats = { created: 0, plays: 0, pauses: 0 }
let strictSeatGesture = false
let trustedSeatGesture = false
let deferredMusicPlay = false
let releaseMusicPlay: (() => void) | undefined
class AudioStub extends window.EventTarget {
  src = ''
  loop = false
  preload = 'none'
  volume = 1
  paused = true
  ended = false
  error = null
  currentTime = 0
  constructor() {
    super()
    audioStats.created++
  }
  async play() {
    if (strictSeatGesture && !trustedSeatGesture) throw Error('Playback requires seat gesture')
    audioStats.plays++
    if (deferredMusicPlay)
      await new Promise<void>((resolve) => {
        releaseMusicPlay = resolve
      })
    this.paused = false
    this.dispatchEvent(new window.Event('playing'))
  }
  pause() {
    this.paused = true
    audioStats.pauses++
    this.dispatchEvent(new window.Event('pause'))
  }
  removeAttribute(name: string) {
    if (name === 'src') this.src = ''
  }
  load() {}
}
Object.defineProperty(globalThis, 'Audio', { configurable: true, writable: true, value: AudioStub })
let nativeFullscreenCalls = 0
Object.defineProperty(window.HTMLElement.prototype, 'requestFullscreen', {
  configurable: true,
  value: () => {
    nativeFullscreenCalls++
    throw Error('Native fullscreen is forbidden in this flow')
  },
})
const { createElement, act, StrictMode } = await import('react')
const { createRoot } = await import('react-dom/client')
const { default: App } = await import('../node_modules/.cache/ritual-app/App.js')
const document = window.document
const order = { id: 'test-order', drinkId: 'cold-brew', temperature: 'iced', createdAt: 1000 }
const read = () => JSON.parse(localStorage.getItem('rain-room.v1')!)
const stage = () =>
  document.querySelector<HTMLElement>('[data-testid="rain-room-experience"]')?.dataset.stage
const wait = async (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
async function eventuallyStage(expected: string) {
  for (let i = 0; i < 30; i++) {
    if (stage() === expected) return
    await wait(30)
  }
  assert.equal(stage(), expected)
}
const click = async (target: string | HTMLElement) =>
  act(async () => {
    const element =
      typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
    assert.ok(element, `missing ${target}`)
    element.click()
  })
const buttonText = (container: string, text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(`${container} button`)].find(
    (button) =>
      button.textContent?.includes(text) || button.getAttribute('aria-label')?.includes(text),
  )!
async function fixture(
  saved: unknown,
  run: (host: HTMLElement) => Promise<void>,
  beforeMount?: () => void,
  strict = false,
) {
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  ;(window as any).__ritualObjectActivation = { accepted: false, calls: [] }
  localStorage.setItem('rain-room.language', 'ko')
  await act(async () =>
    window.dispatchEvent(
      new window.StorageEvent('storage', { key: 'rain-room.language', newValue: 'ko' }),
    ),
  )
  if (saved) localStorage.setItem('rain-room.v1', JSON.stringify(saved))
  beforeMount?.()
  audioStats.created = 0
  audioStats.plays = 0
  audioStats.pauses = 0
  nativeFullscreenCalls = 0
  ;(window as unknown as { __ritualGpu: unknown }).__ritualGpu = {
    constructed: 0,
    started: 0,
    destroyed: 0,
    alive: 0,
    maxAlive: 0,
  }
  document.body.innerHTML = '<div id="root"></div>'
  const host = document.getElementById('root')!,
    root = createRoot(host)
  try {
    await act(async () =>
      root.render(
        strict ? createElement(StrictMode, null, createElement(App)) : createElement(App),
      ),
    )
    await run(host)
  } finally {
    act(() => root.unmount())
    await wait(30)
    document.body.innerHTML = ''
  }
}
function assertOriginalBrand() {
  const brands = document.querySelectorAll('.ritual-experience .brand')
  assert.ok(brands.length >= 1)
  for (const brand of brands) {
    assert.equal(
      brand.textContent?.replace(/\s+/g, ' ').trim(),
      '◒ Rain Room',
      'ordering, device and receipt keep the original brand spelling and mark',
    )
    assert.equal(brand.querySelector('.brand-icon')?.textContent, '◒')
  }
  assert.equal(
    document.querySelector('.ritual-wordmark'),
    null,
    'the replacement lowercase wordmark and tagline are removed',
  )
}
async function orderColdBrew(printWait = 260) {
  assertOriginalBrand()
  for (let page = 0; page < 4; page++) {
    const drink = document.querySelector<HTMLElement>(
      '.ritual-menu-item[data-drink-id="cold-brew"]',
    )
    if (drink) {
      await click(drink)
      break
    }
    const next = document.querySelector<HTMLButtonElement>('.ritual-menu-next')!
    assert.equal(next.disabled, false, 'cold brew remains reachable without scrolling')
    await click(next)
  }
  assert.equal(read().ritual.drinkId, 'cold-brew')
  assert.ok(
    document.querySelector('.ritual-temperature') === null,
    'temperature selection is removed from ordering',
  )
  await click('.ritual-order-draft .ritual-primary')
  assert.equal(stage(), 'checkout')
  assertOriginalBrand()
  const submit = document.querySelector<HTMLButtonElement>('.ritual-checkout .ritual-primary')!
  // Inspect the transient reduced-print frame before yielding to its 180ms timer.
  act(() => {
    submit.click()
    submit.click()
  })
  assert.equal(stage(), 'printing')
  const receiptPaper = document.querySelector<HTMLElement>('.ritual-receipt-print-target')!
  assert.ok(receiptPaper, 'the final receipt supplies the same paper and layout while printing')
  assert.equal(receiptPaper.inert, true, 'printing cannot activate time or seat controls')
  assert.equal(receiptPaper.getAttribute('aria-hidden'), 'true')
  const id = read().ritual.order.id
  assert.equal(read().ritual.order.drinkId, 'cold-brew')
  assert.equal(read().ritual.order.temperature, 'iced')
  await wait(printWait)
  assert.equal(stage(), 'receipt')
  assert.equal(
    document.querySelector('.ritual-receipt'),
    receiptPaper,
    'printing hands off to the same full-sized receipt',
  )
  assert.equal(receiptPaper.inert, false)
  assert.equal(receiptPaper.hasAttribute('aria-hidden'), false)
  assert.equal(document.querySelector('.receipt-printer'), null)
  assertOriginalBrand()
  assert.equal(read().ritual.order.id, id)
}

async function enterRoom(paused = false) {
  await orderColdBrew()
  await click('.ritual-seat-button')
  await act(async () => window.dispatchEvent(new window.Event('test-scene-ready')))
  await eventuallyStage('room')
  // Sessions now run until natural completion; the compact music player does not pause focus.
  void paused
}

async function openRoomSetting(label: string) {
  const gear = document.querySelector<HTMLElement>('.ritual-room-settings')!
  if (gear.getAttribute('aria-expanded') !== 'true') await click(gear)
  await click(buttonText('.header-settings-panel', label))
}

async function eventuallyScene(id: string) {
  for (let i = 0; i < 50; i++) {
    if (
      document.querySelector<HTMLCanvasElement>('canvas[data-test-gpu]')?.dataset.backgroundId ===
      id
    )
      return
    await wait(20)
  }
  assert.equal(
    document.querySelector<HTMLCanvasElement>('canvas[data-test-gpu]')?.dataset.backgroundId,
    id,
  )
}

async function eventuallySceneTransition(phase: string) {
  for (let i = 0; i < 50; i++) {
    if (document.querySelector<HTMLElement>('.ritual-scene-transition')?.dataset.phase === phase)
      return
    await wait(20)
  }
  assert.equal(
    document.querySelector<HTMLElement>('.ritual-scene-transition')?.dataset.phase,
    phase,
  )
}

test('actual App orders once, waits for GPU and seating, starts once, and preserves settings/music/language state', async () => {
  await fixture(null, async (host) => {
    assert.equal(stage(), 'menu')
    assert.equal(audioStats.plays, 0)
    const drinks = new Set<string>()
    for (let page = 0; page < 4; page++) {
      for (const drink of document.querySelectorAll<HTMLElement>('.ritual-menu-item'))
        drinks.add(drink.dataset.drinkId!)
      const next = document.querySelector<HTMLButtonElement>('.ritual-menu-next')!
      if (!next || next.disabled) break
      await click(next)
    }
    assert.equal(drinks.size, 10, 'all ten drinks remain accessible through compact pages')
    while (document.querySelector<HTMLButtonElement>('.ritual-menu-prev')?.disabled === false)
      await click('.ritual-menu-prev')
    await orderColdBrew()
    assert.equal(document.querySelectorAll('.ritual-focus-presets button').length, 3)
    assert.deepEqual(
      [...document.querySelectorAll('.ritual-focus-presets button')].map(
        (button) => button.firstChild?.textContent,
      ),
      ['25분', '55분', '직접 입력'],
    )
    await click(buttonText('.ritual-focus-presets', '25'))
    assert.equal(read().settings.focus, 25)
    await click(buttonText('.ritual-focus-presets', '55'))
    assert.equal(read().settings.focus, 55)
    assert.equal(read().session.status, 'idle')
    assert.equal(read().session.deadline, null)
    assert.equal(audioStats.plays, 0)
    await click('.ritual-seat-button')
    assert.equal(stage(), 'seating')
    assert.equal(host.querySelectorAll('[data-testid="cafe-scene"]').length, 1)
    await wait(260)
    assert.equal(stage(), 'seating', 'overlay completion alone cannot start focus')
    assert.equal(read().session.status, 'idle')
    assert.equal(audioStats.plays, 1)
    await act(async () => window.dispatchEvent(new window.Event('test-scene-ready')))
    await eventuallyStage('room')
    assert.equal(
      stage(),
      'room',
      JSON.stringify({
        status: host.querySelector('[data-testid=cafe-scene]')?.getAttribute('data-render-status'),
      }),
    )
    assert.equal(read().session.status, 'running')
    const deadline = read().session.deadline
    assert.ok(Math.abs(deadline - Date.now() - 55 * 60000) < 1500)
    assert.equal(audioStats.plays, 1)
    assert.equal(audioStats.created, 1)
    await act(async () => {
      window.dispatchEvent(new window.Event('test-scene-ready'))
      window.dispatchEvent(new window.Event('test-scene-ready'))
    })
    assert.equal(read().session.deadline, deadline)
    assert.equal(audioStats.plays, 1)
    assert.equal(host.querySelectorAll('[data-testid="cafe-scene"]').length, 1)
    assert.equal(document.querySelectorAll('canvas[data-test-gpu]').length, 1)
    const originalCanvas = document.querySelector('canvas[data-test-gpu]')
    assert.equal(host.inert, false)
    assert.equal(nativeFullscreenCalls, 0)
    assert.equal(
      (window as unknown as { __ritualGpu: { maxAlive: number } }).__ritualGpu.maxAlive,
      1,
    )
    assert.equal(read().session.status, 'running')
    assert.ok(read().session.deadline > Date.now())
    const opener = document.querySelector<HTMLElement>('.ritual-room-settings')!
    await click(opener)
    assert.equal(
      document.querySelector('[role="dialog"]'),
      null,
      'the gear opens the original flyout, not an overview sheet',
    )
    assert.equal(opener.getAttribute('aria-expanded'), 'true')
    assert.equal(
      host.querySelector('[data-testid="cafe-scene"]')?.getAttribute('data-paused'),
      'false',
    )
    await openRoomSetting('시간')
    assert.ok(document.querySelector('[role="dialog"]'))
    const focusPresets = document.querySelector('.settings-dialog fieldset:first-of-type .presets')!
    assert.equal(focusPresets.querySelectorAll('button').length, 3)
    assert.match(focusPresets.textContent!, /25분55분직접 입력/)
    const focusInput = document.querySelector<HTMLInputElement>(
      '.settings-dialog input[aria-label="집중 시간 직접 입력"]',
    )!
    await click(focusPresets.querySelectorAll<HTMLButtonElement>('button')[2]!)
    assert.ok(
      document.activeElement === focusInput,
      'direct input focuses the actual duration field',
    )
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(
        focusInput,
        '',
      )
      focusInput.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
    assert.equal(focusInput.getAttribute('aria-invalid'), 'true')
    assert.equal(
      document.querySelector<HTMLButtonElement>('.settings-dialog button[type="submit"]')!.disabled,
      true,
    )
    assert.equal(read().settings.focus, 55, 'invalid detail drafts never reset the saved timer')
    assert.equal(
      host.querySelector('[data-testid="cafe-scene"]')?.getAttribute('data-paused'),
      'true',
    )
    await click(buttonText('.settings-dialog fieldset:first-of-type', '25'))
    await click('.settings-dialog button[type="submit"]')
    await wait(30)
    assert.equal(read().settings.focus, 25)
    assert.equal(read().session.status, 'running')
    assert.ok(read().session.deadline > Date.now())
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(document.activeElement, opener)
    assert.equal(
      document.querySelector('canvas[data-test-gpu]'),
      originalCanvas,
      'settings keeps the same GPU canvas',
    )
    assert.equal(audioStats.plays, 1)
    assert.equal(document.querySelectorAll('.ritual-room-playback .playback-mode').length, 1)
    await click('.ritual-room-playback .playback-mode')
    assert.equal(read().settings.playbackMode, 'shuffle')
    await click('.ritual-room-playback .playback-mode')
    assert.equal(read().settings.playbackMode, 'sequential')
    assert.equal(audioStats.plays, 1)
    await openRoomSetting('음악')
    const volume = document.querySelector<HTMLInputElement>(
      '.settings-dialog input[aria-label="음악 볼륨"]',
    )!
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(
        volume,
        '0.42',
      )
      volume.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
    assert.equal(read().settings.music, 0.42)
    assert.equal(audioStats.plays, 1)
    await click('.settings-dialog .close')
    await wait(30)
    await openRoomSetting('언어')
    await click('input[name="app-language"][value="en"]')
    assert.equal(document.documentElement.lang, 'en')
    assert.equal(read().session.status, 'running')
    assert.equal(audioStats.created, 1)
    assert.equal(audioStats.plays, 1)
    await click('.settings-dialog .close')
    await wait(30)
    assert.equal(document.activeElement, opener)
    assert.match(opener.getAttribute('aria-label')!, /Settings/)
  })
})

test('GPU readiness alone still waits for seating animation and failure returns to an idle receipt', async () => {
  const saved = {
    version: 4,
    settings: defaults,
    session: fresh('focus', defaults),
    ritual: { stage: 'receipt', drinkId: 'cold-brew', temperature: 'iced', order },
  }
  await fixture(saved, async () => {
    await orderColdBrew()
    await click('.ritual-seat-button')
    await act(async () => window.dispatchEvent(new window.Event('test-scene-ready')))
    assert.equal(stage(), 'seating', 'GPU ready cannot bypass overlay')
    assert.equal(read().session.status, 'idle')
    assert.equal(audioStats.plays, 1)
    await eventuallyStage('room')
    assert.equal(stage(), 'room')
    assert.equal(audioStats.plays, 1)
  })
  await fixture(saved, async () => {
    await orderColdBrew()
    await click('.ritual-seat-button')
    await act(async () => window.dispatchEvent(new window.Event('test-scene-error')))
    assert.equal(stage(), 'receipt')
    assert.equal(read().session.status, 'idle')
    assert.equal(read().session.deadline, null)
    assert.equal(audioStats.plays, 1)
    assert.ok(audioStats.pauses > 0)
    assert.ok(document.querySelector('.ritual-error[role="alert"]'))
  })
})

test('settings gear restores the original disclosure without pausing the scene and opens details directly', async () => {
  await fixture(null, async () => {
    await enterRoom()
    const gear = document.querySelector<HTMLElement>('.ritual-room-settings')!
    const originalCanvas = document.querySelector('canvas[data-test-gpu]')
    const deadline = read().session.deadline
    const plays = audioStats.plays
    const historyLength = window.history.length
    await click(gear)
    const panel = document.querySelector<HTMLElement>('.header-settings-panel')!
    assert.equal(gear.getAttribute('aria-expanded'), 'true')
    assert.equal(panel.hidden, false)
    assert.equal(panel.inert, false)
    assert.equal(panel.querySelectorAll('button').length, 8)
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(
      window.history.length,
      historyLength,
      'disclosing quick actions never creates a modal history entry',
    )
    assert.equal(
      document.querySelector('[data-testid="cafe-scene"]')?.getAttribute('data-paused'),
      'false',
    )
    await wait(2600)
    assert.equal(
      document.querySelector('.ritual-room-header')?.getAttribute('data-visible'),
      'true',
      'open quick actions hold the header visible',
    )
    await act(async () =>
      gear.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      ),
    )
    assert.equal(document.activeElement, panel.querySelector('button'))
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      ),
    )
    assert.equal(panel.hidden, true)
    assert.equal(
      document.activeElement,
      gear,
      'the room Escape handler must not steal disclosure focus',
    )
    await click(gear)
    await act(async () =>
      document
        .querySelector('.ritual-room-random')!
        .dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true })),
    )
    assert.equal(panel.hidden, true)
    for (const label of ['환경음', '나만의 공간', '커피 쿠폰', '나의 컬렉션']) {
      await openRoomSetting(label)
      assert.ok(document.querySelector('[role="dialog"]'), `direct detail for ${label}`)
      assert.equal(panel.hidden, true)
      assert.equal(document.querySelector('.ritual-settings-menu'), null)
      await click('.settings-dialog .close')
      await wait(30)
      assert.equal(document.activeElement, gear)
      assert.equal(document.querySelector('canvas[data-test-gpu]'), originalCanvas)
    }
    await click(gear)
    assert.equal(panel.querySelectorAll('button').length, 8)
    for (const label of ['주문 효과음 끄기', '주문 효과음 켜기'])
      assert.equal(
        [...panel.querySelectorAll('button')].some(
          (button) => button.getAttribute('aria-label') === label,
        ),
        false,
      )
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(read().session.deadline, deadline)
    assert.equal(read().session.status, 'running')
    assert.equal(audioStats.plays, plays)
  })
})

test('random space changes stay covered until the new renderer is ready without restarting timer or music, and failures reveal retry', async () => {
  await fixture(
    null,
    async () => {
      await enterRoom()
      const saved = read()
      const oldCanvas = document.querySelector<HTMLCanvasElement>('canvas[data-test-gpu]')!
      const player = document.querySelector('.ritual-room-player')
      const plays = audioStats.plays
      const pauses = audioStats.pauses
      const random = document.querySelector<HTMLButtonElement>('.ritual-room-random')!
      await act(async () => {
        random.click()
        random.click()
      })
      const next = read().settings.background
      assert.notEqual(next, saved.settings.background)
      await eventuallyScene(next)
      await eventuallySceneTransition('loading')
      assert.equal(random.disabled, true)
      assert.equal(
        document.querySelector<HTMLButtonElement>('.ritual-room-music-toggle')!.disabled,
        false,
      )
      assert.equal(
        document.querySelector<HTMLButtonElement>('.ritual-room-music-toggle')!.disabled,
        false,
      )
      assert.equal(document.querySelector('.ritual-room-player'), player)
      assert.equal(document.querySelector('.ritual-room-art')?.getAttribute('aria-busy'), 'true')
      assert.equal(oldCanvas.isConnected, false)
      assert.equal(document.querySelectorAll('canvas[data-test-gpu]').length, 1)
      assert.equal(
        (window as unknown as { __ritualGpu: { maxAlive: number } }).__ritualGpu.maxAlive,
        1,
      )
      await wait(120)
      assert.equal(
        document.querySelector<HTMLElement>('.ritual-scene-transition')?.dataset.phase,
        'loading',
      )
      assert.equal(read().session.deadline, saved.session.deadline)
      assert.equal(audioStats.plays, plays)
      assert.equal(audioStats.pauses, pauses)
      await act(async () => window.dispatchEvent(new window.Event('test-scene-ready')))
      await eventuallySceneTransition('idle')
      assert.equal(random.disabled, false)
      assert.equal(document.querySelector('.ritual-room-art')?.getAttribute('aria-busy'), 'false')
      assert.equal(read().session.status, 'running')
      assert.equal(read().session.deadline, saved.session.deadline)
      assert.equal(audioStats.plays, plays)
      await click(random)
      await eventuallyScene(read().settings.background)
      await eventuallySceneTransition('loading')
      await act(async () => window.dispatchEvent(new window.Event('test-scene-error')))
      await eventuallySceneTransition('idle')
      assert.ok(
        document.querySelector('.pixi-render-error button'),
        'render failure keeps its retry control accessible',
      )
      assert.equal(random.disabled, false)
      assert.equal(read().session.deadline, saved.session.deadline)
      assert.equal(audioStats.plays, plays)
      assert.equal(audioStats.pauses, pauses)
      assert.equal(document.querySelectorAll('canvas[data-test-gpu]').length, 1)
    },
    undefined,
    true,
  )
})

test('every refresh returns to the counter with no timer or autoplay while preserving preferences and earned coffee', async () => {
  const completed = {
    earned: {
      id: 'earned',
      durationMs: 1500000,
      activeMs: 1500000,
      deadline: 1000,
      completedAt: 1000,
    },
  }
  const savedSettings = {
    ...defaults,
    focus: 50,
    rest: 10,
    music: 0.42,
    background: 'study-library',
  }
  for (const persistedStage of ['menu', 'checkout', 'printing', 'receipt', 'seating', 'room']) {
    for (const status of ['idle', 'running', 'paused', 'complete'] as const) {
      await fixture(
        {
          version: 4,
          settings: savedSettings,
          session: {
            ...fresh('focus', savedSettings),
            status,
            deadline: status === 'running' ? Date.now() + 100000 : null,
          },
          ritual: { stage: persistedStage, drinkId: 'cold-brew', temperature: 'iced', order },
          ritualMuted: true,
        },
        async (host) => {
          assert.equal(stage(), 'menu', `${persistedStage}/${status}`)
          assert.equal(document.querySelectorAll('.ritual-menu-item').length, 10)
          assert.ok(document.querySelector('.ritual-menu-page') === null)
          assert.equal(
            document.querySelector('[data-drink-id="cold-brew"]')?.getAttribute('aria-pressed'),
            'true',
          )
          assert.equal(host.querySelector('[data-testid="immersive-room"]'), null)
          assert.equal(read().ritual.order, null)
          assert.equal(read().ritual.drinkId, 'cold-brew')
          assert.equal(read().session.status, 'idle')
          assert.equal(read().session.deadline, null)
          assert.deepEqual(read().settings, savedSettings)
          assert.equal(read().ritualMuted, true)
          assert.equal(audioStats.plays, 0)
          assert.deepEqual(
            JSON.parse(localStorage.getItem('rain-room.coffee.v1')!).completed,
            completed,
          )
        },
        () =>
          localStorage.setItem(
            'rain-room.coffee.v1',
            JSON.stringify({ version: 1, completed, active: {} }),
          ),
      )
    }
  }
  await fixture(
    {
      version: 3,
      settings: defaults,
      session: { ...fresh('focus', defaults), status: 'running', deadline: Date.now() + 100000 },
    },
    async () => {
      assert.equal(stage(), 'menu')
      assert.equal(read().session.status, 'idle')
      assert.equal(read().ritual.order, null)
      assert.equal(audioStats.plays, 0)
    },
  )
})

test('mobile visual viewport follows the keyboard and restores document styles after leaving the experience', async () => {
  const previousViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')
  const previousBodyOverflow = document.body.style.overflow
  const previousDocumentOverflow = document.documentElement.style.overflow
  const previousHeight = document.documentElement.style.getPropertyValue(
    '--rain-room-viewport-height',
  )
  const previousTop = document.documentElement.style.getPropertyValue('--rain-room-viewport-top')
  const previousWidth = document.documentElement.style.getPropertyValue(
    '--rain-room-viewport-width',
  )
  const previousLeft = document.documentElement.style.getPropertyValue('--rain-room-viewport-left')
  const visualViewport = Object.assign(new window.EventTarget(), {
    width: 360,
    height: 568,
    offsetLeft: 0,
    offsetTop: 0,
  })
  try {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    document.body.style.overflow = 'auto'
    document.documentElement.style.overflow = 'clip'
    document.documentElement.style.setProperty('--rain-room-viewport-height', '777px')
    document.documentElement.style.setProperty('--rain-room-viewport-top', '7px')
    document.documentElement.style.setProperty('--rain-room-viewport-width', '999px')
    document.documentElement.style.setProperty('--rain-room-viewport-left', '9px')
    await fixture(null, async () => {
      const root = document.querySelector<HTMLElement>('.rain-room-experience')!
      assert.equal(document.body.style.overflow, 'hidden')
      assert.equal(document.documentElement.style.overflow, 'hidden')
      assert.equal(root.style.getPropertyValue('--rain-room-viewport-height'), '568px')
      assert.equal(root.style.getPropertyValue('--rain-room-viewport-width'), '360px')
      visualViewport.height = 290
      visualViewport.offsetTop = 48
      await act(async () => visualViewport.dispatchEvent(new window.Event('resize')))
      assert.equal(root.style.getPropertyValue('--rain-room-viewport-height'), '290px')
      assert.equal(
        document.documentElement.style.getPropertyValue('--rain-room-viewport-top'),
        '48px',
      )
      visualViewport.offsetTop = 72
      visualViewport.offsetLeft = 18
      visualViewport.width = 320
      await act(async () => visualViewport.dispatchEvent(new window.Event('scroll')))
      assert.equal(root.style.getPropertyValue('--rain-room-viewport-top'), '72px')
      assert.equal(root.style.getPropertyValue('--rain-room-viewport-left'), '18px')
      assert.equal(root.style.getPropertyValue('--rain-room-viewport-width'), '320px')
      assert.equal(
        document.documentElement.style.getPropertyValue('--rain-room-viewport-left'),
        '18px',
        'portaled settings share the same visual viewport coordinates',
      )
      assert.equal(stage(), 'menu', 'keyboard and viewport events never reset the ordering flow')
      Object.assign(visualViewport, { width: 667, height: 320, offsetTop: 0, offsetLeft: 0 })
      await act(async () => window.dispatchEvent(new window.Event('orientationchange')))
      assert.equal(root.style.getPropertyValue('--rain-room-viewport-width'), '667px')
      assert.equal(root.style.getPropertyValue('--rain-room-viewport-height'), '320px')
      await orderColdBrew()
      await click('.ritual-seat-button')
      await eventuallyScene(read().settings.background)
      await act(async () => window.dispatchEvent(new window.Event('test-scene-ready')))
      await eventuallyStage('room')
      const player = document.querySelector('.ritual-room-player')
      const header = document.querySelector('.ritual-room-header')
      assert.ok(player && header)
      const deadline = read().session.deadline
      const plays = audioStats.plays
      Object.assign(visualViewport, { width: 390, height: 664, offsetTop: 24, offsetLeft: 0 })
      await act(async () => visualViewport.dispatchEvent(new window.Event('resize')))
      assert.equal(root.style.getPropertyValue('--rain-room-viewport-height'), '664px')
      assert.equal(root.style.getPropertyValue('--rain-room-viewport-top'), '24px')
      assert.equal(document.querySelector('.ritual-room-player'), player)
      assert.equal(document.querySelector('.ritual-room-header'), header)
      assert.equal(read().session.deadline, deadline)
      assert.equal(audioStats.plays, plays, 'rotation and browser chrome never restart playback')
    })
    assert.equal(document.body.style.overflow, 'auto')
    assert.equal(document.documentElement.style.overflow, 'clip')
    assert.equal(
      document.documentElement.style.getPropertyValue('--rain-room-viewport-height'),
      '777px',
    )
    assert.equal(document.documentElement.style.getPropertyValue('--rain-room-viewport-top'), '7px')
    assert.equal(
      document.documentElement.style.getPropertyValue('--rain-room-viewport-width'),
      '999px',
    )
    assert.equal(
      document.documentElement.style.getPropertyValue('--rain-room-viewport-left'),
      '9px',
    )
  } finally {
    if (previousViewport) Object.defineProperty(window, 'visualViewport', previousViewport)
    else Reflect.deleteProperty(window, 'visualViewport')
    document.body.style.overflow = previousBodyOverflow
    document.documentElement.style.overflow = previousDocumentOverflow
    if (previousHeight)
      document.documentElement.style.setProperty('--rain-room-viewport-height', previousHeight)
    else document.documentElement.style.removeProperty('--rain-room-viewport-height')
    if (previousTop)
      document.documentElement.style.setProperty('--rain-room-viewport-top', previousTop)
    else document.documentElement.style.removeProperty('--rain-room-viewport-top')
    if (previousWidth)
      document.documentElement.style.setProperty('--rain-room-viewport-width', previousWidth)
    else document.documentElement.style.removeProperty('--rain-room-viewport-width')
    if (previousLeft)
      document.documentElement.style.setProperty('--rain-room-viewport-left', previousLeft)
    else document.documentElement.style.removeProperty('--rain-room-viewport-left')
  }
})
test.after(async () => {
  await window.happyDOM.abort()
})

test('rapid settings close and reopen survives programmatic history back; browser Back closes the current sheet', async () => {
  await fixture(
    {
      version: 4,
      settings: defaults,
      session: { ...fresh('focus', defaults), status: 'paused' },
      ritual: { stage: 'room', drinkId: 'cold-brew', temperature: 'iced', order },
    },
    async () => {
      await enterRoom(true)
      const opener = document.querySelector<HTMLElement>('.ritual-room-settings')!
      await openRoomSetting('시간')
      assert.ok(document.querySelector('[role="dialog"]'))
      await click('.settings-dialog .close') // Deliberately no navigation-settling wait before reopening.
      await openRoomSetting('시간')
      await new Promise((resolve) => setTimeout(resolve, 30))
      assert.ok(
        document.querySelector('[role="dialog"]'),
        'late programmatic popstate must not close the newly opened dialog',
      )
      assert.equal(stage(), 'room')
      act(() => window.history.back())
      await new Promise((resolve) => setTimeout(resolve, 30))
      await act(async () => {})
      assert.equal(document.querySelector('[role="dialog"]'), null)
      assert.equal(stage(), 'room', 'Back closes the sheet before leaving the room')
      assert.equal(window.location.pathname, '/')
      assert.equal(document.activeElement, opener)
      assert.equal(read().session.status, 'running')
      assert.equal(audioStats.plays, 1)
    },
  )
})

test('receipt custom time validates drafts, applies atomically, and cancels on close or browser Back', async () => {
  await fixture(
    {
      version: 4,
      settings: defaults,
      session: fresh('focus', defaults),
      ritual: { stage: 'receipt', drinkId: 'cold-brew', temperature: 'iced', order },
    },
    async () => {
      await orderColdBrew()
      const originalTimes = { focus: read().settings.focus, rest: read().settings.rest }
      const customOpener = document.querySelector<HTMLElement>('.ritual-custom-time-open')!
      await click(customOpener)
      const field = (label = '집중 시간 직접 입력') =>
        document.querySelector<HTMLInputElement>(
          `.ritual-custom-time-dialog input[aria-label="${label}"]`,
        )!
      const input = field()
      const seat = document.querySelector<HTMLButtonElement>('.ritual-seat-button')!
      const setValue = async (value: string, label = '집중 시간 직접 입력') =>
        act(async () => {
          const current = field(label)
          current.focus()
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(
            current,
            value,
          )
          current.dispatchEvent(new window.Event('input', { bubbles: true }))
        })
      await setValue('')
      assert.equal(input.value, '', 'clearing a field must not immediately replace the draft')
      assert.equal(input.getAttribute('aria-invalid'), 'true')
      assert.equal(seat.disabled, true)
      await click(seat)
      assert.equal(stage(), 'receipt')
      assert.equal(read().session.status, 'idle')
      await setValue('25')
      assert.equal(
        read().settings.focus,
        originalTimes.focus,
        'editing a valid draft does not apply it',
      )
      assert.equal(input.getAttribute('aria-invalid'), 'false')
      assert.equal(seat.disabled, false)
      assert.equal(read().session.status, 'idle')
      assert.equal(read().session.deadline, null)
      await setValue('181')
      assert.equal(input.getAttribute('aria-invalid'), 'true')
      assert.equal(seat.disabled, true)
      assert.equal(
        read().settings.focus,
        originalTimes.focus,
        'invalid draft must not update persisted settings',
      )
      await act(async () => input.blur())
      assert.equal(input.value, '25')
      assert.equal(input.getAttribute('aria-invalid'), 'false')
      assert.equal(seat.disabled, false)
      assert.equal(stage(), 'receipt')
      assert.equal(audioStats.plays, 0)
      await click('.ritual-custom-time-dialog .close')
      assert.ok(document.querySelector('.ritual-custom-time-dialog') === null)
      assert.equal(seat.disabled, false)
      assert.equal(
        read().settings.focus,
        originalTimes.focus,
        'closing cancels the valid uncommitted draft',
      )
      await click(customOpener) // Reopen before the previous programmatic history.back settles.
      await wait(30)
      assert.ok(
        document.querySelector('.ritual-custom-time-dialog'),
        'late close navigation must not dismiss a new editor',
      )
      assert.equal(field().value, String(originalTimes.focus))
      await setValue('25')
      await setValue('7', '휴식 시간 직접 입력')
      assert.equal(read().settings.rest, originalTimes.rest)
      await click('.ritual-custom-time-dialog .save')
      await wait(30)
      assert.ok(
        document.querySelector('.ritual-custom-time-dialog') === null,
        'Apply closes the real controlled dialog',
      )
      assert.ok(
        document.activeElement === customOpener,
        'Apply restores the direct-input trigger focus',
      )
      assert.equal(read().settings.focus, 25)
      assert.equal(read().settings.rest, 7)
      assert.match(
        document.querySelector('.ritual-time-field:last-of-type legend')!.textContent!,
        /7분/,
      )
      await click(customOpener)
      await setValue('55')
      await setValue('9', '휴식 시간 직접 입력')
      act(() => window.history.back())
      await wait(30)
      assert.ok(
        document.querySelector('.ritual-custom-time-dialog') === null,
        'browser and WebView Back dismiss the editor',
      )
      assert.equal(read().settings.focus, 25)
      assert.equal(read().settings.rest, 7)
      assert.equal(read().session.status, 'idle')
      assert.equal(stage(), 'receipt')
      assert.equal(audioStats.plays, 0)
    },
  )
})

test('returning to the counter confirms an active session, Stay preserves it, and confirmation stops music without credits', async () => {
  await fixture(
    {
      version: 4,
      settings: defaults,
      session: { ...fresh('focus', defaults), status: 'paused' },
      ritual: { stage: 'room', drinkId: 'cold-brew', temperature: 'iced', order },
    },
    async () => {
      await enterRoom(true)
      assert.equal(audioStats.plays, 1)
      const currentOrderId = read().ritual.order.id
      const opener = document.querySelector<HTMLElement>('.ritual-room-settings')!
      const rewardsBefore = JSON.parse(
        localStorage.getItem('rain-room.coffee.v1') || '{}',
      ).completed
      await click(opener)
      await click('.ritual-return-counter')
      assert.ok(document.querySelector('.ritual-return-confirm'))
      assert.equal(stage(), 'room')
      assert.equal(read().session.status, 'running')
      const stay = document.querySelectorAll<HTMLButtonElement>('.ritual-return-confirm button')[1]!
      await click(stay)
      await wait(30)
      assert.equal(document.querySelector('[role="dialog"]'), null)
      assert.equal(document.activeElement, opener)
      assert.equal(read().ritual.order.id, currentOrderId)
      assert.equal(read().session.status, 'running')
      await click(opener)
      await click('.ritual-return-counter')
      const pausesBefore = audioStats.pauses
      await click('.ritual-return-confirm .primary')
      assert.equal(stage(), 'menu')
      assert.equal(read().session.status, 'idle')
      assert.equal(read().session.deadline, null)
      assert.equal(read().ritual.order, null)
      assert.ok(audioStats.pauses > pausesBefore, 'returning to counter stops music')
      assert.deepEqual(
        JSON.parse(localStorage.getItem('rain-room.coffee.v1') || '{}').completed,
        rewardsBefore,
        'return action must not mint completion credits',
      )
      assert.equal(document.querySelector('[role="dialog"]'), null)
    },
  )
})

test('home activation and real print graphs respect reduced/normal feed, mute, and late permission cleanup', async () => {
  const previous = globalThis.AudioContext
  const contexts: any[] = []
  let deferred = false,
    release: (() => void) | undefined
  class CueContext {
    state = 'suspended'
    currentTime = 0
    sampleRate = 8000
    destination = {}
    sources: any[] = []
    constructor() {
      contexts.push(this)
    }
    resume() {
      if (deferred)
        return new Promise<void>((resolve) => {
          release = () => {
            this.state = 'running'
            resolve()
          }
        })
      this.state = 'running'
      return Promise.resolve()
    }
    close() {
      this.state = 'closed'
      return Promise.resolve()
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        disconnect() {},
      }
    }
    createBiquadFilter() {
      return {
        frequency: { setValueAtTime() {} },
        Q: { setValueAtTime() {} },
        connect() {},
        disconnect() {},
      }
    }
    createBuffer(_channels: number, length: number) {
      return { getChannelData: () => new Float32Array(length) }
    }
    source() {
      const node = {
        starts: 0,
        onended: null as null | (() => void),
        timer: undefined as ReturnType<typeof setTimeout> | undefined,
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() {
          this.starts++
        },
        stop(time?: number) {
          if (time === undefined) clearTimeout(this.timer)
          else this.timer = setTimeout(() => this.onended?.(), time * 1000)
        },
      }
      this.sources.push(node)
      return node
    }
    createOscillator() {
      return this.source()
    }
    createBufferSource() {
      return this.source()
    }
  }
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    writable: true,
    value: CueContext,
  })
  try {
    await fixture(
      null,
      async (host) => {
        await act(async () =>
          host
            .querySelector('.rain-room-experience')!
            .dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true })),
        )
        assert.equal(contexts.length, 1)
        assert.equal(contexts[0].sources.length, 0, 'activation must not play any sound')
        await orderColdBrew()
        assert.equal(
          contexts[0].sources.filter((s: any) => s.starts).length,
          2,
          'one real noise+motor print graph, despite duplicate order click and reduced completion',
        )
        assert.equal(audioStats.plays, 0, 'printing does not autoplay music')
      },
      undefined,
      true,
    )
    const count = contexts.length
    await fixture({ version: 4, settings: defaults, ritualMuted: true }, async () => {
      await orderColdBrew()
    })
    assert.equal(contexts.length, count, 'saved mute avoids allocating a cue context')
    await fixture({ version: 4, settings: defaults, ritualMuted: true }, async () => {
      await click(document.querySelector<HTMLButtonElement>('[aria-label="주문 효과음 켜기"]')!)
      assert.equal(read().ritualMuted, false)
      await orderColdBrew()
      assert.equal(
        contexts.at(-1).sources.filter((s: any) => s.starts).length,
        2,
        'unmute gesture prepares engine using new preference synchronously',
      )
    })
    await act(async () => {
      reducedMotionForTest = false
      for (const listener of reducedMotionListeners) listener()
    })
    await fixture(null, async () => {
      await orderColdBrew(3700)
      assert.equal(
        contexts.at(-1).sources.filter((s: any) => s.starts).length,
        10,
        'all five normal feed cues each start one noise and one motor',
      )
      assert.equal(audioStats.plays, 0)
    })
    await act(async () => {
      reducedMotionForTest = true
      for (const listener of reducedMotionListeners) listener()
    })
    deferred = true
    await fixture(null, async () => {
      await orderColdBrew()
      assert.equal(stage(), 'receipt')
      await act(async () => release?.())
      assert.equal(
        contexts.at(-1).sources.length,
        0,
        'permission resolved after printing; no late sound',
      )
    })
    await fixture(null, async () => {
      await orderColdBrew()
    })
    const disposed = contexts.at(-1)
    await act(async () => release?.())
    assert.equal(disposed.sources.length, 0, 'unmounted print cannot play after a delayed resume')
  } finally {
    reducedMotionForTest = true
    for (const listener of reducedMotionListeners) listener()
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: previous,
    })
  }
})

test('seat gesture starts native music and ambient once before GPU readiness, and failure/unmount cancel late playback', async () => {
  const oldContext = globalThis.AudioContext,
    oldFetch = globalThis.fetch
  let ambientResumes = 0,
    ambientStarts = 0,
    ambientStops = 0
  const audioElements: AudioStub[] = []
  const oldPlay = AudioStub.prototype.play
  AudioStub.prototype.play = function () {
    audioElements.push(this)
    return oldPlay.call(this)
  }
  class GestureContext {
    ambientContext = false
    state = 'suspended'
    currentTime = 0
    sampleRate = 8000
    destination = {}
    resume() {
      assert.equal(
        trustedSeatGesture,
        true,
        'native resume is called synchronously inside the seat handler',
      )
      this.state = 'running'
      if (this.ambientContext) ambientResumes++
      return Promise.resolve()
    }
    suspend() {
      this.state = 'suspended'
      return Promise.resolve()
    }
    close() {
      this.state = 'closed'
      return Promise.resolve()
    }
    node() {
      const context = this
      const n: any = {
        gain: {
          value: 0,
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
          setTargetAtTime() {},
        },
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        Q: { setValueAtTime() {} },
        connect() {
          return n
        },
        disconnect() {},
        start() {
          if (context.ambientContext) ambientStarts++
        },
        stop() {
          if (context.ambientContext) ambientStops++
        },
      }
      return n
    }
    createGain() {
      return this.node()
    }
    createDynamicsCompressor() {
      this.ambientContext = true
      return { ...this.node(), threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 } }
    }
    createBufferSource() {
      return this.node()
    }
    createOscillator() {
      return this.node()
    }
    createBiquadFilter() {
      return this.node()
    }
    createBuffer(_channels: number, length: number) {
      return { getChannelData: () => new Float32Array(length) }
    }
    decodeAudioData() {
      return Promise.resolve({ duration: 1, numberOfChannels: 1 })
    }
  }
  const seatGesture = async (duplicate = false) =>
    act(async () => {
      const button = document.querySelector<HTMLButtonElement>('.ritual-seat-button')!
      trustedSeatGesture = true
      try {
        button.click()
        if (duplicate) button.click()
      } finally {
        trustedSeatGesture = false
      }
    })
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    writable: true,
    value: GestureContext,
  })
  globalThis.fetch = (async () => ({
    ok: true,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as typeof fetch
  strictSeatGesture = true
  try {
    await fixture(
      null,
      async () => {
        await orderColdBrew()
        assert.equal(audioStats.plays, 0)
        await seatGesture(true)
        assert.equal(audioStats.plays, 1, 'same batched seat gesture cannot start twice')
        assert.ok(ambientResumes > 0)
        assert.ok(ambientStarts > 0, 'actual AmbientAudio creates a decoded loop voice')
        assert.equal(stage(), 'seating')
        assert.equal(read().session.deadline, null)
        await act(async () => window.dispatchEvent(new window.Event('test-scene-ready')))
        await eventuallyStage('room')
        assert.equal(audioStats.plays, 1, 'GPU effect must not replay without a trusted gesture')
        assert.equal(audioElements.at(-1)!.paused, false)
        assert.ok(read().session.deadline > Date.now())
      },
      undefined,
      true,
    )
    deferredMusicPlay = true
    await fixture(null, async () => {
      await orderColdBrew()
      await seatGesture()
      await act(async () => window.dispatchEvent(new window.Event('test-scene-error')))
      assert.equal(stage(), 'receipt')
      assert.equal(read().session.deadline, null)
      await act(async () => releaseMusicPlay?.())
      assert.equal(
        audioElements.at(-1)!.paused,
        true,
        'late playing event must be stopped after failed entry',
      )
      assert.ok(ambientStops > 0)
      deferredMusicPlay = false
      await seatGesture()
      assert.equal(audioStats.plays, 2, 'retry starts with a new trusted click')
    })
    deferredMusicPlay = true
    await fixture(null, async () => {
      await orderColdBrew()
      await seatGesture()
    })
    const unmounted = audioElements.at(-1)!
    await act(async () => releaseMusicPlay?.())
    assert.equal(unmounted.paused, true, 'unmounted transport must not resume late')
  } finally {
    strictSeatGesture = false
    deferredMusicPlay = false
    trustedSeatGesture = false
    AudioStub.prototype.play = oldPlay
    globalThis.fetch = oldFetch
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: oldContext,
    })
  }
})

test('natural focus completion confirms coupons then automatically counts down rest without extra taps or duplicate awards', async () => {
  const originalNow = Date.now
  let now = originalNow()
  Date.now = () => now
  try {
    for (const [minutes, priorMinutes, earned, carry] of [
      [35, 0, 1, 10],
      [55, 0, 2, 5],
      [10, 20, 1, 5],
      [10, 0, 0, 10],
    ]) {
      let persisted = ''
      await fixture(
        { version: 4, settings: { ...defaults, focus: minutes } },
        async (host) => {
          await enterRoom()
          assert.equal(read().session.status, 'running')
          if (minutes === 35) await openRoomSetting('시간')
          const pauses = audioStats.pauses
          now = read().session.deadline + 1
          await act(async () => document.dispatchEvent(new window.Event('visibilitychange')))
          assert.equal(stage(), 'leaving')
          assert.equal(
            document.querySelector('[role="dialog"]'),
            null,
            'completion closes a detail portal before departure',
          )
          assert.equal(host.querySelectorAll('[data-testid="cafe-scene"]').length, 1)
          assert.equal(read().session.status, 'complete')
          assert.ok(audioStats.pauses > pauses)
          const beforeAck = JSON.parse(localStorage.getItem('rain-room.coffee.v1')!)
          assert.equal(
            Object.keys(beforeAck.completed).length,
            priorMinutes ? 2 : 1,
            'completion saved before any coupon action',
          )
          await eventuallyStage('coupon')
          assert.equal(document.activeElement, document.querySelector('#completion-heading'))
          assert.equal(host.querySelector('[data-testid="cafe-scene"]'), null)
          assert.equal(
            document.querySelector('.coupon-experience')?.getAttribute('data-confirmed'),
            'true',
          )
          assert.equal(
            document.querySelector('.completion-result')?.textContent,
            earned ? `커피 쿠폰 ${earned}장 적립` : '다음 커피에 조금 더 가까워졌어요',
          )
          assert.equal(coffeeTotals(beforeAck).remainderMs, carry * 60000)
          persisted = localStorage.getItem('rain-room.coffee.v1')!
          // The reduced-motion coupon still remains readable before opening rest by itself.
          await wait(1000)
          assert.equal(stage(), 'break')
          assert.equal(read().session.phase, 'rest')
          assert.equal(read().session.status, 'running')
          const restDeadline = read().session.deadline
          assert.equal(restDeadline, now + defaults.rest * 60000)
          assert.equal(host.querySelector('.completion-rest time')?.textContent, '05:00')
          assert.equal(host.querySelector('[data-testid="cafe-scene"]'), null)
          now += 1000
          await wait(300)
          assert.equal(host.querySelector('.completion-rest time')?.textContent, '04:59')
          now += 2000
          await act(async () => document.dispatchEvent(new window.Event('visibilitychange')))
          assert.equal(host.querySelector('.completion-rest time')?.textContent, '04:57')
          assert.equal(read().session.deadline, restDeadline, 'rerenders never restart the break')
          assert.equal(localStorage.getItem('rain-room.coffee.v1'), persisted)
          const plays = audioStats.plays
          now = read().session.deadline + 1
          await act(async () => document.dispatchEvent(new window.Event('visibilitychange')))
          assert.equal(stage(), 'break')
          assert.equal(read().session.status, 'complete')
          assert.equal(audioStats.plays, plays)
          assert.equal(localStorage.getItem('rain-room.coffee.v1'), persisted)
          await click('.completion-actions .primary')
          assert.equal(stage(), 'menu')
          assert.equal(read().ritual.order, null)
          assert.equal(read().session.status, 'idle')
        },
        () => {
          if (priorMinutes)
            localStorage.setItem(
              'rain-room.coffee.v1',
              JSON.stringify({
                version: 1,
                active: {},
                completed: {
                  prior: {
                    id: 'prior',
                    durationMs: priorMinutes * 60000,
                    activeMs: priorMinutes * 60000,
                    deadline: now - 1,
                    completedAt: now - 1,
                  },
                },
              }),
            )
        },
        true,
      )
      await fixture(
        null,
        async () => {
          assert.equal(stage(), 'menu')
          assert.equal(localStorage.getItem('rain-room.coffee.v1'), persisted)
        },
        () => localStorage.setItem('rain-room.coffee.v1', persisted),
      )
    }
  } finally {
    Date.now = originalNow
  }
})

test('coupon waits for a confirmed write and retries the same completed run without fake or duplicate credit', async () => {
  const originalNow = Date.now
  let now = originalNow()
  Date.now = () => now
  try {
    await fixture({ version: 4, settings: { ...defaults, focus: 25 } }, async () => {
      await enterRoom()
      const storage = window.localStorage
      const windowDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')!
      const globalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!
      let blocked = true
      const limited = {
        getItem: (key: string) => storage.getItem(key),
        setItem: (key: string, value: string) => {
          if (key === 'rain-room.coffee.v1' && blocked) throw Error('quota')
          storage.setItem(key, value)
        },
      }
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => limited })
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: limited })
      try {
        now = read().session.deadline + 1
        await act(async () => document.dispatchEvent(new window.Event('visibilitychange')))
        await eventuallyStage('coupon')
        assert.equal(
          document.querySelector('.coupon-experience')?.getAttribute('data-confirmed'),
          'false',
        )
        assert.equal(document.querySelector('.completion-result'), null)
        assert.equal(
          document.querySelector<HTMLButtonElement>('.completion-actions .primary')!.disabled,
          true,
        )
        assert.equal(
          Object.keys(JSON.parse(storage.getItem('rain-room.coffee.v1')!).completed).length,
          0,
        )
        await wait(1000)
        assert.equal(stage(), 'coupon', 'a failed completion save cannot start automatic rest')
        assert.equal(read().session.status, 'complete')
        blocked = false
        await click('.completion-retry')
        assert.equal(
          document.querySelector('.coupon-experience')?.getAttribute('data-confirmed'),
          'true',
        )
        const ledger = JSON.parse(storage.getItem('rain-room.coffee.v1')!)
        assert.equal(Object.keys(ledger.completed).length, 1)
        assert.equal(coffeeTotals(ledger).coffees, 1)
        await act(async () =>
          window.dispatchEvent(new window.StorageEvent('storage', { key: 'rain-room.coffee.v1' })),
        )
        assert.equal(
          Object.keys(JSON.parse(storage.getItem('rain-room.coffee.v1')!).completed).length,
          1,
        )
        await click('.completion-return')
        assert.equal(stage(), 'menu')
        await wait(1000)
        assert.equal(stage(), 'menu', 'returning cancels the pending automatic break')
        assert.equal(read().session.status, 'idle')
      } finally {
        Object.defineProperty(window, 'localStorage', windowDescriptor)
        Object.defineProperty(globalThis, 'localStorage', globalDescriptor)
      }
    })
  } finally {
    Date.now = originalNow
  }
})

test('actual FocusPage collects accepted room objects once, opens collection and preserves discoveries across kiosk reload', async () => {
  const collectionKey = 'rain-room.object-collection.v1'
  let savedApp: unknown,
    persisted = '',
    firstId = ''
  await fixture(null, async () => {
    assert.equal(stage(), 'menu')
    assert.equal(document.querySelector('[data-scene-interactive]'), null)
    assert.equal(
      localStorage.getItem(collectionKey),
      null,
      'counter never creates collection credit',
    )
    await enterRoom()
    const control = (window as any).__ritualObjectActivation
    const target = document.querySelector<HTMLButtonElement>('[data-scene-interactive]')!
    assert.ok(target, 'actual ready room exposes its authored object targets')
    firstId = target.dataset.sceneInteractive!
    await click(target)
    assert.equal(localStorage.getItem(collectionKey), null, 'native rejection cannot discover')
    assert.equal(document.querySelector('.discovery-toast'), null)
    control.accepted = true
    const deadline = read().session.deadline
    const plays = audioStats.plays
    await click(target)
    const ledger = JSON.parse(localStorage.getItem(collectionKey)!)
    assert.deepEqual(Object.keys(ledger.collected), [firstId])
    const timestamp = ledger.collected[firstId]
    assert.ok(Number.isSafeInteger(timestamp))
    assert.ok(
      document.querySelector('.discovery-toast')?.textContent?.includes('새 오브제를 수집했어요'),
    )
    await click(target)
    assert.equal(JSON.parse(localStorage.getItem(collectionKey)!).collected[firstId], timestamp)
    assert.equal(document.querySelectorAll('.discovery-toast').length, 1)
    assert.equal(read().session.deadline, deadline)
    assert.equal(audioStats.plays, plays)
    await openRoomSetting('나의 컬렉션')
    const dialog = document.querySelector('[role=dialog]')!
    assert.ok(dialog.textContent?.includes('나의 컬렉션'))
    assert.equal(dialog.querySelectorAll('.collection-card[data-collected=true] img').length, 1)
    assert.equal(dialog.querySelectorAll('.collection-card[data-collected=false] img').length, 0)
    assert.equal(
      document.querySelector('[data-scene-interactive]'),
      null,
      'modal removes room activation',
    )
    assert.equal(read().session.deadline, deadline)
    await click('.settings-dialog .close')
    await wait(30)
    persisted = localStorage.getItem(collectionKey)!
    savedApp = read()
    // Keep an uncollected old-room target: dedup cannot hide an accidental award.
    const staleTarget = [
      ...document.querySelectorAll<HTMLButtonElement>('[data-scene-interactive]'),
    ].find((element) => element.dataset.sceneInteractive !== firstId)!
    assert.ok(staleTarget)
    await openRoomSetting('나만의 공간')
    const otherRoom = document.querySelector<HTMLButtonElement>(
      '[role=dialog] button.background-card:not([aria-pressed=true])',
    )
    assert.ok(otherRoom)
    await click(otherRoom)
    await click(staleTarget)
    assert.equal(
      localStorage.getItem(collectionKey),
      persisted,
      'detached old-room target cannot award during switch',
    )
  })
  await fixture(
    savedApp,
    async () => {
      assert.equal(stage(), 'menu', 'reload returns to kiosk even if saved visit was in room')
      assert.equal(document.querySelector('[data-scene-interactive]'), null)
      assert.equal(document.querySelector('.discovery-toast'), null)
      assert.equal(localStorage.getItem(collectionKey), persisted)
      await enterRoom()
      const target = document.querySelector<HTMLButtonElement>(
        `[data-scene-interactive="${firstId}"]`,
      )
      assert.ok(target)
      ;(window as any).__ritualObjectActivation.accepted = true
      await click(target)
      assert.equal(localStorage.getItem(collectionKey), persisted)
      assert.equal(
        document.querySelector('.discovery-toast'),
        null,
        'collected object never replays notice after reload',
      )
    },
    () => localStorage.setItem(collectionKey, persisted),
  )
})

test('player settings remain available after header idle and navigate one modal without restarting the room', async () => {
  await fixture(null, async () => {
    await enterRoom()
    const canvas = document.querySelector('canvas[data-test-gpu]')
    const deadline = read().session.deadline
    const plays = audioStats.plays
    await wait(2600)
    assert.equal(
      document.querySelector('.ritual-room-header')?.getAttribute('data-visible'),
      'false',
    )
    const opener = document.querySelector<HTMLElement>('.ritual-room-player-settings')!
    assert.ok(opener)
    const historyLength = window.history.length
    await click(opener)
    const dialog = document.querySelector('[role="dialog"]')!
    assert.ok(dialog)
    assert.equal(document.querySelectorAll('.ritual-settings-menu button').length, 8)
    assert.equal(window.history.length, historyLength + 1)
    for (const label of ['음악', '환경음', '나의 컬렉션', '언어']) {
      await click(buttonText('.ritual-settings-menu', label))
      assert.equal(document.querySelector('[role="dialog"]'), dialog)
      assert.equal(window.history.length, historyLength + 1)
      await click('.ritual-settings-back')
      assert.equal(document.querySelectorAll('.ritual-settings-menu button').length, 8)
    }
    await click('.settings-dialog .close')
    await wait(30)
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(document.activeElement, opener)
    await click(opener)
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      ),
    )
    await wait(30)
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(document.activeElement, opener)
    await click(opener)
    await click(buttonText('.ritual-settings-menu', '음악'))
    act(() => window.history.back())
    await wait(30)
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(document.activeElement, opener)
    assert.ok(document.querySelector('.ritual-room-player'))
    assert.equal(document.querySelector('canvas[data-test-gpu]'), canvas)
    assert.equal(read().session.deadline, deadline)
    assert.equal(audioStats.plays, plays)
    assert.equal(stage(), 'room')
  })
})
