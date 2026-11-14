import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import {
  LocalObjectCollectionStorage,
  OBJECT_COLLECTION_STORAGE_KEY,
} from '../src/pages/focus/model/objectCollectionStorage.ts'
const window = new Window({ url: 'http://localhost:3000' })
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'StorageEvent',
] as const)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: name === 'window' ? window : window[name],
  })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })
const { createElement: h, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})
const { default: Collection } = await server.ssrLoadModule(
  '/src/pages/focus/ui/ObjectCollection.tsx',
)
const { default: Toast } = await server.ssrLoadModule('/src/pages/focus/ui/DiscoveryToast.tsx')
const { useObjectCollection } = await server.ssrLoadModule(
  '/src/pages/focus/model/useObjectCollection.ts',
)
const { SCENE_INTERACTIVE_OBJECTS: objects } = await server.ssrLoadModule(
  '/src/pages/focus/model/sceneInteractiveObjects.ts',
)
const { i18n } = await server.ssrLoadModule('/src/shared/i18n/index.ts')
await server.close()
async function fixture(run) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const render = async (element) => act(async () => root.render(element))
  try {
    await run(host, render)
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
}
test('locked collection reveals localized name and location with no source art or image DOM', async () => {
  await fixture(async (host, render) => {
    for (const lang of ['ko', 'en', 'zh']) {
      await act(async () => {
        await i18n.changeLanguage(lang)
      })
      await render(h(Collection, { collected: {} }))
      assert.equal(host.querySelectorAll('li').length, objects.length)
      assert.equal(host.querySelectorAll('img, svg:not([data-collection-lock])').length, 0)
      assert.equal(host.innerHTML.includes('data:image'), false)
      assert.ok(host.textContent.includes(objects[0].label[lang]))
      assert.ok(
        host.textContent.includes(
          i18n.t(`backgrounds.${objects[0].roomId}.name`, { ns: 'catalog' }),
        ),
      )
    }
    await render(h(Collection, { collected: { [objects[0].id]: 10 } }))
    assert.equal(host.querySelectorAll('img').length, 1)
    assert.ok(host.querySelector('img')?.getAttribute('src')?.startsWith('data:image/svg+xml,'))
    const collectedButton = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === i18n.t('collected', { ns: 'collection' }),
    )!
    await act(async () => collectedButton.click())
    assert.equal(host.querySelectorAll('li').length, 1)
  })
})
test('rapid accepted clicks deduplicate synchronously, persist reload and merge storage events without notices', async () => {
  let api
  const storage = new LocalObjectCollectionStorage(
    () => window.localStorage as unknown as Storage,
    window as unknown as Window,
  )
  window.localStorage.clear()
  function Probe() {
    api = useObjectCollection(storage)
    return h('span', null, Object.keys(api.collected).length)
  }
  await fixture(async (host, render) => {
    await render(h(Probe))
    assert.equal(Object.keys(api.collected).length, 0)
    await act(async () => {
      assert.equal(api.discover(objects[0].id), true)
      assert.equal(api.discover(objects[0].id), false)
      assert.equal(api.discover('not-in-catalog'), false)
    })
    assert.equal(api.notice.serial, 1)
    assert.equal(api.storageError, false)
    const ledger = JSON.parse(window.localStorage.getItem(OBJECT_COLLECTION_STORAGE_KEY)!)
    ledger.collected[objects[1].id] = 123
    window.localStorage.setItem(OBJECT_COLLECTION_STORAGE_KEY, JSON.stringify(ledger))
    await act(async () =>
      window.dispatchEvent(
        new window.StorageEvent('storage', { key: OBJECT_COLLECTION_STORAGE_KEY }),
      ),
    )
    assert.equal(Object.keys(api.collected).length, 2)
    assert.equal(api.notice.serial, 1)
  })
  await fixture(async (_host, render) => {
    await render(h(Probe))
    assert.equal(Object.keys(api.collected).length, 2)
    assert.equal(api.notice, null)
    await act(async () => {
      assert.equal(api.discover(objects[0].id), false)
    })
  })
})
test('session-only discoveries survive failed save and retry without duplicate achievement', async () => {
  let api,
    unavailable = true,
    raw: string | null = null
  const storage = new LocalObjectCollectionStorage(() => ({
    getItem: () => raw,
    setItem: (_key, next) => {
      if (unavailable) throw Error('quota')
      raw = next
    },
  }))
  function Probe() {
    api = useObjectCollection(storage)
    return h(Toast, api)
  }
  await fixture(async (host, render) => {
    await render(h(Probe))
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    try {
      await act(async () => {
        api.discover(objects[0].id)
      })
      assert.equal(api.storageError, true)
      assert.equal(host.querySelector('[role=status]')?.getAttribute('aria-live'), 'polite')
      assert.equal(document.activeElement, button)
      await act(async () => {
        unavailable = false
        assert.equal(api.discover(objects[0].id), false)
      })
      assert.equal(api.storageError, false)
      assert.equal(api.notice.serial, 1)
      await act(async () => api.dismissNotice())
      assert.equal(host.querySelector('[role=status]')?.textContent, '')
    } finally {
      button.remove()
    }
  })
})
test('notice auto-dismiss timer is cleaned on replacement and unmount', async () => {
  let api
  const timers = new Map<number, () => void>(),
    cleared: number[] = []
  const originalSet = window.setTimeout,
    originalClear = window.clearTimeout
  let sequence = 0
  window.setTimeout = ((callback, delay) => {
    assert.equal(delay, 3200)
    const id = ++sequence
    timers.set(id, callback as () => void)
    return id
  }) as typeof window.setTimeout
  window.clearTimeout = ((id) => {
    cleared.push(Number(id))
    timers.delete(Number(id))
  }) as typeof window.clearTimeout
  const storage = new LocalObjectCollectionStorage(() => ({
    getItem: () => null,
    setItem: () => {},
  }))
  function Probe() {
    api = useObjectCollection(storage)
    return null
  }
  try {
    await fixture(async (_host, render) => {
      await render(h(Probe))
      await act(async () => {
        api.discover(objects[0].id)
      })
      const first = sequence
      await act(async () => {
        api.discover(objects[1].id)
      })
      assert.ok(cleared.includes(first))
      await act(async () => {
        timers.get(sequence)!()
      })
      assert.equal(api.notice, null)
      await act(async () => {
        api.discover(objects[2].id)
      })
    })
    assert.equal(timers.size, 0)
  } finally {
    window.setTimeout = originalSet
    window.clearTimeout = originalClear
  }
})
