import test from 'node:test'
import assert from 'node:assert/strict'
import { frameSceneWorld } from '../src/pages/focus/model/sceneWorldCamera.ts'
import { fitScene } from '../src/pages/focus/model/pixiScene.ts'
import { SCENE_WORLD_BOUNDS as bounds } from '../src/pages/focus/model/sceneWorldCatalog.ts'
test('world camera retains complete core on supported devices while actual surrounding world fills every viewport', () => {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [430, 932],
    [844, 390],
    [768, 1024],
    [1024, 768],
    [1280, 800],
    [1920, 1080],
  ]) {
    const frame = frameSceneWorld(width, height)
    assert.equal(frame.scale, fitScene(width, height).scale)
    assert.ok(frame.x >= -1e-8 && frame.y >= -1e-8)
    assert.ok(frame.x + frame.width <= width + 1e-8 && frame.y + frame.height <= height + 1e-8)
    assert.ok(frame.worldX <= 1e-8 && frame.worldY <= 1e-8)
    assert.ok(
      frame.worldX + frame.worldWidth >= width - 1e-8 &&
        frame.worldY + frame.worldHeight >= height - 1e-8,
    )
    const visible = frame.viewportWorld
    assert.ok(visible.x >= bounds.x - 1e-8 && visible.y >= bounds.y - 1e-8)
    assert.ok(visible.x + visible.width <= bounds.x + bounds.width + 1e-8)
    assert.ok(visible.y + visible.height <= bounds.y + bounds.height + 1e-8)
  }
})
test('extreme aspect ratios cover finite world uniformly and invalid viewports are rejected', () => {
  for (const [width, height] of [
    [10000, 100],
    [100, 10000],
    [1, 1],
  ]) {
    const f = frameSceneWorld(width, height)
    assert.ok(
      Object.values(f)
        .filter((v) => typeof v === 'number')
        .every(Number.isFinite),
    )
    assert.ok(f.worldX <= 1e-7 && f.worldY <= 1e-7)
    assert.ok(f.worldX + f.worldWidth >= width - 1e-7 && f.worldY + f.worldHeight >= height - 1e-7)
    assert.ok(Math.abs(f.width / f.height - 800 / 820) < 1e-10)
  }
  for (const value of [0, -1, NaN, Infinity])
    assert.throws(() => frameSceneWorld(value, 820), RangeError)
})

test('production fallback uses real world SVGs and the same camera after resize and error', async () => {
  const { build } = await import('vite')
  const { Window } = await import('happy-dom')
  await build({
    publicDir: false,
    plugins: [
      {
        name: 'world-gpu-only-fixture',
        enforce: 'pre',
        load(id) {
          if (id.endsWith('/lib/pixiSceneRuntime.ts'))
            return `export class PixiSceneRuntime{constructor(o){this.o=o;this.error=()=>o.onStatus('error','test');window.addEventListener('world-test-error',this.error)}start(){this.o.onStatus('loading')}resize(){}setPaused(){}setCoffeeCount(){}destroy(){window.removeEventListener('world-test-error',this.error)}}`
        },
      },
    ],
    build: {
      ssr: 'src/pages/focus/ui/pixi/PixiScene.tsx',
      outDir: 'node_modules/.cache/world-camera-ui',
      emptyOutDir: true,
    },
    logLevel: 'silent',
  })
  process.env.NODE_ENV = 'development'
  const window = new Window({ url: 'http://localhost:3000' })
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'MutationObserver',
    'Event',
    'CustomEvent',
    'ResizeObserver',
  ] as const)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: key === 'window' ? window : window[key],
    })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  const { createElement, act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { default: Scene } = await import('../node_modules/.cache/world-camera-ui/PixiScene.js')
  const host = window.document.createElement('div')
  window.document.body.append(host)
  const root = createRoot(host)
  let width = 0,
    height = 0
  const old = window.HTMLElement.prototype.getBoundingClientRect
  window.HTMLElement.prototype.getBoundingClientRect = () => ({
    width,
    height,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    toJSON() {},
  })
  try {
    await act(async () => root.render(createElement(Scene, { backgroundId: 'cafe-rain' })))
    const scene = host.querySelector('.pixi-scene')!
    assert.equal(scene.getAttribute('data-scene-fit'), 'world')
    assert.ok(Number.isFinite(Number(scene.getAttribute('data-frame-scale'))))
    assert.equal(host.querySelector('.pixi-ambience'), null)
    assert.equal(host.querySelectorAll('.pixi-world-underlay > svg').length, 1)
    assert.equal(host.querySelectorAll('.pixi-world-joinery > svg').length, 1)
    for (const size of [
      [390, 844],
      [844, 390],
    ]) {
      ;[width, height] = size
      await act(async () => window.dispatchEvent(new window.Event('resize')))
      const f = frameSceneWorld(width, height)
      assert.equal(Number(scene.getAttribute('data-frame-x')), f.x)
      assert.equal(Number(scene.getAttribute('data-world-width')), f.worldWidth)
      assert.equal(
        host.querySelector<HTMLElement>('.pixi-world-projection')!.style.transform,
        `scale(${f.scale})`,
      )
    }
    await act(async () => window.dispatchEvent(new window.Event('world-test-error')))
    assert.equal(scene.getAttribute('data-render-status'), 'error')
    assert.ok(host.querySelector('.pixi-world-core'))
    assert.equal(host.querySelectorAll('.pixi-world-underlay > svg').length, 1)
  } finally {
    act(() => root.unmount())
    window.HTMLElement.prototype.getBoundingClientRect = old
    await window.happyDOM.abort()
  }
})
