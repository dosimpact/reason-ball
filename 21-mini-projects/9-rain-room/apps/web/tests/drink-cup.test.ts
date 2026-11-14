import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { build } from 'vite'
await build({
  publicDir: false,
  build: {
    ssr: 'src/pages/focus/ui/ritual/DrinkCup.tsx',
    outDir: 'node_modules/.cache/drink-cup',
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

const { default: DrinkCup } = await import('../node_modules/.cache/drink-cup/DrinkCup.js')
test('all menu drinks render native matte SVG with distinct shapes and opt-in vapor', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const { DRINKS } = await import('../src/pages/focus/model/cafeRitual.ts')
  const shapes = new Set<string>()
  try {
    for (const { id } of DRINKS) {
      await act(async () =>
        root.render(createElement(DrinkCup, { drinkId: id, temperature: 'hot', size: 68 })),
      )
      assert.equal(host.querySelectorAll('svg').length, 1)
      assert.equal(
        host.querySelector('img,image,foreignObject,linearGradient,radialGradient'),
        null,
      )
      assert.equal(host.querySelector('.ritual-steam,.ritual-aroma'), null)
      assert.equal(host.querySelector('[href],[src]'), null)
      shapes.add(host.querySelector('svg').getAttribute('data-cup-shape'))
      assert.equal(
        host.querySelector('.ritual-drink-artwork').style.getPropertyValue('--drink-size'),
        '68px',
      )
      await act(async () =>
        root.render(
          createElement(DrinkCup, { drinkId: id, temperature: 'iced', steam: true, size: 156 }),
        ),
      )
      assert.equal(host.querySelectorAll('[data-drink-ice] rect').length, 3)
      assert.equal(host.querySelectorAll('.ritual-aroma path').length, 3)
    }
    assert.equal(shapes.size, 10, 'each drink has an authored cup silhouette')
    await act(async () =>
      root.render(
        createElement(DrinkCup, { drinkId: 'americano', temperature: 'hot', steam: true }),
      ),
    )
    assert.equal(host.querySelectorAll('.ritual-steam path').length, 3)
    assert.equal(host.querySelector('[data-drink-ice]'), null)
  } finally {
    act(() => root.unmount())
    host.remove()
    await window.happyDOM.abort()
  }
})
