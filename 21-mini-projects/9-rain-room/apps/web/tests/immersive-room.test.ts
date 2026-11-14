import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { build } from 'vite'
import { defaults, fresh } from '../src/pages/focus/model/timer.ts'
await build({
  publicDir: false,
  plugins: [
    {
      name: 'room-artwork-fixture',
      enforce: 'pre',
      load(id) {
        if (id.endsWith('/ui/RuntimeCafe.tsx'))
          return `import {createElement} from 'react';export default function Cafe(p){return createElement('div',{'data-testid':'room-artwork','data-paused':String(p.paused),'data-fullscreen':String(p.fullscreen)})}`
      },
    },
  ],
  build: {
    ssr: 'src/pages/focus/ui/ritual/ImmersiveRoom.tsx',
    outDir: 'node_modules/.cache/immersive-room',
    emptyOutDir: true,
  },
  logLevel: 'silent',
})
process.env.NODE_ENV = 'development'
const window = new Window({ url: 'http://localhost:3000' })
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
const { createElement, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { default: Room } = await import('../node_modules/.cache/immersive-room/ImmersiveRoom.js')

test('room preserves one artwork and readonly timer with compact cycling music controls', async () => {
  const host = document.createElement('div')
  host.id = 'root'
  document.body.append(host)
  const root = createRoot(host)
  let music = 0,
    settingsOpener: HTMLElement | null = null,
    settingsTarget = '',
    reordered = 0,
    nextTrack = 0,
    chosenMode = ''
  const props = {
    backgroundId: 'cafe-rain',
    backgroundName: 'Rain room',
    coffeeCount: 2,
    order: null,
    session: { ...fresh('focus', defaults), remaining: 90000, status: 'running' as const },
    settings: defaults,
    playing: true,
    ambientPlaying: true,
    trackTitle: 'Afternoon Study',
    error: '',
    blocked: false,
    onSceneStatus() {},
    onMusicToggle() {
      music++
    },
    onNext() {
      nextTrack++
    },
    onMode(mode: string) {
      chosenMode = mode
    },
    onOpenSettings(opener: HTMLElement, target: string) {
      settingsOpener = opener
      settingsTarget = target
    },
    onReorder() {
      reordered++
    },
    onRandomBackground() {},
  }
  await act(async () => root.render(createElement(Room, props)))
  const artwork = host.querySelector('[data-testid="room-artwork"]')!
  assert.equal(document.querySelectorAll('[data-testid="immersive-room"]').length, 1)
  assert.ok(host.querySelector('[data-testid="immersive-room"]'))
  assert.equal(host.inert, false)
  assert.equal(host.querySelector('[role="timer"]')!.textContent, '01:30')
  assert.equal(artwork.getAttribute('data-fullscreen'), 'true')
  assert.equal(host.querySelector('.ritual-room-player .fullscreen-volume'), null)
  assert.equal(host.querySelectorAll('.ritual-room-player input[type="range"]').length, 0)
  const orderedButtons = [...host.querySelectorAll<HTMLButtonElement>('.ritual-room-player button')]
  assert.equal(host.querySelector('.ritual-room-timer-action'), null)
  assert.equal(orderedButtons.length, 5)
  assert.ok(orderedButtons[0].classList.contains('ritual-room-player-settings'))
  assert.ok(orderedButtons[1].classList.contains('ritual-room-close'))
  assert.ok(orderedButtons[2].classList.contains('playback-mode-cycle'))
  assert.ok(orderedButtons[3].classList.contains('ritual-room-music-toggle'))
  const click = async (selector: string) =>
    act(async () => {
      host.querySelector<HTMLElement>(selector)!.click()
    })
  assert.equal(host.querySelector('.ritual-room-player-top .ritual-room-track'), null)
  assert.ok(host.querySelector('.ritual-room-player-bottom .ritual-room-track'))
  assert.equal(
    host.querySelector('.ritual-room-track strong')!.getAttribute('title'),
    props.trackTitle,
  )
  assert.equal(host.querySelector('[role="timer"]')!.closest('button'), null)
  for (const playing of [true, false]) {
    await act(async () =>
      root.render(
        createElement(Room, {
          ...props,
          playing,
          trackTitle:
            '아주 긴 집중 음악 제목 / An unusually long quiet piano track for a rainy afternoon',
        }),
      ),
    )
    const primary = host.querySelector<HTMLButtonElement>('[data-testid="room-music-toggle"]')!
    assert.ok(primary.getAttribute('aria-label'))
    assert.equal(
      primary.querySelector('svg path')!.getAttribute('d'),
      playing ? 'M6 4h4v16H6zm8 0h4v16h-4z' : 'm7 4 13 8-13 8z',
    )
    assert.equal(primary.closest('.playback-controls')?.querySelectorAll('button').length, 3)
  }
  assert.equal(music, 0)
  await click('.ritual-room-music-toggle')
  assert.equal(music, 1)
  await click('.ritual-room-playback .next-track')
  assert.equal(nextTrack, 1)
  assert.equal(host.querySelectorAll('.ritual-room-playback .playback-mode').length, 1)
  for (const [current, next] of [
    ['repeat-one', 'shuffle'],
    ['shuffle', 'sequential'],
    ['sequential', 'repeat-one'],
  ] as const) {
    await act(async () =>
      root.render(
        createElement(Room, { ...props, settings: { ...defaults, playbackMode: current } }),
      ),
    )
    const cycle = host.querySelector('.playback-mode-cycle')!
    assert.equal(cycle.getAttribute('data-mode'), current)
    assert.equal(cycle.hasAttribute('aria-pressed'), false)
    assert.ok(cycle.getAttribute('aria-label'))
    await click('.playback-mode-cycle')
    assert.equal(chosenMode, next)
  }
  await click('.ritual-room-player-settings')
  assert.equal(settingsTarget, 'settings')
  assert.equal(settingsOpener, host.querySelector('.ritual-room-player-settings'))
  assert.equal(settingsOpener?.getAttribute('aria-haspopup'), 'dialog')
  settingsOpener = null
  const historyLength = window.history.length
  const gear = host.querySelector<HTMLButtonElement>('.ritual-room-settings')!
  const panel = host.querySelector<HTMLElement>('.header-settings-panel')!
  await click('.ritual-room-settings')
  assert.equal(settingsOpener, null, 'gear only expands the original flyout')
  assert.equal(panel.hidden, false)
  assert.equal(panel.querySelectorAll('button').length, 8)
  assert.equal(panel.querySelectorAll('button[aria-label="My collection"]').length, 1)
  assert.equal(artwork.getAttribute('data-paused'), 'false')
  assert.equal(window.history.length, historyLength)
  assert.ok(host.querySelector('[data-testid="room-artwork"]') === artwork)
  await act(async () =>
    gear.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    ),
  )
  assert.equal(panel.hidden, true)
  assert.ok(document.activeElement === gear, 'Escape returns to gear, not the room root')
  await act(async () =>
    gear.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    ),
  )
  assert.equal(panel.hidden, false)
  assert.ok(
    document.activeElement === panel.querySelector('button'),
    'ArrowDown focuses the first original action',
  )
  await click('.header-settings-panel button')
  assert.ok(settingsOpener === gear, 'detail dialog receives the stable gear opener')
  assert.equal(settingsTarget, 'time')
  assert.equal(panel.hidden, true)
  await click('.ritual-room-settings')
  await act(async () =>
    document.body.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true })),
  )
  assert.equal(panel.hidden, true, 'outside pointer closes the flyout')
  await click('.ritual-room-settings')
  await click('.ritual-return-counter')
  assert.equal(settingsTarget, 'return', 'active focus requires the existing return confirmation')
  assert.equal(reordered, 0)
  await act(async () =>
    root.render(createElement(Room, { ...props, session: fresh('focus', defaults) })),
  )
  await click('.ritual-room-settings')
  await click('.ritual-return-counter')
  assert.equal(reordered, 1, 'idle returns directly to the ordering counter')
  assert.equal(music, 1)
  assert.ok(host.querySelector('[data-testid="room-artwork"]') === artwork)
  await click('.ritual-room-close')
  assert.equal(host.querySelector('.ritual-room-player'), null)
  assert.equal(document.activeElement, host.querySelector('.ritual-room-restore'))
  await click('.ritual-room-restore')
  assert.equal(document.activeElement, host.querySelector('.ritual-room-close'))
  await act(async () => root.render(createElement(Room, { ...props, blocked: true })))
  assert.equal(
    host.querySelector('[data-testid="room-artwork"]'),
    artwork,
    'seating overlay must not remount artwork',
  )
  assert.equal(artwork.getAttribute('data-paused'), 'false', 'seating scene continues loading/live')
  assert.equal(host.querySelector<HTMLElement>('.ritual-room-player')!.inert, true)
  assert.equal(host.querySelector('.ritual-room-timer-action'), null)
  assert.equal(host.querySelector<HTMLButtonElement>('.ritual-room-music-toggle')!.disabled, true)
  await act(async () => root.render(createElement(Room, { ...props, settingsOpen: true })))
  assert.equal(host.querySelector('[data-testid="room-artwork"]'), artwork)
  assert.equal(artwork.getAttribute('data-paused'), 'true')
  await act(async () => root.unmount())
  host.remove()
})

test('idle hides only header; Escape reveals it without exiting or trapping another modal', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const props = {
    backgroundId: 'cafe-rain',
    backgroundName: 'Rain room',
    coffeeCount: 0,
    order: null,
    session: fresh('focus', defaults),
    settings: defaults,
    playing: false,
    ambientPlaying: false,
    trackTitle: 'Afternoon Study',
    error: '',
    blocked: false,
    onSceneStatus() {},
    onMusicToggle() {},
    onNext() {},
    onMode() {},
    onOpenSettings() {},
    onRandomBackground() {},
  }
  await act(async () => root.render(createElement(Room, props)))
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2550))
  })
  const header = host.querySelector<HTMLElement>('.ritual-room-header')!
  assert.equal(header.dataset.visible, 'false')
  assert.ok(host.querySelector('.ritual-room-player'), 'player stays independently open')
  await act(async () =>
    host
      .querySelector<HTMLElement>('main')!
      .dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      ),
  )
  assert.equal(header.dataset.visible, 'true')
  assert.ok(host.querySelector('main'))
  await act(async () => host.querySelector<HTMLButtonElement>('.ritual-room-settings')!.click())
  const flyout = host.querySelector<HTMLElement>('.header-settings-panel')!
  assert.equal(flyout.hidden, false)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2550))
  })
  assert.equal(
    header.dataset.visible,
    'true',
    'expanded settings hold the 2.5-second header idle timer',
  )
  assert.equal(flyout.hidden, false)
  assert.equal(
    host.querySelector('[data-testid="room-artwork"]')!.getAttribute('data-paused'),
    'false',
    'flyout never pauses the scene',
  )
  await act(async () => root.render(createElement(Room, { ...props, settingsOpen: true })))
  assert.equal(flyout.hidden, true, 'opening a detail modal dismisses the flyout')
  assert.equal(flyout.inert, true)
  const event = new window.KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  })
  await act(async () => host.querySelector<HTMLElement>('main')!.dispatchEvent(event))
  assert.equal(event.defaultPrevented, false, 'parent settings modal retains Escape ownership')
  await act(async () => root.unmount())
  host.remove()
})
test.after(async () => {
  await window.happyDOM.abort()
})
