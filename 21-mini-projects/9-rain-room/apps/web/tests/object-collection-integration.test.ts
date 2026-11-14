import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'
import { defaults, fresh } from '../src/pages/focus/model/timer.ts'
const window = new Window({ url: 'http://localhost:3000' })
Object.defineProperty(window.document, 'hidden', { value: false, configurable: true })
Object.defineProperty(window, 'matchMedia', {
  value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
})
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLButtonElement',
  'Element',
  'Node',
  'NodeFilter',
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
        : name === 'getComputedStyle'
          ? window.getComputedStyle.bind(window)
          : window[name],
  })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const { createElement: h, act, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
// Replace only the GPU runtime. Real RuntimeCafe, PixiScene, projected targets,
// gestures, room transitions, header, sheet, hook and toast execute unchanged.
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
  plugins: [
    {
      name: 'collection-native-runtime-boundary',
      enforce: 'pre',
      load(id) {
        if (id.endsWith('/lib/pixiSceneRuntime.ts'))
          return `export const runtimeFixture = {accepted:false,calls:[]}; export class PixiSceneRuntime {constructor(options){this.options=options}start(){this.options.onStatus('ready');return Promise.resolve()}setPaused(value){this.paused=value}setCoffeeCount(){}resize(){}destroy(){this.destroyed=true}activateSceneObject(id){runtimeFixture.calls.push(id);return runtimeFixture.accepted && !this.paused && !this.destroyed}}`
      },
    },
  ],
})
const { default: Room } = await server.ssrLoadModule('/src/pages/focus/ui/ritual/ImmersiveRoom.tsx')
const { default: Settings } = await server.ssrLoadModule(
  '/src/pages/focus/ui/ritual/RitualSettings.tsx',
)
const { default: Collection } = await server.ssrLoadModule(
  '/src/pages/focus/ui/ObjectCollection.tsx',
)
const { default: Toast } = await server.ssrLoadModule('/src/pages/focus/ui/DiscoveryToast.tsx')
const { useObjectCollection } = await server.ssrLoadModule(
  '/src/pages/focus/model/useObjectCollection.ts',
)
const { runtimeFixture } = await server.ssrLoadModule('/src/pages/focus/lib/pixiSceneRuntime.ts')
const { i18n } = await server.ssrLoadModule('/src/shared/i18n/index.ts')
await server.close()
const noop = () => {}
const base = {
  backgroundId: 'cafe-rain',
  backgroundName: 'Rain room',
  coffeeCount: 0,
  order: null,
  session: { ...fresh('focus', defaults), status: 'running', remaining: 90000 },
  settings: defaults,
  playing: true,
  ambientPlaying: true,
  trackTitle: 'Afternoon Study',
  error: '',
  blocked: false,
  onSceneStatus: noop,
  onMusicToggle: noop,
  onNext: noop,
  onMode: noop,
  onRandomBackground: noop,
}
const proofs: Record<string, string> = {}
let api, sheetState
function Experience({ blocked = false, backgroundId = 'cafe-rain' }) {
  api = useObjectCollection()
  const [sheet, setSheet] = useState(null)
  const [opener, setOpener] = useState(null)
  sheetState = sheet
  return h(
    'div',
    null,
    h(Room, {
      ...base,
      blocked,
      backgroundId,
      settingsOpen: sheet !== null,
      onObjectDiscover: api.discover,
      onOpenSettings: (element, target) => {
        setOpener(element)
        setSheet(target)
      },
    }),
    h(Settings, {
      sheet,
      onSheet: setSheet,
      opener,
      settings: defaults,
      sound: {},
      rewards: {},
      onSettings: noop,
      onTime: noop,
      onAmbient: noop,
      onReorder: noop,
      sessionActive: true,
      collection: h(Collection, {
        collected: api.collected,
        storageError: api.storageError,
        onRetry: api.retrySave,
      }),
    }),
    h(Toast, { notice: api.notice, storageError: api.storageError }),
  )
}
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
}
async function click(element) {
  assert.ok(element)
  await act(async () => element.click())
}
test('actual room→RuntimeCafe→PixiScene accepts native activation, gates modal/blocked/fade input and preserves timer', async () => {
  await i18n.changeLanguage('ko')
  window.localStorage.clear()
  const host = document.createElement('div')
  document.body.append(host)
  let root = createRoot(host)
  const render = async (props = {}) => {
    await act(async () => root.render(h(Experience, props)))
    await settle()
  }
  try {
    await render()
    const timer = () => host.querySelector('[role=timer]')!.textContent
    const target = () => host.querySelector<HTMLButtonElement>('[data-scene-interactive]')
    assert.ok(target(), 'real projected target mounts when native runtime is ready')
    assert.equal(Object.keys(api.collected).length, 0, 'mount/readiness never discovers')
    const id = target()!.dataset.sceneInteractive!
    const timeBefore = timer()
    runtimeFixture.accepted = false
    await click(target())
    assert.equal(Object.keys(api.collected).length, 0)
    assert.equal(api.notice, null)
    assert.ok(runtimeFixture.calls.includes(id), 'real target callback reaches runtime boundary')
    runtimeFixture.accepted = true
    const pointerTarget = target()!
    const callsBeforePointerDown = runtimeFixture.calls.length
    await act(async () =>
      pointerTarget.dispatchEvent(
        new window.PointerEvent('pointerdown', {
          bubbles: true,
          isPrimary: true,
          pointerId: 1,
          button: 0,
          clientX: 20,
          clientY: 20,
        }),
      ),
    )
    assert.equal(Object.keys(api.collected).length, 0, 'pointerdown alone never discovers')
    assert.equal(runtimeFixture.calls.length, callsBeforePointerDown)
    await act(async () => {
      pointerTarget.dispatchEvent(
        new window.PointerEvent('pointerup', {
          bubbles: true,
          isPrimary: true,
          pointerId: 1,
          button: 0,
          clientX: 20,
          clientY: 20,
        }),
      )
      pointerTarget.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    assert.equal(Object.keys(api.collected).length, 1)
    assert.ok(Object.hasOwn(api.collected, id))
    assert.equal(api.notice.serial, 1)
    await click(target())
    assert.equal(api.notice.serial, 1)
    assert.equal(timer(), timeBefore)
    proofs.accepted = host.querySelector('.discovery-toast-region')!.outerHTML
    await render({ blocked: true })
    assert.equal(target(), null)
    assert.equal(Object.keys(api.collected).length, 1)
    await render()
    await click(host.querySelector('.ritual-room-settings'))
    const menu = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.getAttribute('aria-label') === '나의 컬렉션',
    )
    assert.ok(menu, 'actual additional header action exposes collection')
    await click(menu)
    await settle()
    assert.equal(sheetState, 'collection')
    assert.equal(target(), null, 'settings modal removes native activation targets')
    const dialog = document.querySelector('[role=dialog]')!
    assert.ok(dialog?.textContent?.includes('나의 컬렉션'))
    assert.equal(dialog.querySelectorAll('.collection-card[data-collected=true]').length, 1)
    assert.equal(dialog.querySelectorAll('.collection-card[data-collected=true] img').length, 1)
    assert.equal(dialog.querySelectorAll('.collection-card[data-collected=false] img').length, 0)
    assert.equal(timer(), timeBefore)
    proofs.collectionSheet = dialog.outerHTML
    await click(dialog.querySelector('.close'))
    await settle()
    assert.equal(sheetState, null)
    await render({ backgroundId: 'cafe-alley' })
    assert.equal(target(), null, 'fade prevents object activation')
    assert.equal(Object.keys(api.collected).length, 1)
    proofs.fade = host.querySelector('[data-testid=immersive-room]')!.outerHTML
    await act(async () => root.unmount())
    root = createRoot(host)
    await render()
    assert.ok(Object.hasOwn(api.collected, id))
    assert.equal(api.notice, null, 'reload never replays collection toast')
    if (process.env.COLLECTION_INTEGRATION_PROOF)
      await writeFile(process.env.COLLECTION_INTEGRATION_PROOF, JSON.stringify(proofs, null, 2))
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
