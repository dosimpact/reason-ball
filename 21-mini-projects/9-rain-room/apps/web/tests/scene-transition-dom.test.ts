import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { build } from 'vite'
await build({
  publicDir: false,
  build: {
    ssr: 'src/pages/focus/ui/ritual/useSceneTransition.ts',
    outDir: 'node_modules/.cache/scene-transition',
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
] as const)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: name === 'window' ? window : window[name],
  })
for (const name of ['requestAnimationFrame', 'cancelAnimationFrame'] as const)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: window[name].bind(window),
  })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
const { createElement, StrictMode, act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { useSceneTransition } = await import(
  '../node_modules/.cache/scene-transition/useSceneTransition.js'
)
const wait = async (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
test('StrictMode recreates the hook controller and normal external changes keep the displayed scene until covered', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let current: ReturnType<typeof useSceneTransition>,
    statuses: string[] = []
  function Harness({ id }: { id: string }) {
    current = useSceneTransition(id, (status: string) => statuses.push(status))
    return createElement('div', { 'data-id': current.displayedId, 'data-phase': current.phase })
  }
  const render = async (id: string) =>
    act(async () => root.render(createElement(StrictMode, null, createElement(Harness, { id }))))
  try {
    await render('A')
    assert.equal(host.firstElementChild!.getAttribute('data-phase'), 'idle')
    await act(async () => current!.sceneStatus('ready'))
    assert.deepEqual(statuses, ['ready'])
    const oldStatus = current!.sceneStatus
    await render('B')
    assert.equal(current!.displayedId, 'A')
    assert.equal(current!.phase, 'fading-out')
    await wait(200)
    assert.equal(current!.displayedId, 'A')
    for (let i = 0; i < 10 && current!.displayedId !== 'B'; i++) await wait(20)
    assert.equal(current!.displayedId, 'B')
    assert.equal(current!.phase, 'loading')
    await act(async () => oldStatus('ready'))
    assert.equal(current!.phase, 'loading')
    assert.deepEqual(statuses, ['ready'])
    await act(async () => current!.sceneStatus('ready'))
    for (let i = 0; i < 40 && current!.phase !== 'idle'; i++) await wait(20)
    assert.equal(current!.phase, 'idle')
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
test.after(async () => {
  await window.happyDOM.abort()
})
