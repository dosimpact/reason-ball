import { getSceneInteractiveObjects } from '../src/pages/focus/model/sceneInteractiveObjects.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PixiSceneRuntime,
  type RuntimeDependencies,
} from '../src/pages/focus/lib/pixiSceneRuntime.ts'
import {
  coverScene,
  fitScene,
  cssSkewToPixi,
  sceneRenderQuality,
  planSceneTextures,
  isNativeVectorEligible,
  sceneTexturePriority,
  validatePixiManifest,
  coffeeLayerVisible,
} from '../src/pages/focus/model/pixiScene.ts'
const manifest = {
  version: 1,
  id: 'cafe-rain',
  width: 800,
  height: 820,
  weatherMask: '/backgrounds/mask.png',
  layers: [
    { id: 'rear', src: '/backgrounds/rear.png', x: 0, y: 0, width: 800, height: 820 },
    {
      id: 'cup',
      src: '/backgrounds/cup.png',
      x: 200,
      y: 400,
      width: 50,
      height: 70,
      motions: [{ kind: 'pulse', duration: 2000, pivotX: 225, pivotY: 450 }],
      ifCoffeeMin: 5,
    },
    { id: 'weather', kind: 'weather' },
  ],
}
const propGeometryCount = getSceneInteractiveObjects('cafe-rain').length * 3
const propGraphicCount = getSceneInteractiveObjects('cafe-rain').length * 5
function harness() {
  const stats = {
    init: 0,
    destroy: 0,
    start: 0,
    stop: 0,
    render: 0,
    loads: [] as string[],
    unloads: [] as string[],
    weatherDestroyed: 0,
    nodesDestroyed: 0,
    worldSVGs: [] as string[],
    graphicsRects: [] as number[][],
    graphicsDestroyed: 0,
    clipContextsDestroyed: 0,
    stages: [] as any[],
    geometryParsed: 0,
    geometryDestroyed: 0,
    matrixValues: [] as number[][],
    weatherTime: 0,
    frames: [] as number[],
  }
  const point = () => ({
    x: 0,
    y: 0,
    set(x: number, y = x) {
      this.x = x
      this.y = y
    },
  })
  class Container {
    children: Container[] = []
    parent: Container | null = null
    position = point()
    scale = point()
    pivot = point()
    skew = point()
    rotation = 0
    alpha = 1
    visible = true
    width = 0
    height = 0
    addChild(c: Container) {
      this.children.push(c)
      c.parent = this
      return c
    }
    removeFromParent() {
      if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this)
      this.parent = null
    }
    destroy() {
      stats.nodesDestroyed++
      this.children = []
    }
  }
  class Sprite extends Container {
    constructor(_texture: unknown) {
      super()
    }
  }
  class GraphicsContext {
    instructions = [{ action: 'stroke', data: { style: { miterLimit: 10 } } }]
    svg(_s: string) {
      stats.geometryParsed++
      return this
    }
    destroy() {
      stats.geometryDestroyed++
    }
  }
  class Matrix {
    values: number[]
    constructor(...values: number[]) {
      this.values = values
    }
  }
  class Graphics extends Container {
    constructor(_context?: unknown) {
      super()
    }
    svg(value: string) {
      stats.worldSVGs.push(value)
      return this
    }
    rect(...values: number[]) {
      stats.graphicsRects.push(values)
      return this
    }
    fill(_color: unknown) {
      return this
    }
    destroy(options?: { context?: boolean }) {
      stats.graphicsDestroyed++
      if (options?.context) stats.clipContextsDestroyed++
      super.destroy()
    }
    setFromMatrix(m: Matrix) {
      stats.matrixValues.push(m.values)
    }
  }
  let ticker: ((t: { deltaMS: number }) => void) | undefined
  const canvas = { setAttribute() {}, addEventListener() {}, removeEventListener() {} }
  class Application {
    stage = new Container()
    canvas = canvas
    renderer = { resize() {} }
    ticker = {
      maxFPS: 0,
      add(fn: typeof ticker) {
        ticker = fn
      },
    }
    async init() {
      stats.stages.push(this.stage)
      stats.init++
    }
    start() {
      stats.start++
    }
    stop() {
      stats.stop++
    }
    render() {
      stats.render++
    }
    destroy() {
      const destroyChildren = (node: any) => {
        for (const child of [...node.children]) destroyChildren(child)
        node.destroy()
      }
      destroyChildren(this.stage)
      stats.destroy++
    }
  }
  const host = {
    getBoundingClientRect: () => ({ width: 342, height: 359 }),
    appendChild() {},
  } as unknown as HTMLElement
  const deps = {
    pixi: {
      Application,
      Container,
      Sprite,
      GraphicsContext,
      Graphics,
      Matrix,
      Assets: {
        async load(src: string) {
          stats.loads.push(src)
          return { src }
        },
        async unload(src: string) {
          stats.unloads.push(src)
        },
      },
    },
    fetchManifest: async () => structuredClone(manifest),
    motion: {
      evaluateMotion(_m: unknown, time: number) {
        stats.frames.push(time)
        return { x: time, scaleX: 1, scaleY: 1 }
      },
    },
    weather: {
      createPixiWeather() {
        return {
          container: new Container(),
          update(t: number) {
            stats.weatherTime = t
          },
          destroy() {
            stats.weatherDestroyed++
          },
        }
      },
    },
  } as unknown as RuntimeDependencies
  return { stats, host, deps, tick: () => ticker?.({ deltaMS: 100 }), getCanvas: () => canvas }
}
test('manifest validates dimensions and duplicate layers; cover crop and coffee gates retain authoring coordinates', () => {
  assert.equal(validatePixiManifest(manifest, 'cafe-rain').layers.length, 3)
  assert.throws(() =>
    validatePixiManifest(
      { ...manifest, layers: [manifest.layers[0], manifest.layers[0]] },
      'cafe-rain',
    ),
  )
  assert.throws(() => validatePixiManifest({ ...manifest, width: 900 }, 'cafe-rain'))
  assert.throws(() =>
    validatePixiManifest({ ...manifest, weatherMask: 'https://elsewhere/mask.png' }, 'cafe-rain'),
  )
  assert.throws(() =>
    validatePixiManifest(
      {
        ...manifest,
        layers: [{ ...manifest.layers[0], motion: { kind: 'pulse', duration: NaN } }],
      },
      'cafe-rain',
    ),
  )
  assert.throws(() =>
    validatePixiManifest(
      {
        ...manifest,
        layers: [
          {
            ...manifest.layers[0],
            motion: { kind: 'pulse', duration: 2, keyframes: [{ offset: Infinity }] },
          },
        ],
      },
      'cafe-rain',
    ),
  )

  const c = coverScene(342, 359)
  assert.equal(c.y, 0)
  assert.ok(c.x < 0)
  assert.equal(coffeeLayerVisible(manifest.layers[1], 4), false)
  assert.equal(coffeeLayerVisible(manifest.layers[1], 5), true)
})
test('one async runtime owns GPU, pauses its clock, updates coffee without reloading textures and releases every lease', async () => {
  const h = harness(),
    statuses: string[] = []
  const runtime = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    onStatus: (s) => statuses.push(s),
  })
  await runtime.start(h.deps)
  assert.deepEqual(statuses, ['loading', 'ready'])
  assert.equal(h.stats.init, 1)
  assert.equal(h.stats.start, 1)
  h.tick()
  assert.equal(h.stats.weatherTime, 0.1)
  runtime.setPaused(true)
  h.tick()
  assert.equal(h.stats.weatherTime, 0.1)
  runtime.setPaused(false)
  h.tick()
  assert.equal(h.stats.weatherTime, 0.2)
  runtime.setCoffeeCount(10)
  assert.equal(h.stats.loads.length, 2)
  runtime.destroy()
  runtime.destroy()
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(h.stats.destroy, 1)
  assert.equal(h.stats.weatherDestroyed, 1)
  assert.equal(h.stats.unloads.length, 2)
})
test('destroyed pending manifest/init never publishes a ready canvas or starts ticker', async () => {
  const h = harness()
  let resolve!: (v: unknown) => void
  h.deps.fetchManifest = () => new Promise((r) => (resolve = r))
  const statuses: string[] = []
  const runtime = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    onStatus: (s) => statuses.push(s),
  })
  const pending = runtime.start(h.deps)
  runtime.destroy()
  resolve(manifest)
  await pending
  assert.deepEqual(statuses, ['loading'])
  assert.equal(h.stats.init, 0)
  assert.equal(h.stats.start, 0)
  const h2 = harness()
  let finish!: () => void
  h2.deps.pixi.Application.prototype.init = () => new Promise<void>((r) => (finish = r))
  const second = new PixiSceneRuntime({ id: 'cafe-rain', host: h2.host })
  const starting = second.start(h2.deps)
  for (let i = 0; i < 5 && !finish; i++) await Promise.resolve()
  second.destroy()
  finish()
  await starting
  assert.equal(h2.stats.destroy, 1)
  assert.equal(h2.stats.start, 0)
})
test('manifest and texture failure report error, dispose partial GPU state, and never claim ready', async () => {
  const h = harness(),
    statuses: string[] = []
  h.deps.pixi.Assets.load = async () => {
    throw Error('texture failed')
  }
  const runtime = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    onStatus: (s) => statuses.push(s),
  })
  await runtime.start(h.deps)
  assert.deepEqual(statuses, ['loading', 'error'])
  assert.equal(h.stats.destroy, 1)
  assert.equal(h.stats.start, 0)
})
test('reduced motion renders a stationary frame and never starts animation ticker', async () => {
  const h = harness()
  const runtime = new PixiSceneRuntime({ id: 'cafe-rain', host: h.host, reducedMotion: true })
  await runtime.start(h.deps)
  assert.equal(h.stats.start, 0)
  assert.ok(h.stats.render > 0)
  runtime.setPaused(false)
  assert.equal(h.stats.start, 0)
  runtime.destroy()
})

test('loading cannot start ticker early; repeated start is idempotent', async () => {
  const h = harness()
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  h.deps.pixi.Assets.load = async () => {
    await gate
    return {} as never
  }
  const scene = new PixiSceneRuntime({ id: 'cafe-rain', host: h.host })
  const pending = scene.start(h.deps)
  for (let i = 0; i < 6; i++) await Promise.resolve()
  scene.setPaused(false)
  await scene.start(h.deps)
  assert.equal(h.stats.start, 0)
  release()
  await pending
  assert.equal(h.stats.init, 1)
  assert.equal(h.stats.start, 1)
  scene.destroy()
})
test('failed initialization and throwing status observers still release GPU ownership', async () => {
  const h = harness()
  h.deps.pixi.Application.prototype.init = async () => {
    throw Error('init failed')
  }
  const scene = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    onStatus() {
      throw Error('observer')
    },
  })
  await scene.start(h.deps)
  assert.equal(h.stats.destroy, 1)
  const next = harness()
  const healthy = new PixiSceneRuntime({ id: 'cafe-rain', host: next.host })
  await healthy.start(next.deps)
  assert.equal(next.stats.start, 1)
  healthy.destroy()
})
test('new texture users await in-flight unload before acquiring their own sources', async () => {
  const first = harness(),
    finishes: (() => void)[] = []
  first.deps.pixi.Assets.unload = () =>
    new Promise<void>((resolve) => finishes.push(resolve)) as never
  const a = new PixiSceneRuntime({ id: 'cafe-rain', host: first.host })
  await a.start(first.deps)
  a.destroy()
  for (let i = 0; i < 6; i++) await Promise.resolve()
  assert.equal(finishes.length, 2)
  const second = harness(),
    b = new PixiSceneRuntime({ id: 'cafe-rain', host: second.host })
  const pending = b.start(second.deps)
  for (let i = 0; i < 8; i++) await Promise.resolve()
  assert.equal(
    second.stats.loads.length,
    0,
    'a source cannot be reused while prior owner unloads it',
  )
  for (const finish of finishes) finish()
  await pending
  assert.equal(second.stats.loads.length, 2)
  b.destroy()
})

test('failed dynamic clip loading destroys the unattached sprite tree and reports failure', async () => {
  const h = harness(),
    statuses: string[] = []
  h.deps.fetchManifest = async () => ({
    ...structuredClone(manifest),
    layers: [{ ...manifest.layers[0], clipMask: '/backgrounds/failed-clip.png' }],
  })
  h.deps.pixi.Assets.load = async (src: string) => {
    if (src === '/backgrounds/failed-clip.png') throw Error('mask failed')
    return {} as never
  }
  const scene = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    onStatus: (s) => statuses.push(s),
  })
  await scene.start(h.deps)
  assert.deepEqual(statuses, ['loading', 'error'])
  assert.ok(h.stats.nodesDestroyed > 0, 'unattached sprite is disposed on mask failure')
  assert.equal(h.stats.destroy, 1)
})

test('real Pixi local matrix matches CSS skew on both axes, including rotation and scale', async () => {
  const { Container } = await import('pixi.js')
  for (const [x, y, rotation, sx, sy] of [
    [0.2, 0, 0, 1, 1],
    [0, -0.21, 0, 0.16, 1],
    [0.15, -0.12, 0.4, 0.7, 1.2],
  ]) {
    const transform = cssSkewToPixi({ skewX: x, skewY: y, scaleX: sx, scaleY: sy })
    const node = new Container()
    node.skew.set(transform.skewX, transform.skewY)
    node.scale.set(transform.scaleX, transform.scaleY)
    node.rotation = rotation
    node.updateLocalTransform()
    const c = Math.cos(rotation),
      s = Math.sin(rotation),
      matrix = node.localTransform
    const expected = {
      a: sx * (c - s * Math.tan(y)),
      b: sx * (s + c * Math.tan(y)),
      c: sy * (c * Math.tan(x) - s),
      d: sy * (s * Math.tan(x) + c),
    }
    for (const key of ['a', 'b', 'c', 'd'] as const)
      assert.ok(Math.abs(matrix[key] - expected[key]) < 1e-10, `${key} preserves CSS shear matrix`)
    node.destroy()
  }
  for (const value of [Infinity, NaN, Math.PI / 2, -Math.PI / 2]) {
    const t = cssSkewToPixi({ skewX: value, skewY: value })
    assert.ok(Object.values(t).every(Number.isFinite))
    assert.ok(Math.abs(t.scaleX) < 12 && Math.abs(t.scaleY) < 12)
  }
})

test('quality follows fitted texel density and caps canvas pixels/edge independently from source tier', () => {
  assert.equal(sceneRenderQuality(342, 359, 2).tier, 'base')
  assert.equal(sceneRenderQuality(342, 359, 2, true).tier, 'high')
  assert.equal(sceneRenderQuality(800, 820, 2).tier, 'high')
  for (const [w, h, dpr] of [
    [390, 844, 3],
    [3840, 2160, 3],
    [10000, 10000, 4],
    [100000, 100000, 4],
  ]) {
    const q = sceneRenderQuality(w, h, dpr)
    assert.ok(q.resolution <= 2)
    assert.ok(w * h * q.resolution * q.resolution <= 4_000_000.01)
    assert.ok(Math.max(w, h) * q.resolution <= 4096.01)
  }
})
test('fullscreen requests high sprites and high masks; only the visible coffee variant is loaded', async () => {
  const h = harness(),
    rebuilt: string[] = []
  h.deps.fetchManifest = async () => ({
    ...structuredClone(manifest),
    weatherMaskHigh: '/backgrounds/mask-high.png',
    layers: [
      {
        ...manifest.layers[0],
        srcHigh: '/backgrounds/rear-high.png',
        clipMask: '/backgrounds/clip.png',
        clipMaskHigh: '/backgrounds/clip-high.png',
      },
      { ...manifest.layers[1], srcHigh: '/backgrounds/cup-high.png' },
      manifest.layers[2],
    ],
  })
  const scene = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    fullscreen: true,
    onRebuild: () => rebuilt.push('coffee'),
  })
  await scene.start(h.deps)
  assert.deepEqual([...h.stats.loads].sort(), [
    '/backgrounds/clip-high.png',
    '/backgrounds/mask-high.png',
    '/backgrounds/rear-high.png',
  ])
  scene.setCoffeeCount(5)
  scene.setCoffeeCount(6)
  assert.deepEqual(rebuilt, ['coffee'], 'variant boundary asks for exactly one safe rebuild')
  scene.destroy()
})
test('crossing source density tiers on resize requests a safe resource rebuild', async () => {
  const h = harness()
  let width = 342,
    height = 359,
    rebuilds = 0
  h.host.getBoundingClientRect = () => ({ width, height }) as DOMRect
  const scene = new PixiSceneRuntime({ id: 'cafe-rain', host: h.host, onRebuild: () => rebuilds++ })
  await scene.start(h.deps)
  width = 1400
  height = 900
  scene.resize()
  scene.resize()
  assert.equal(rebuilds, 1)
  scene.destroy()
})

test('a viewport tier change during pending texture load is reconciled before publishing ready', async () => {
  const h = harness()
  let width = 342,
    height = 359,
    rebuilds = 0,
    release!: () => void
  const statuses: string[] = []
  h.host.getBoundingClientRect = () => ({ width, height }) as DOMRect
  const gate = new Promise<void>((r) => (release = r))
  h.deps.pixi.Assets.load = async () => {
    await gate
    return {} as never
  }
  const scene = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    onRebuild: () => rebuilds++,
    onStatus: (s) => statuses.push(s),
  })
  const start = scene.start(h.deps)
  for (let i = 0; i < 8; i++) await Promise.resolve()
  width = 1400
  height = 900
  scene.resize()
  release()
  await start
  assert.equal(rebuilds, 1)
  assert.deepEqual(statuses, ['loading'], 'stale low tier never claims ready')
  assert.equal(h.stats.start, 0)
  scene.destroy()
})

test('high texture budget prioritizes rear and structural art while bounding decoded RGBA estimates', () => {
  const fullFrame = {
    id: 'art-future-furniture',
    src: '/backgrounds/furniture.png',
    x: 0,
    y: 0,
    width: 800,
    height: 820,
    sourceTag: 'path',
    sourceRole: 'structural' as const,
  }
  assert.equal(
    sceneTexturePriority(fullFrame),
    95,
    'full-frame structural art is not guessed to be a soft effect',
  )
  assert.equal(
    sceneTexturePriority({ ...fullFrame, sourceRole: 'soft-effect' }),
    20,
    'explicit authored soft role controls priority',
  )

  const layers = ['rear', 'art-0', 'effect-0', 'effect-1', 'effect-2'].map((id) => ({
    id,
    src: `/backgrounds/${id}.png`,
    srcHigh: `/backgrounds/${id}-high.png`,
    x: 0,
    y: 0,
    width: 800,
    height: 820,
  }))
  const m = { ...manifest, weatherMaskHigh: '/backgrounds/mask-high.png', layers } as Parameters<
    typeof planSceneTextures
  >[0]
  const plan = planSceneTextures(m, 'high', 0)
  assert.equal(plan.layers.rear!.src, '/backgrounds/rear-high.png')
  assert.equal(plan.layers['art-0']!.src, '/backgrounds/art-0-high.png')
  assert.ok(plan.estimatedBytes <= 96 * 1024 * 1024)
  assert.ok(
    Object.values(plan.layers).some((l) => !l.src.includes('-high')) ||
      plan.weatherMask === manifest.weatherMask,
  )
})

test('all exported rooms keep rear and structural character art high within the texture budget', async () => {
  const { readdirSync, readFileSync } = await import('node:fs')
  const root = new URL('../public/backgrounds/pixi/', import.meta.url)
  const rooms = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())
  assert.equal(rooms.length, 68)
  for (const room of rooms) {
    const m = validatePixiManifest(
      JSON.parse(readFileSync(new URL(`${room.name}/manifest.json`, root), 'utf8')),
      room.name,
    )
    for (const coffee of [0, 1, 5, 10, 25]) {
      const plan = planSceneTextures(m, 'high', coffee)
      assert.ok(plan.estimatedBytes <= 96 * 1024 * 1024, `${room.name} respects texture estimate`)
      for (const layer of m.layers)
        if (
          plan.layers[layer.id] &&
          !isNativeVectorEligible(layer) &&
          sceneTexturePriority(layer) >= 95
        ) {
          assert.equal(
            plan.layers[layer.id]!.src,
            layer.srcHigh,
            `${room.name} ${layer.id} keeps structural detail high`,
          )
        }
    }
  }
})

const vectorFixture = {
  primitiveCount: 1,
  sourceBounds: { x: 10, y: 20, width: 30, height: 40 },
  parts: [
    {
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="30" height="40" fill="#abcdef" stroke="none"/></svg>',
      matrix: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number],
      primitiveCount: 1,
    },
  ],
}
test('native vector parts share geometry, retain world matrices and never load their PNG fallback', async () => {
  const h = harness(),
    reports: { native: number; raster: number; fallback: number }[] = []
  h.deps.fetchManifest = async () => ({
    ...structuredClone(manifest),
    layers: [
      { ...manifest.layers[0], id: 'vector-1', vector: vectorFixture },
      {
        ...manifest.layers[0],
        id: 'vector-2',
        vector: {
          ...vectorFixture,
          parts: [{ ...vectorFixture.parts[0]!, matrix: [0, 1, -1, 0, 500, 10] }],
        },
      },
      manifest.layers[2],
    ],
  })
  const scene = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    onVectorStats: (s) => reports.push(s),
  })
  await scene.start(h.deps)
  assert.deepEqual(reports, [{ native: 2, raster: 0, fallback: 0 }])
  assert.deepEqual(h.stats.loads, ['/backgrounds/mask.png'])
  assert.equal(
    h.stats.geometryParsed,
    1 + propGeometryCount,
    'one shared layer context plus three compiled contexts per interactive prop',
  )
  assert.equal(h.stats.matrixValues.length, 2)
  assert.deepEqual(h.stats.matrixValues[1], [0, 1, -1, 0, 500, 10])
  assert.equal(h.stats.geometryDestroyed, 0, 'live siblings retain their shared context')
  scene.destroy()
  assert.equal(
    h.stats.geometryDestroyed,
    1 + propGeometryCount,
    'shared layer geometry releases once and every prop context releases once',
  )
})
test('native parsing failure replans raster texture memory and reports an explicit fallback', async () => {
  const h = harness(),
    reports: { native: number; raster: number; fallback: number }[] = []
  const originalSvg = h.deps.pixi.GraphicsContext.prototype.svg
  h.deps.pixi.GraphicsContext.prototype.svg = function (svg: string) {
    if (svg === vectorFixture.parts[0]!.svg) throw Error('native parser failed')
    return originalSvg.call(this, svg)
  }
  h.deps.fetchManifest = async () => ({
    ...structuredClone(manifest),
    layers: [{ ...manifest.layers[0], vector: vectorFixture }, manifest.layers[2]],
  })
  const scene = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    onVectorStats: (s) => reports.push(s),
  })
  await scene.start(h.deps)
  assert.deepEqual(reports, [{ native: 0, raster: 1, fallback: 1 }])
  assert.ok(h.stats.loads.includes('/backgrounds/rear.png'))
  assert.equal(h.stats.geometryDestroyed, 1)
  assert.equal(h.stats.start, 1)
  scene.destroy()
})
test('texture budget omits validated native geometry but includes raster-safe fallback', () => {
  const layer = { ...manifest.layers[0]!, vector: vectorFixture }
  const native = planSceneTextures({ ...manifest, layers: [layer] }, 'high', 0)
  const raster = planSceneTextures(
    { ...manifest, layers: [{ ...layer, vector: undefined }] },
    'high',
    0,
  )
  assert.ok(native.estimatedBytes < raster.estimatedBytes)
  assert.equal(native.estimatedBytes, 800 * 820 * 4, 'only the weather mask consumes texture bytes')
})

test('actual Pixi shared GraphicsContext survives sibling Graphics disposal until owner release', async () => {
  const { Graphics, GraphicsContext, Point } = await import('pixi.js')
  const context = new GraphicsContext().rect(10, 20, 30, 40).fill('#abcdef')
  const first = new Graphics(context),
    second = new Graphics(context)
  first.destroy({ context: false })
  assert.equal(context.destroyed, false)
  assert.equal(second.context.containsPoint(new Point(20, 30)), true)
  second.destroy({ context: false })
  assert.equal(context.destroyed, false)
  context.destroy()
  assert.equal(context.destroyed, true)
})

test('character artwork always loads raster and remains in the texture budget despite valid vector metadata', () => {
  const layer = { ...manifest.layers[0]!, sourceRole: 'character' as const, vector: vectorFixture }
  assert.equal(isNativeVectorEligible(layer), false)
  const selected = planSceneTextures({ ...manifest, layers: [layer] }, 'high', 0)
  const expected = planSceneTextures(
    { ...manifest, layers: [{ ...layer, vector: undefined }] },
    'high',
    0,
  )
  assert.deepEqual(selected, expected)
  assert.ok(selected.estimatedBytes > 800 * 820 * 4)
})

test('fit preserves every authored edge with centered letterboxing across phone, tablet, desktop and custom artboards', () => {
  for (const [w, h, sw, sh] of [
    [390, 844, 800, 820],
    [844, 390, 800, 820],
    [768, 1024, 800, 820],
    [1280, 800, 800, 820],
    [1920, 1080, 800, 820],
    [500, 500, 1000, 300],
  ]) {
    const frame = fitScene(w, h, sw, sh)
    assert.ok(frame.x >= -1e-10 && frame.y >= -1e-10)
    assert.ok(frame.x + frame.width <= w + 1e-10 && frame.y + frame.height <= h + 1e-10)
    assert.ok(Math.abs(frame.width / frame.height - sw / sh) < 1e-10)
    assert.ok(Math.abs(frame.x * 2 + frame.width - w) < 1e-10)
    assert.ok(Math.abs(frame.y * 2 + frame.height - h) < 1e-10)
    assert.ok(Math.abs(frame.width - w) < 1e-10 || Math.abs(frame.height - h) < 1e-10)
  }
  for (const value of [0, -1, NaN, Infinity]) {
    assert.throws(() => fitScene(value, 820), RangeError)
    assert.throws(() => fitScene(800, 820, value, 820), RangeError)
  }
  assert.equal(
    sceneRenderQuality(390, 1400, 2).tier,
    'base',
    'tall letterbox height must not force high artwork tier',
  )
})
test('runtime fits one masked world on resize and rotation, ignores invalid host bounds and releases clip geometry', async () => {
  const h = harness()
  let width = 390,
    height = 844,
    rebuilds = 0
  const frames: ReturnType<typeof fitScene>[] = []
  h.host.getBoundingClientRect = () => ({ width, height }) as DOMRect
  const runtime = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    fullscreen: true,
    onFraming: (frame) => frames.push(frame),
    onRebuild: () => rebuilds++,
  })
  await runtime.start(h.deps)
  const world = h.stats.stages[0].children[0]
  const core = world.children[1]
  assert.equal(core.mask, core.children[0])
  assert.equal(world.children.length, 3)
  assert.equal(h.stats.worldSVGs.length, 2)
  assert.deepEqual(h.stats.graphicsRects, [[0, 0, 800, 820]])
  for (const dimensions of [
    [390, 844],
    [844, 390],
    [768, 1024],
    [1280, 800],
    [1280, 800],
  ]) {
    ;[width, height] = dimensions
    runtime.resize()
    const frame = frames.at(-1)!
    assert.deepEqual(
      { x: world.position.x, y: world.position.y, scale: world.scale.x },
      { x: frame.x, y: frame.y, scale: frame.scale },
    )
    assert.equal(world.scale.x, world.scale.y)
    assert.ok(frame.x >= 0 && frame.y >= 0)
    assert.ok(
      frame.x + 800 * frame.scale <= width + 1e-8 && frame.y + 820 * frame.scale <= height + 1e-8,
    )
  }
  const count = frames.length
  width = NaN
  runtime.resize()
  width = 0
  runtime.resize()
  width = Infinity
  runtime.resize()
  assert.equal(frames.length, count)
  assert.equal(h.stats.init, 1)
  assert.equal(rebuilds, 0)
  runtime.destroy()
  assert.equal(h.stats.graphicsDestroyed, 3 + propGraphicCount)
  assert.equal(h.stats.clipContextsDestroyed, 3)
  assert.equal(h.stats.destroy, 1)
})

test('partial world clip initialization failure still releases clip and GPU ownership', async () => {
  const h = harness()
  const Original = h.deps.pixi.Graphics
  h.deps.pixi.Graphics = class extends Original {
    fill() {
      throw Error('clip initialization failed')
    }
  } as typeof Original
  const statuses: string[] = []
  const runtime = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    onStatus: (status) => statuses.push(status),
  })
  await runtime.start(h.deps)
  assert.equal(statuses.at(-1), 'error')
  assert.equal(h.stats.graphicsDestroyed, 3)
  assert.equal(h.stats.clipContextsDestroyed, 3)
  assert.equal(h.stats.destroy, 1)
  runtime.destroy()
  assert.equal(h.stats.destroy, 1)
})

test('actual Pixi world rectangle bounds and owned context teardown support a scaled scene mask', async () => {
  const { Container, Graphics, Point } = await import('pixi.js')
  const world = new Container()
  const clip = new Graphics().rect(0, 0, 800, 820).fill(0xffffff)
  const context = clip.context
  world.addChild(clip)
  world.mask = clip
  assert.equal(context.containsPoint(new Point(799, 819)), true)
  assert.equal(context.containsPoint(new Point(801, 819)), false)
  assert.equal(context.containsPoint(new Point(799, 821)), false)
  world.mask = null
  clip.removeFromParent()
  clip.destroy({ context: true })
  assert.equal(context.destroyed, true)
  assert.equal(world.children.length, 0)
  world.destroy({ children: true })
})

test('world SVG parser failure is explicit and destroys its partially owned context without publishing ready', async () => {
  const h = harness()
  const Original = h.deps.pixi.Graphics
  h.deps.pixi.Graphics = class extends Original {
    svg() {
      throw Error('world SVG parse failed')
    }
  } as typeof Original
  const statuses: string[] = []
  const runtime = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    onStatus: (status) => statuses.push(status),
  })
  await runtime.start(h.deps)
  assert.deepEqual(statuses, ['loading', 'error'])
  assert.equal(h.stats.clipContextsDestroyed, 1)
  assert.equal(h.stats.graphicsDestroyed, 1)
  assert.equal(h.stats.destroy, 1)
  assert.equal(h.stats.loads.length, 0)
  runtime.destroy()
  assert.equal(h.stats.clipContextsDestroyed, 1)
})

test('bodyless animal slots own cached native rigs, fixed masks and paused/reduced lifecycle without PNG bodies', async () => {
  const { getAnimalHabitat } = await import('../src/pages/focus/model/animalHabitats.ts')
  const animal = getAnimalHabitat('cafe-rain').actors[0]!
  const slot = {
    id: 'animal-0',
    kind: 'animal',
    animalId: animal.id,
    clipMask: '/backgrounds/animal-mask.png',
  }
  const fresh = {
    ...structuredClone(manifest),
    animalLifeVersion: 1,
    layers: [manifest.layers[0], slot, { id: 'weather', kind: 'weather' }],
  }
  assert.throws(() => validatePixiManifest({ ...fresh, animalLifeVersion: undefined }, 'cafe-rain'))
  assert.throws(() =>
    validatePixiManifest(
      { ...fresh, layers: [{ ...slot, src: '/backgrounds/ghost.png' }] },
      'cafe-rain',
    ),
  )
  const plan = planSceneTextures(fresh as any, 'base', 0)
  assert.equal(plan.layers['animal-0']!.src, undefined)
  assert.equal(plan.layers['animal-0']!.clipMask, slot.clipMask)
  for (const reducedMotion of [false, true]) {
    const h = harness()
    h.deps.fetchManifest = async () => structuredClone(fresh)
    const runtime = new PixiSceneRuntime({ id: 'cafe-rain', host: h.host, reducedMotion })
    await runtime.start(h.deps)
    const life = (runtime as any).animals
    assert.ok(life)
    const parsed = h.stats.geometryParsed
    assert.ok(parsed > 0)
    const wrapper = (runtime as any).layers.find((item: any) => item.layer.kind === 'animal').node
    assert.equal(wrapper.mask.width, 800)
    assert.equal(wrapper.mask.height, 820)
    const initial = life.snapshot()
    for (let i = 0; i < 5; i++) h.tick()
    if (reducedMotion) assert.deepEqual(life.snapshot(), initial)
    else assert.ok(life.snapshot()[0].time > initial[0].time)
    runtime.setPaused(true)
    const paused = life.snapshot()
    h.tick()
    h.tick()
    assert.deepEqual(life.snapshot(), paused)
    assert.equal(
      h.stats.geometryParsed,
      parsed,
      'animation changes transforms without reparsing SVG',
    )
    assert.ok(!h.stats.loads.some((path) => path.includes('ghost')))
    runtime.destroy()
    runtime.destroy()
    h.tick()
    assert.equal(h.stats.geometryDestroyed, parsed)
    assert.equal(life.getNode(animal.id), undefined)
  }
})

test('destroying a bodyless scene while its aperture mask loads cannot resurrect native animals', async () => {
  const { getAnimalHabitat } = await import('../src/pages/focus/model/animalHabitats.ts')
  const animal = getAnimalHabitat('cafe-rain').actors[0]!
  const h = harness(),
    originalLoad = h.deps.pixi.Assets.load
  let resolve!: (value: any) => void,
    waiting = false
  h.deps.pixi.Assets.load = ((src: string) => {
    if (src === '/backgrounds/pending-animal-mask.png') {
      waiting = true
      return new Promise((done) => {
        resolve = done
      })
    }
    return originalLoad(src)
  }) as typeof originalLoad
  h.deps.fetchManifest = async () => ({
    ...structuredClone(manifest),
    animalLifeVersion: 1,
    layers: [
      manifest.layers[0],
      {
        id: 'living',
        kind: 'animal',
        animalId: animal.id,
        clipMask: '/backgrounds/pending-animal-mask.png',
      },
      { id: 'weather', kind: 'weather' },
    ],
  })
  const statuses: string[] = []
  const runtime = new PixiSceneRuntime({
    id: 'cafe-rain',
    host: h.host,
    onStatus: (status) => statuses.push(status),
  })
  const starting = runtime.start(h.deps)
  for (let i = 0; i < 100 && !waiting; i++) await Promise.resolve()
  assert.equal(waiting, true)
  const parsed = h.stats.geometryParsed
  runtime.destroy()
  resolve({})
  await starting
  assert.ok(!statuses.includes('ready'))
  assert.equal(h.stats.geometryDestroyed, parsed)
  assert.equal(h.stats.destroy, 1)
})
