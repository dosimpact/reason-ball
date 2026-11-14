import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import {
  createPixiSceneInteractions,
  projectSceneObjectTarget,
  SceneObjectPointerGesture,
} from '../src/pages/focus/lib/pixiSceneInteractions.ts'
import {
  sceneInteractiveObjectSvg,
  sceneInteractiveLayerSvg,
  sceneInteractivePose,
} from '../src/pages/focus/lib/sceneInteractiveDrawing.ts'
import { frameSceneWorld } from '../src/pages/focus/model/sceneWorldCamera.ts'
import type {
  SceneInteractiveObject,
  SceneObjectReaction,
  SceneObjectReactionFrame,
} from '../src/pages/focus/model/sceneInteractiveTypes.ts'
const object: SceneInteractiveObject = {
  id: 'test-tea',
  roomId: 'test-room',
  label: { en: 'Tea cup', ko: '찻잔', zh: '茶杯' },
  position: { x: 400, y: 600 },
  scale: 0.8,
  surface: { kind: 'table', note: 'test tabletop' },
  art: {
    base: '<ellipse cx="48" cy="87" rx="24" ry="3" fill="#716957"/>',
    subject: '<path d="M28 43H68L63 83H33Z" fill="#b6a58c"/>',
  },
  reaction: { type: 'steam', color: '#b3c0b1', durationMs: 900, description: 'A little steam' },
}
const reactions: SceneObjectReaction[] = [
  'wobble',
  'spin',
  'open',
  'press',
  'glow',
  'ripple',
  'steam',
  'flutter',
  'orbit',
  'pour',
  'sparkle',
  'bounce',
  'unfold',
  'swing',
  'bloom',
  'tick',
]
function frame(type: SceneObjectReaction, progress = 0.4): SceneObjectReactionFrame {
  return {
    id: object.id,
    type,
    progress,
    intensity: Math.sin(progress * Math.PI),
    elapsedMs: progress * 900,
    durationMs: 900,
    trigger: 1,
    reducedMotion: false,
  }
}
const window = new Window()
Object.assign(globalThis, { DOMParser: window.DOMParser, document: window.document })

test('real Pixi compiles prop graphics once and changes only active transforms until exact rest', async () => {
  const pixi = await import('pixi.js')
  let parsed = 0
  class Context extends pixi.GraphicsContext {
    override svg(...args: Parameters<pixi.GraphicsContext['svg']>) {
      parsed++
      return super.svg(...args)
    }
  }
  const native = createPixiSceneInteractions([object], { ...pixi, GraphicsContext: Context })
  const holder = native.container.children[0]!,
    subject = holder.children[1]!
  const contexts = holder.children.map((node) => (node as pixi.Graphics).context)
  const initial = {
    x: subject.position.x,
    y: subject.position.y,
    rotation: subject.rotation,
    alpha: subject.alpha,
  }
  assert.equal(parsed, 3)
  native.advance(500)
  assert.equal(native.activeCount, 0)
  assert.deepEqual(
    {
      x: subject.position.x,
      y: subject.position.y,
      rotation: subject.rotation,
      alpha: subject.alpha,
    },
    initial,
  )
  assert.equal(native.activate('unknown'), false)
  assert.equal(native.activate(object.id), true)
  assert.equal(native.activate(object.id), false)
  native.advance(360)
  assert.equal(native.activeCount, 1)
  assert.notEqual(subject.rotation, 0)
  assert.equal(parsed, 3, 'frames never parse SVG or make textures')
  native.advance(1000)
  assert.deepEqual(
    {
      x: subject.position.x,
      y: subject.position.y,
      rotation: subject.rotation,
      alpha: subject.alpha,
    },
    initial,
  )
  assert.equal(native.activeCount, 0)
  native.destroy()
  native.destroy()
  for (const context of contexts) assert.equal(context.destroyed, true)
  assert.equal(native.activate(object.id), false)
})

test('all sixteen finite reaction poses differ, serialize for CPU QA, and return to byte-identical rest', async () => {
  const { default: sharp } = await import('sharp')
  const poses = new Set<string>()
  for (const type of reactions) {
    const prop = { ...object, reaction: { ...object.reaction, type } }
    const idle = sceneInteractiveObjectSvg(prop)
    const action = sceneInteractiveObjectSvg(prop, frame(type))
    assert.notEqual(action, idle, type)
    poses.add(JSON.stringify(sceneInteractivePose(prop, frame(type))))
    assert.equal(sceneInteractiveObjectSvg(prop, frame(type, 1)), idle)
    assert.equal(sceneInteractiveObjectSvg(prop, frame(type, 0)), idle)
    assert.ok(!/NaN|Infinity|filter|<image|<text/.test(action))
    const pixels = await sharp(Buffer.from(action)).resize(96, 96).raw().toBuffer()
    const resting = await sharp(Buffer.from(idle)).resize(96, 96).raw().toBuffer()
    assert.notDeepEqual(pixels, resting, `${type} visibly reacts`)
    const reduced = { ...frame(type), reducedMotion: true }
    assert.equal(sceneInteractivePose(prop, reduced).subject.rotation, 0)
  }
  assert.equal(poses.size, 16)
  assert.match(sceneInteractiveLayerSvg([object]), /width="800" height="820"/)
})

test('native and software snapshots use identical subject and local effect transforms', async () => {
  const pixi = await import('pixi.js')
  for (const type of reactions) {
    const prop = { ...object, reaction: { ...object.reaction, type } }
    const native = createPixiSceneInteractions([prop], pixi)
    native.activate(prop.id)
    native.advance(360)
    const pose = sceneInteractivePose(prop, native.frame(prop.id))
    const subject = native.container.children[0]!.children[1]!
    assert.equal(subject.position.x, 48 + pose.subject.x)
    assert.equal(subject.position.y, 78 + pose.subject.y)
    assert.equal(subject.rotation, pose.subject.rotation)
    assert.equal(subject.scale.x, pose.subject.scaleX)
    for (let i = 0; i < 3; i++) {
      const effect = native.container.children[0]!.children[2 + i]!
      assert.equal(effect.position.x, 48 + pose.effects[i]!.x)
      assert.equal(effect.alpha, pose.effects[i]!.alpha)
    }
    native.destroy()
  }
})

test('projection follows the same world camera, provides 44px touch bounds and omits clipped props', () => {
  for (const [width, height] of [
    [390, 844],
    [844, 390],
    [1920, 1080],
    [342, 359],
  ]) {
    const camera = frameSceneWorld(width, height),
      target = projectSceneObjectTarget(object, camera)!
    assert.ok(target)
    assert.ok(target.width >= 44 && target.height >= 44)
    const centerX = camera.x + object.position.x * camera.scale
    const centerY = camera.y + (object.position.y - 40 * object.scale) * camera.scale
    assert.ok(Math.abs(target.left + target.width / 2 - centerX) < 1e-8)
    assert.ok(Math.abs(target.top + target.height / 2 - centerY) < 1e-8)
    assert.equal(
      projectSceneObjectTarget({ ...object, position: { x: -400, y: -400 } }, camera),
      null,
    )
    assert.equal(
      projectSceneObjectTarget({ ...object, position: { x: 400, y: 1400 } }, camera),
      null,
    )
  }
  assert.equal(projectSceneObjectTarget({ ...object, scale: NaN }, frameSceneWorld(390, 844)), null)
})

test('large objects target their visible silhouette and reject invalid or fully clipped bounds', () => {
  const camera = frameSceneWorld(1440, 900)
  const prop: SceneInteractiveObject = {
    ...object,
    scale: 2,
    size: 'large',
    interactionBounds: { x: 20, y: 10, width: 56, height: 80 },
  }
  const target = projectSceneObjectTarget(prop, camera)!
  const s = prop.scale * camera.scale
  assert.ok(target)
  assert.ok(Math.abs(target.width - 56 * s) < 1e-8)
  assert.ok(Math.abs(target.height - 80 * s) < 1e-8)
  assert.ok(
    Math.abs(target.left - (camera.x + (prop.position.x - 28 * prop.scale) * camera.scale)) < 1e-8,
  )
  assert.ok(
    Math.abs(target.top - (camera.y + (prop.position.y - 78 * prop.scale) * camera.scale)) < 1e-8,
  )
  for (const bounds of [
    { x: NaN, y: 10, width: 56, height: 80 },
    { x: 20, y: -1, width: 56, height: 80 },
    { x: 20, y: 10, width: 0, height: 80 },
    { x: 20, y: 10, width: 77, height: 80 },
    { x: 20, y: 10, width: 56, height: Infinity },
  ])
    assert.equal(projectSceneObjectTarget({ ...prop, interactionBounds: bounds }, camera), null)
  assert.equal(projectSceneObjectTarget({ ...prop, position: { x: -200, y: 600 } }, camera), null)
})

test('touch/mouse clicks activate once, keyboard stays native, and drag/cancel/scroll sequences are rejected', () => {
  const gesture = new SceneObjectPointerGesture()
  gesture.down(20, 20, 1)
  gesture.move(23, 23, 1)
  assert.equal(gesture.click(), true)
  gesture.down(20, 20, 1)
  gesture.move(20, 50, 1)
  assert.equal(gesture.click(), false)
  gesture.down(20, 20, 1)
  gesture.cancel()
  assert.equal(gesture.click(), false)
  assert.equal(gesture.click(true), true)
})

test('clearing a reduced reaction restores all nodes and cannot resume across a pause', async () => {
  const pixi = await import('pixi.js'),
    native = createPixiSceneInteractions([object], pixi)
  native.activate(object.id, true)
  native.advance(100)
  assert.ok(native.frame(object.id)!.durationMs <= 220)
  const subject = native.container.children[0]!.children[1]!
  assert.equal(subject.rotation, 0)
  assert.ok(subject.alpha < 1)
  native.clear()
  assert.equal(native.activeCount, 0)
  assert.equal(subject.alpha, 1)
  native.advance(100)
  assert.equal(native.frame(object.id), undefined)
  native.activate(object.id, true)
  native.advance(221)
  assert.equal(native.activeCount, 0)
  assert.equal(subject.alpha, 1)
  native.destroy()
})

test('real React transparent targets preserve localized native button activation and cancel dragged touch', async () => {
  const { build } = await import('vite')
  const { fileURLToPath } = await import('node:url')
  await build({
    root: fileURLToPath(new URL('../', import.meta.url)),
    publicDir: false,
    logLevel: 'silent',
    build: {
      ssr: 'src/pages/focus/ui/pixi/SceneInteractiveTargets.tsx',
      outDir: 'node_modules/.cache/scene-interactive-targets',
      emptyOutDir: true,
    },
  })
  for (const name of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'PointerEvent',
  ] as const)
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: name === 'window' ? window : window[name],
    })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  process.env.NODE_ENV = 'development'
  const { createElement, act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { default: Targets } = await import(
    '../node_modules/.cache/scene-interactive-targets/SceneInteractiveTargets.js'
  )
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host),
    activations: string[] = []
  const camera = frameSceneWorld(390, 844)
  const render = (language = 'ko', enabled = true, objects = [object]) =>
    act(async () =>
      root.render(
        createElement(Targets, {
          objects,
          frame: camera,
          language,
          enabled,
          onActivate: (id: string) => activations.push(id),
        }),
      ),
    )
  try {
    await render()
    const button = host.querySelector('button')!
    assert.equal(button.getAttribute('aria-label'), '찻잔')
    assert.equal(button.textContent, '')
    assert.equal(button.getAttribute('title'), null)
    const pointer = (type: string, x: number, y: number) =>
      button.dispatchEvent(
        new window.PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientX: x,
          clientY: y,
        }),
      )
    await act(async () => {
      pointer('pointerdown', 10, 10)
      pointer('pointerup', 10, 10)
      pointer('pointerout', 10, 10)
      button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    assert.deepEqual(activations, [object.id], 'touch end does not duplicate click')
    await act(async () => {
      pointer('pointerdown', 10, 10)
      pointer('pointermove', 10, 40)
      pointer('pointerup', 10, 40)
      pointer('pointerout', 10, 40)
      button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    assert.equal(activations.length, 1)
    await act(async () => {
      pointer('pointerdown', 10, 10)
      pointer('pointerout', 10, 10)
      pointer('pointerup', 10, 10)
      button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    assert.equal(activations.length, 1, 'leaving before release cancels the gesture')
    await act(async () => {
      pointer('pointerdown', 10, 10)
      window.dispatchEvent(new window.Event('scroll'))
      button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    assert.equal(activations.length, 1)
    await act(async () => {
      button.focus()
      button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 0 }))
    })
    assert.equal(activations.length, 2, 'native keyboard-generated click activates')
    await render('zh-CN')
    assert.equal(host.querySelector('button')!.getAttribute('aria-label'), '茶杯')
    await render('en-US')
    assert.equal(host.querySelector('button')!.getAttribute('aria-label'), 'Tea cup')
    await render('en', false)
    assert.equal(host.querySelector('button'), null)
    await render('en', true, [{ ...object, position: { x: -400, y: -400 } }])
    assert.equal(host.querySelector('button'), null, 'no offscreen Tab stop')
  } finally {
    await act(async () => root.unmount())
    host.remove()
    await window.happyDOM.abort()
  }
})

test('actual fullscreen capture lets a hidden-chrome prop react once and leaves empty-scene clicks revealing controls', async (context) => {
  const { build } = await import('vite'),
    { fileURLToPath } = await import('node:url')
  const targetsPath = fileURLToPath(
    new URL('../src/pages/focus/ui/pixi/SceneInteractiveTargets.tsx', import.meta.url),
  )
  // Isolate GPU loading while retaining the real transparent targets and the real fullscreen handlers.
  await build({
    root: fileURLToPath(new URL('../', import.meta.url)),
    publicDir: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'scene-input-gpu-fixture',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === './RuntimeCafe' && importer?.endsWith('/SceneFullscreen.tsx'))
            return '\0scene-input-fixture'
        },
        load(id) {
          if (id === '\0scene-input-fixture')
            return `import React from 'react'; import Targets from ${JSON.stringify(targetsPath)}; export default function Cafe(){return React.createElement('div',{'data-scene-input-fixture':true}, React.createElement(Targets,{objects:[${JSON.stringify(object)}],frame:${JSON.stringify(frameSceneWorld(390, 844))},language:'ko',enabled:true,onActivate:(id)=>window.sceneInputActivations.push(id)}))}`
        },
      },
    ],
    build: {
      ssr: 'src/pages/focus/ui/SceneFullscreen.tsx',
      outDir: 'node_modules/.cache/scene-interactive-fullscreen',
      emptyOutDir: true,
    },
  })
  process.env.NODE_ENV = 'development'
  const { createElement, act } = await import('react'),
    { createRoot } = await import('react-dom/client')
  const { default: Fullscreen } = await import(
    '../node_modules/.cache/scene-interactive-fullscreen/SceneFullscreen.js'
  )
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host),
    activations: string[] = []
  Object.assign(window, { sceneInputActivations: activations })
  const noop = () => {}
  context.mock.timers.enable({ apis: ['setTimeout'] })
  try {
    await act(async () =>
      root.render(
        createElement(Fullscreen, {
          mode: 'sequential',
          onMode: noop,
          onNext: noop,
          backgroundId: 'cafe-rain',
          backgroundName: 'Rain room',
          trackTitle: 'Song',
          playing: false,
          volume: 0.5,
          phase: 'focus',
          status: 'idle',
          timerText: '25:00',
          error: '',
          onToggleMusic: noop,
          onVolume: noop,
          onClose: noop,
        }),
      ),
    )
    const chrome = document.querySelector('[data-testid="fullscreen-controls"]')!,
      prop = document.querySelector('[data-scene-interactive]')!
    await act(async () => context.mock.timers.tick(2501))
    assert.equal(chrome.getAttribute('data-visible'), 'false')
    await act(async () => {
      prop.dispatchEvent(
        new window.PointerEvent('pointerdown', {
          bubbles: true,
          isPrimary: true,
          pointerId: 1,
          button: 0,
        }),
      )
      prop.dispatchEvent(
        new window.PointerEvent('pointerup', {
          bubbles: true,
          isPrimary: true,
          pointerId: 1,
          button: 0,
        }),
      )
      prop.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    assert.deepEqual(activations, [object.id])
    assert.equal(chrome.getAttribute('data-visible'), 'false', 'prop taps do not reveal chrome')
    await act(async () => {
      ;(prop as HTMLElement).focus()
      prop.dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      prop.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 0 }))
    })
    assert.equal(activations.length, 2)
    assert.equal(
      chrome.getAttribute('data-visible'),
      'false',
      'keyboard activation does not reveal chrome',
    )
    const empty = document.querySelector('[data-scene-input-fixture]')!
    await act(async () => {
      empty.dispatchEvent(
        new window.PointerEvent('pointerdown', {
          bubbles: true,
          isPrimary: true,
          pointerId: 2,
          button: 0,
        }),
      )
      empty.dispatchEvent(
        new window.PointerEvent('pointerup', {
          bubbles: true,
          isPrimary: true,
          pointerId: 2,
          button: 0,
        }),
      )
      empty.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    assert.equal(chrome.getAttribute('data-visible'), 'true')
    assert.equal(activations.length, 2)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    context.mock.timers.reset()
    await window.happyDOM.abort()
  }
})

test('actual ritual room keeps its header idle during prop discovery and preserves empty-scene reveal', async (context) => {
  const { build } = await import('vite'),
    { fileURLToPath } = await import('node:url')
  const targetsPath = fileURLToPath(
    new URL('../src/pages/focus/ui/pixi/SceneInteractiveTargets.tsx', import.meta.url),
  )
  await build({
    root: fileURLToPath(new URL('../', import.meta.url)),
    publicDir: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'ritual-scene-input-gpu-fixture',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === '../RuntimeCafe' && importer?.endsWith('/ImmersiveRoom.tsx'))
            return '\0ritual-scene-input-fixture'
        },
        load(id) {
          if (id === '\0ritual-scene-input-fixture')
            return `import React from 'react'; import Targets from ${JSON.stringify(targetsPath)}; export default function Cafe(){return React.createElement('div',{'data-ritual-input-fixture':true}, React.createElement(Targets,{objects:[${JSON.stringify(object)}],frame:${JSON.stringify(frameSceneWorld(390, 844))},language:'ko',enabled:true,onActivate:(id)=>window.ritualInputActivations.push(id)}))}`
        },
      },
    ],
    build: {
      ssr: 'src/pages/focus/ui/ritual/ImmersiveRoom.tsx',
      outDir: 'node_modules/.cache/scene-interactive-ritual',
      emptyOutDir: true,
    },
  })
  process.env.NODE_ENV = 'development'
  const { createElement, act } = await import('react'),
    { createRoot } = await import('react-dom/client')
  const { default: Room } = await import(
    '../node_modules/.cache/scene-interactive-ritual/ImmersiveRoom.js'
  )
  const { defaults, fresh } = await import('../src/pages/focus/model/timer.ts')
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host),
    activations: string[] = []
  Object.assign(window, { ritualInputActivations: activations })
  const noop = () => {}
  context.mock.timers.enable({ apis: ['setTimeout'] })
  try {
    await act(async () =>
      root.render(
        createElement(Room, {
          backgroundId: 'cafe-rain',
          backgroundName: 'Rain room',
          coffeeCount: 0,
          order: null,
          session: fresh('focus', defaults),
          settings: defaults,
          playing: false,
          ambientPlaying: false,
          trackTitle: 'Song',
          error: '',
          blocked: false,
          onSceneStatus: noop,
          onMusicToggle: noop,
          onNext: noop,
          onMode: noop,
          onOpenSettings: noop,
          onRandomBackground: noop,
        }),
      ),
    )
    const chrome = host.querySelector('.ritual-room-header')!,
      prop = host.querySelector('[data-scene-interactive]')!
    await act(async () => context.mock.timers.tick(2501))
    assert.equal(chrome.getAttribute('data-visible'), 'false')
    await act(async () => {
      prop.dispatchEvent(
        new window.PointerEvent('pointerdown', {
          bubbles: true,
          isPrimary: true,
          pointerId: 1,
          button: 0,
        }),
      )
      prop.dispatchEvent(
        new window.PointerEvent('pointerup', {
          bubbles: true,
          isPrimary: true,
          pointerId: 1,
          button: 0,
        }),
      )
      prop.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    assert.deepEqual(activations, [object.id])
    assert.equal(chrome.getAttribute('data-visible'), 'false')
    await act(async () => {
      ;(prop as HTMLElement).focus()
      prop.dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
      prop.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 0 }))
    })
    assert.equal(activations.length, 2)
    assert.equal(chrome.getAttribute('data-visible'), 'false')
    await act(async () =>
      host.querySelector('[data-ritual-input-fixture]')!.dispatchEvent(
        new window.PointerEvent('pointerdown', {
          bubbles: true,
          isPrimary: true,
          pointerId: 2,
          button: 0,
        }),
      ),
    )
    assert.equal(chrome.getAttribute('data-visible'), 'true')
  } finally {
    await act(async () => root.unmount())
    host.remove()
    context.mock.timers.reset()
    await window.happyDOM.abort()
  }
})

test('actual runtime owns finite reduced feedback timers and rejects loading, paused and destroyed activation', async (context) => {
  const { build } = await import('vite'),
    { fileURLToPath } = await import('node:url')
  await build({
    root: fileURLToPath(new URL('../', import.meta.url)),
    publicDir: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'runtime-prop-catalog-fixture',
        enforce: 'pre',
        resolveId(id, importer) {
          if (
            id === '../model/sceneInteractiveObjects.ts' &&
            importer?.endsWith('/pixiSceneRuntime.ts')
          )
            return '\0runtime-prop-catalog-fixture'
        },
        load(id) {
          if (id === '\0runtime-prop-catalog-fixture')
            return `export const getSceneInteractiveObjects=()=>[${JSON.stringify({ ...object, roomId: 'cafe-rain' })}]`
        },
      },
    ],
    build: {
      ssr: 'src/pages/focus/lib/pixiSceneRuntime.ts',
      outDir: 'node_modules/.cache/scene-interactive-runtime',
      emptyOutDir: true,
    },
  })
  const { PixiSceneRuntime } = await import(
    '../node_modules/.cache/scene-interactive-runtime/pixiSceneRuntime.js'
  )
  const pixi = await import('pixi.js')
  let renders = 0,
    starts = 0,
    destroys = 0
  class Application {
    stage = new pixi.Container()
    canvas = document.createElement('canvas')
    renderer = { resize() {} }
    ticker = { maxFPS: 0, add() {} }
    async init() {}
    start() {
      starts++
    }
    stop() {}
    render() {
      renders++
    }
    destroy() {
      destroys++
      this.stage.destroy({ children: true })
    }
  }
  const host = document.createElement('div')
  host.getBoundingClientRect = () => ({ width: 390, height: 844 }) as DOMRect
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const runtime = new PixiSceneRuntime({ id: 'cafe-rain', host, reducedMotion: true })
  try {
    assert.equal(runtime.activateSceneObject(object.id), false)
    await runtime.start({
      pixi: { ...pixi, Application, Assets: { load: async () => ({}), unload: async () => {} } },
      fetchManifest: async () => ({
        version: 1,
        id: 'cafe-rain',
        width: 800,
        height: 820,
        weatherMask: '/backgrounds/mask.png',
        layers: [{ id: 'weather', kind: 'weather' }],
      }),
      motion: { evaluateMotion: () => ({}) },
      weather: {
        createPixiWeather: () => ({ container: new pixi.Container(), update() {}, destroy() {} }),
      },
    })
    assert.equal(starts, 0)
    assert.equal(runtime.activateSceneObject('unknown'), false)
    assert.equal(runtime.activateSceneObject(object.id), true)
    const activeRenders = renders
    context.mock.timers.tick(100)
    assert.ok(renders > activeRenders, 'finite explicit feedback draws with ambient ticker stopped')
    runtime.setPaused(true)
    const pausedRenders = renders
    context.mock.timers.tick(1000)
    assert.equal(renders, pausedRenders)
    assert.equal(runtime.activateSceneObject(object.id), false)
    runtime.setPaused(false)
    assert.equal(starts, 0)
    assert.equal(runtime.activateSceneObject(object.id), true)
    for (let i = 0; i < 8; i++) context.mock.timers.tick(34)
    const restingRenders = renders
    context.mock.timers.tick(1000)
    assert.equal(renders, restingRenders, 'finite reaction leaves no running manual timer')
    assert.equal(runtime.activateSceneObject(object.id), true)
    runtime.destroy()
    const destroyedRenders = renders
    context.mock.timers.tick(1000)
    assert.equal(renders, destroyedRenders)
    assert.equal(runtime.activateSceneObject(object.id), false)
    assert.equal(destroys, 1)
    runtime.destroy()
    assert.equal(destroys, 1)
  } finally {
    runtime.destroy()
    context.mock.timers.reset()
  }
})

test('native compile failure disposes every partially created prop context', async () => {
  const pixi = await import('pixi.js')
  const contexts: pixi.GraphicsContext[] = []
  class Context extends pixi.GraphicsContext {
    override svg(...args: Parameters<pixi.GraphicsContext['svg']>) {
      contexts.push(this)
      if (contexts.length === 3) throw new Error('failed effect parser')
      return super.svg(...args)
    }
  }
  assert.throws(
    () => createPixiSceneInteractions([object], { ...pixi, GraphicsContext: Context }),
    /failed effect parser/,
  )
  assert.equal(contexts.length, 3)
  for (const context of contexts) assert.equal(context.destroyed, true)
})
