import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, rm, mkdir, writeFile } from 'node:fs/promises'
import { Window } from 'happy-dom'
import { build } from 'vite'
import { defaults, fresh } from '../src/pages/focus/model/timer.ts'

// Real component DOM and compiled styles. HappyDOM cannot prove pixel geometry or @layer utility cascade.
const outDir = 'node_modules/.cache/design-system-consistency'
const fixtureEntry = 'node_modules/.cache/design-system-review-entry.ts'
const priorNodeEnv = process.env.NODE_ENV
test.after(async () => {
  await rm(new URL(`../${outDir}/`, import.meta.url), { recursive: true, force: true })
  await rm(new URL(`../${fixtureEntry}`, import.meta.url), { force: true })
  if (priorNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = priorNodeEnv
})
await mkdir('node_modules/.cache', { recursive: true })
await writeFile(
  fixtureEntry,
  `import '@/app/styles/global.css'; export {default as Room} from '@/pages/focus/ui/ritual/ImmersiveRoom'; export {default as Settings} from '@/pages/focus/ui/ritual/RitualSettings'; export {Button} from '@/shared/ui'; export {default as BackgroundPicker} from '@/pages/focus/ui/BackgroundPicker'; export {default as Ambient} from '@/pages/focus/ui/AmbientMixer'; export {default as Kiosk} from '@/pages/focus/ui/ritual/KioskExperience'; export {default as Coupon} from '@/pages/focus/ui/ritual/CouponExperience'; export {i18n} from '@/shared/i18n';`,
)
await build({
  publicDir: false,
  plugins: [
    {
      name: 'design-system-review-fixture',
      enforce: 'pre',
      load(id) {
        if (id.endsWith('/ui/RuntimeCafe.tsx'))
          return `import{createElement}from'react';export default function Artwork(){return createElement('div',{'data-testid':'ds-artwork'})}`
      },
    },
  ],
  build: {
    ssr: fixtureEntry,
    outDir,
    emptyOutDir: true,
    emitAssets: true,
    ssrEmitAssets: true,
    cssCodeSplit: false,
    rollupOptions: { output: { entryFileNames: 'fixture.js' } },
  },
  logLevel: 'silent',
})
process.env.NODE_ENV = 'development'
const window = new Window({ url: 'http://localhost:3000', width: 390, height: 844 })
Object.defineProperty(window.Element.prototype, 'animate', { configurable: true, value: undefined })
const descriptors = new Map<string, PropertyDescriptor | undefined>()
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLDivElement',
  'HTMLButtonElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'SVGElement',
  'HTMLInputElement',
  'Element',
  'Node',
  'NodeFilter',
  'MutationObserver',
  'CustomEvent',
  'Event',
  'KeyboardEvent',
  'PointerEvent',
  'FocusEvent',
  'ResizeObserver',
  'localStorage',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const) {
  descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value:
      name === 'window'
        ? window
        : ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(name)
          ? window[name].bind(window)
          : window[name],
  })
}
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const cssFiles = (
  await readdir(new URL(`../${outDir}/`, import.meta.url), { recursive: true })
).filter((file) => file.endsWith('.css'))
assert.equal(cssFiles.length, 1, 'fixture must expose one actual compiled CSS cascade')
const style = document.createElement('style')
style.textContent = await readFile(new URL(`../${outDir}/${cssFiles[0]}`, import.meta.url), 'utf8')
// HappyDOM does not dispatch CSS animation lifecycle events used by Radix Presence.
style.textContent += '\n*{animation:none!important;transition:none!important}'
document.head.append(style)
const { createElement: h, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Room, Settings, Button, Kiosk, Coupon, Ambient, BackgroundPicker, i18n } = await import(
  '../node_modules/.cache/design-system-consistency/fixture.js'
)
const roots = new Set<ReturnType<typeof createRoot>>()
const mount = () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.add(root)
  return { host, root }
}
const css = (el: Element) => window.getComputedStyle(el)
const color = (value: string) => {
  const text = value.replaceAll(' ', '').toLowerCase()
  if (/^#[0-9a-f]{3,4}$/.test(text)) return '#' + [...text.slice(1)].map((c) => c + c).join('')
  const rgb = text.match(/^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/)
  if (!rgb) return text
  return (
    '#' +
    rgb
      .slice(1, 4)
      .map((c) => Number(c).toString(16).padStart(2, '0'))
      .join('') +
    (rgb[4] === undefined
      ? ''
      : Math.round(Number(rgb[4]) * 255)
          .toString(16)
          .padStart(2, '0'))
  )
}
const mint = (value: string) => assert.equal(color(value), '#39d5ac')
const props = {
  backgroundId: 'cafe-rain',
  backgroundName: 'Rain room',
  coffeeCount: 0,
  order: null,
  session: { ...fresh('focus', defaults), remaining: 180 * 60000, status: 'running' as const },
  settings: defaults,
  playing: false,
  ambientPlaying: false,
  trackTitle: 'A very long localized track title for ellipsis and hierarchy',
  error: '',
  blocked: false,
  onSceneStatus() {},
  onMusicToggle() {},
  onNext() {},
  onMode() {},
  onOpenSettings() {},
  onRandomBackground() {},
}

test('active player keeps centered readonly time, one cycle and mint play/pause across three locales and viewport styles', async () => {
  const { host, root } = mount()
  try {
    for (const language of ['ko', 'en', 'zh'])
      for (const [width, height] of [
        [320, 480],
        [390, 844],
        [667, 375],
        [834, 1112],
        [1112, 834],
        [1440, 900],
      ])
        for (const playing of [false, true]) {
          window.happyDOM.setWindowSize({ width, height })
          await act(async () => {
            await i18n.changeLanguage(language)
            root.render(h(Room, { ...props, playing }))
          })
          const player = host.querySelector('.ritual-room-player')!
          const timer = player.querySelector('[role="timer"]')!
          assert.equal(timer.textContent, '180:00')
          assert.ok(timer.getAttribute('aria-label'))
          assert.equal(timer.closest('button'), null)
          assert.equal(
            player.querySelector(
              '.ritual-room-timer-action, .fullscreen-volume, input[type="range"]',
            ),
            null,
          )
          const cycle = player.querySelector('.playback-mode-cycle')!
          assert.equal(player.querySelectorAll('.playback-mode').length, 1)
          assert.ok(cycle.getAttribute('aria-label'))
          assert.equal(cycle.hasAttribute('aria-pressed'), false)
          const transport = [...player.querySelectorAll('.playback-controls button')]
          assert.equal(transport.length, 3)
          assert.ok(transport[0].classList.contains('playback-mode-cycle'))
          assert.ok(transport[1].classList.contains('ritual-room-music-toggle'))
          assert.ok(transport[2].classList.contains('next-track'))
          mint(css(transport[1]).backgroundColor)
          for (const control of transport)
            assert.ok(
              Math.max(
                parseFloat(css(control).minHeight) || 0,
                parseFloat(css(control).height) || 0,
              ) >= 44,
              '44px transport hit area',
            )
          assert.equal(css(player).borderRadius, '24px')
          assert.equal(color(css(player).backgroundColor), '#00000066')
          const secondary = color(
            css(document.documentElement).getPropertyValue('--color-glass-secondary'),
          )
          for (const selector of ['.ritual-room-phase', '.ritual-room-track > span'])
            assert.equal(
              color(css(player.querySelector(selector)!).color),
              secondary,
              'glass captions use their contrast-specific neutral token',
            )
          assert.equal(css(player.querySelector('.ritual-room-timer-copy')!).textAlign, 'center')
          assert.ok(
            parseFloat(css(timer).fontSize) >
              parseFloat(css(player.querySelector('.ritual-room-track strong')!).fontSize) * 2,
            'time remains primary hierarchy',
          )
          assert.equal(
            css(player.querySelector('.ritual-room-track strong')!).textOverflow,
            'ellipsis',
          )
        }
  } finally {
    await act(async () => root.unmount())
    roots.delete(root)
    host.remove()
  }
})

test('language settings remain a localized portal dialog with neutral rows, radio selection and close focus restoration', async () => {
  const { host, root } = mount()
  const opener = document.createElement('button')
  opener.textContent = 'Settings'
  document.body.append(opener)
  try {
    for (const language of ['ko', 'en', 'zh']) {
      opener.focus()
      const settingsProps = {
        sheet: 'language',
        onSheet() {},
        settings: defaults,
        sound: {},
        rewards: {},
        opener,
        onSettings() {},
        onTime() {},
        onAmbient() {},
        onReorder() {},
        sessionActive: true,
      }
      await act(async () => {
        await i18n.changeLanguage(language)
        root.render(h(Settings, settingsProps))
      })
      const dialog = document.querySelector('[role="dialog"]')!
      assert.ok(dialog && !host.contains(dialog), 'actual portal is outside root fixture')
      assert.ok(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent)
      const radios = [...dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
      assert.equal(radios.length, 3)
      assert.equal(radios.filter((r) => r.checked).length, 1)
      assert.equal(radios.find((r) => r.checked)?.value, language)
      for (const radio of radios) {
        const row = radio.closest('label')!
        assert.ok(parseFloat(css(row).minHeight) >= 44)
        assert.equal(css(row).borderRadius, '14px')
      }
      const close = dialog.querySelector<HTMLButtonElement>('.close')!
      assert.ok(close.getAttribute('aria-label'))
      await act(async () => root.render(h(Settings, { ...settingsProps, sheet: null })))
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      assert.equal(document.querySelector('[role="dialog"]'), null)
      assert.ok(
        document.activeElement === opener,
        'focus returns to opener; actual=' + document.activeElement?.tagName,
      )
    }
  } finally {
    await act(async () => root.unmount())
    roots.delete(root)
    host.remove()
    opener.remove()
  }
})

test('counter icon states and menu controls stay usable while coupon keeps its deliberate paper surface', async () => {
  const { host, root } = mount()
  const noop = () => {}
  const order = {
    id: 'ds-review-order',
    drinkId: 'matcha-latte',
    temperature: 'iced',
    createdAt: 1000,
  }
  const kiosk = {
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
  try {
    for (const language of ['ko', 'en', 'zh']) {
      await act(async () => {
        await i18n.changeLanguage(language)
        root.render(h(Kiosk, kiosk))
      })
      const mute = host.querySelector('.ritual-sound-icon')!
      assert.ok(
        mute && css(mute).display !== 'none',
        'mute icon wrapper is visible, not hidden with text labels',
      )
      assert.ok(mute.closest('button')!.getAttribute('aria-label'))
      const cards = [...host.querySelectorAll('.ritual-menu-item')]
      assert.equal(cards.length, 10)
      for (const card of cards) {
        assert.ok(card.getAttribute('aria-label'))
        assert.ok(parseFloat(css(card).minHeight) >= 44)
        assert.equal(css(card).borderRadius, '14px')
      }
      await act(async () =>
        root.render(
          h(Coupon, {
            drinkId: 'matcha-latte',
            focusMs: 1500000,
            earned: 1,
            totalCoupons: 1,
            remainderMs: 0,
            confirmed: true,
            error: '',
            phase: 'coupon',
            restRemaining: 300000,
            restComplete: false,
            restMinutes: 5,
            onRetry: noop,
            onRest: noop,
            onReturn: noop,
          }),
        ),
      )
      const coupon = host.querySelector('.completion-coupon')!
      assert.equal(css(coupon).borderRadius, '24px')
      assert.notEqual(
        css(coupon).backgroundColor,
        css(document.documentElement).backgroundColor,
        'paper is an intentional readable exception to black app surfaces',
      )
      const primary = coupon.querySelector('.primary')!
      mint(css(primary).backgroundColor)
      assert.ok(parseFloat(css(primary).minHeight) >= 56)
    }
  } finally {
    await act(async () => root.unmount())
    roots.delete(root)
    host.remove()
  }
})

test('ambient primary action stays mint in both playback states for every locale', async () => {
  const { host, root } = mount()
  try {
    for (const language of ['ko', 'en', 'zh'])
      for (const playing of [false, true]) {
        await act(async () => {
          await i18n.changeLanguage(language)
          root.render(
            h(Ambient, { mix: defaults.ambient, playing, error: '', onUpdate() {}, onToggle() {} }),
          )
        })
        const button = host.querySelector('.mixer-play')!
        assert.ok(button.getAttribute('aria-label'))
        mint(css(button).backgroundColor)
        assert.ok(parseFloat(css(button).minHeight) >= 44)
      }
  } finally {
    await act(async () => root.unmount())
    roots.delete(root)
    host.remove()
  }
})

test('background category controls expose full 44px targets and named pressed-state choices', async () => {
  const { host, root } = mount()
  try {
    for (const language of ['ko', 'en', 'zh']) {
      await act(async () => {
        await i18n.changeLanguage(language)
        root.render(h(BackgroundPicker, { selectedId: 'cafe-rain', onSelect() {} }))
      })
      const group = host.querySelector('.background-categories')!
      assert.ok(group.getAttribute('aria-label'))
      const controls = [...group.querySelectorAll('button')]
      assert.ok(controls.length > 1)
      for (const control of controls) {
        assert.ok(control.textContent?.trim())
        assert.ok(parseFloat(css(control).minHeight) >= 44, 'background category hit target')
      }
      assert.equal(
        controls.filter((control) => control.getAttribute('aria-pressed') === 'true').length,
        1,
      )
    }
  } finally {
    await act(async () => root.unmount())
    roots.delete(root)
    host.remove()
  }
})

test('shared action preserves native disabled button semantics without pretending HappyDOM supports layered utilities', async () => {
  const { host, root } = mount()
  let calls = 0
  try {
    await act(async () =>
      root.render(
        h(
          Button,
          {
            variant: 'accent',
            disabled: true,
            onClick() {
              calls++
            },
          },
          'Play',
        ),
      ),
    )
    const button = host.querySelector('button')!
    assert.equal(button.disabled, true)
    await act(async () => button.click())
    assert.equal(calls, 0)
  } finally {
    await act(async () => root.unmount())
    roots.delete(root)
    host.remove()
  }
})

test.after(async () => {
  for (const root of roots) await act(async () => root.unmount())
  await window.happyDOM.abort()
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
  Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
})
