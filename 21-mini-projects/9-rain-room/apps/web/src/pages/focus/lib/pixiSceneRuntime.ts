import { getSceneInteractiveObjects } from '../model/sceneInteractiveObjects.ts'
import { createPixiSceneInteractions } from './pixiSceneInteractions.ts'
import { getAnimalHabitat } from '../model/animalHabitats.ts'
import { createPixiAnimalLife } from './pixiAnimalLife.ts'
import { frameSceneWorld, type SceneWorldFrame } from '../model/sceneWorldCamera.ts'
import { SCENE_WORLD_BOUNDS } from '../model/sceneWorldCatalog.ts'
import { sceneWorldSvg } from './sceneWorldArt.ts'
import type { Application, Container, Texture, GraphicsContext, Graphics } from 'pixi.js'
import {
  coffeeLayerVisible,
  cssSkewToPixi,
  sceneRenderQuality,
  planSceneTextures,
  isNativeVectorEligible,
  nativeVectorParts,
  type SceneTextureTier,
  sceneManifestUrl,
  validatePixiManifest,
  type PixiSceneManifest,
  type PixiSceneLayer,
  type PixiMotion,
} from '../model/pixiScene.ts'
import { getSceneWeather } from '../model/sceneWeather.ts'
export interface SceneRuntimeOptions {
  id: string
  host: HTMLElement
  coffeeCount?: number
  reducedMotion?: boolean
  fullscreen?: boolean
  onFraming?: (frame: SceneWorldFrame) => void
  onRebuild?: () => void
  onQuality?: (tier: SceneTextureTier, resolution: number) => void
  onVectorStats?: (stats: { native: number; raster: number; fallback: number }) => void
  onStatus?: (status: 'loading' | 'ready' | 'error', error?: string) => void
}
export interface RuntimeDependencies {
  pixi: typeof import('pixi.js')
  fetchManifest: (url: string, signal: AbortSignal) => Promise<unknown>
  motion: typeof import('./pixiSceneMotion')
  weather: typeof import('./pixiWeather')
}
let gpuQueue: Promise<void> = Promise.resolve()
type TextureLeaseEntry = { refs: number; promise: Promise<Texture>; unloading?: Promise<void> }
const textures = new Map<string, TextureLeaseEntry>()
async function acquire(
  src: string,
  pixi: RuntimeDependencies['pixi'],
): Promise<{ texture: Texture; release: () => void }> {
  let entry = textures.get(src)
  if (entry?.unloading) {
    await entry.unloading
    return acquire(src, pixi)
  }
  if (!entry) {
    entry = { refs: 0, promise: pixi.Assets.load<Texture>(src) }
    textures.set(src, entry)
  }
  entry.refs++
  let released = false
  const release = () => {
    if (released) return
    released = true
    entry!.refs--
    if (entry!.refs === 0) {
      entry!.unloading = entry!.promise
        .then(() => pixi.Assets.unload(src))
        .then(
          () => {},
          () => {},
        )
        .finally(() => {
          if (textures.get(src) === entry) textures.delete(src)
        })
    }
  }
  try {
    return { texture: await entry.promise, release }
  } catch (error) {
    release()
    throw error
  }
}
const geometryContexts = new Map<string, { context: GraphicsContext; refs: number }>()
function acquireGeometry(svg: string, pixi: RuntimeDependencies['pixi']) {
  let entry = geometryContexts.get(svg)
  if (!entry) {
    const context = new pixi.GraphicsContext()
    try {
      context.svg(svg)
      for (const instruction of context.instructions)
        if (instruction.action === 'stroke')
          instruction.data.style = { ...instruction.data.style, miterLimit: 4 }
    } catch (error) {
      context.destroy()
      throw error
    }
    entry = { context, refs: 0 }
    geometryContexts.set(svg, entry)
  }
  entry.refs++
  let released = false
  return {
    context: entry.context,
    release: () => {
      if (released) return
      released = true
      entry!.refs--
      if (entry!.refs === 0) {
        geometryContexts.delete(svg)
        entry!.context.destroy()
      }
    },
  }
}
export async function browserPixiDependencies(): Promise<RuntimeDependencies> {
  const [pixi, motion, weather] = await Promise.all([
    import('pixi.js'),
    import('./pixiSceneMotion'),
    import('./pixiWeather'),
  ])
  return {
    pixi,
    motion,
    weather,
    fetchManifest: async (url, signal) => {
      const response = await fetch(url, { signal })
      if (!response.ok) throw Error('장면 파일을 불러오지 못했어요.')
      return response.json()
    },
  }
}
/** One owner for async GPU setup, texture leases and ticker lifetime. */
export class PixiSceneRuntime {
  private options: SceneRuntimeOptions
  private releaseGPU: (() => void) | null = null
  private app: Application | null = null
  private cameraRoot: Container | null = null
  private worldArt: Graphics[] = []
  private scene: Container | null = null
  private worldClip: Graphics | null = null
  private destroyed = false
  private initialized = false
  private tier: SceneTextureTier = 'base'
  private manifest: PixiSceneManifest | null = null
  private loadedIds = new Set<string>()
  private rebuildRequested = false
  private orphanNodes = new Set<Container>()
  private ready = false
  private started = false
  private abort = new AbortController()
  private leases: (() => void)[] = []
  private time = 0
  private paused = false
  private count: number
  private layers: { layer: PixiSceneLayer; node: Container }[] = []
  private animated: { node: Container; motion: PixiMotion }[] = []
  private animals: ReturnType<typeof createPixiAnimalLife> | null = null
  private interactions: ReturnType<typeof createPixiSceneInteractions> | null = null
  private reactionTimer: ReturnType<typeof setTimeout> | null = null
  private precipitation: ReturnType<RuntimeDependencies['weather']['createPixiWeather']> | null =
    null
  private dependencies: RuntimeDependencies | null = null
  private canvas: HTMLCanvasElement | null = null
  private contextLost = (event: Event) => {
    event.preventDefault()
    this.notify('error', '그래픽 연결이 끊겼어요. 다시 시도해 주세요.')
    this.destroy()
  }
  constructor(options: SceneRuntimeOptions) {
    this.options = options
    this.count = options.coffeeCount ?? 0
  }
  private notify(status: 'loading' | 'ready' | 'error', error?: string) {
    try {
      this.options.onStatus?.(status, error)
    } catch {}
  }
  async start(deps?: RuntimeDependencies) {
    if (this.started || this.destroyed) return
    this.started = true
    try {
      this.notify('loading')
      const d = deps ?? (await browserPixiDependencies())
      this.dependencies = d
      if (this.destroyed) return
      const manifest = validatePixiManifest(
        await d.fetchManifest(sceneManifestUrl(this.options.id), this.abort.signal),
        this.options.id,
      )
      if (this.destroyed) return
      this.manifest = manifest
      const bounds = this.options.host.getBoundingClientRect()
      const quality = sceneRenderQuality(
        bounds.width,
        bounds.height,
        globalThis.devicePixelRatio || 1,
        this.options.fullscreen,
        [bounds.width, bounds.height].every((v) => Number.isFinite(v) && v > 0)
          ? frameSceneWorld(bounds.width, bounds.height, this.options.id).scale
          : undefined,
      )
      this.tier = quality.tier

      this.options.onQuality?.(this.tier, quality.resolution)
      this.loadedIds = new Set(
        manifest.layers
          .filter((layer) => coffeeLayerVisible(layer, this.count))
          .map((layer) => layer.id),
      )
      const previousGPU = gpuQueue
      let release!: () => void
      gpuQueue = new Promise<void>((resolve) => {
        release = resolve
      })
      await previousGPU
      this.releaseGPU = release
      if (this.destroyed) {
        this.releaseGPU()
        this.releaseGPU = null
        return
      }
      const app = new d.pixi.Application()
      this.app = app
      await app.init({
        backgroundAlpha: 0,
        antialias: true,
        resolution: quality.resolution,
        autoDensity: true,
        autoStart: false,
        preference: 'webgl',
        powerPreference: 'low-power',
        width: 800,
        height: 820,
      })
      this.initialized = true
      if (this.destroyed) {
        try {
          app.destroy(true, { children: true, texture: false, textureSource: false })
        } finally {
          this.releaseGPU?.()
          this.releaseGPU = null
        }
        return
      }
      const scene = new d.pixi.Container()
      this.scene = scene
      const cameraRoot = new d.pixi.Container()
      this.cameraRoot = cameraRoot
      app.stage.addChild(cameraRoot)
      for (const layer of ['underlay', 'joinery'] as const) {
        const art = new d.pixi.Graphics()
        this.worldArt.push(art)
        cameraRoot.addChild(art)
        art.svg(sceneWorldSvg(this.options.id, layer))
        art.position.set(SCENE_WORLD_BOUNDS.x, SCENE_WORLD_BOUNDS.y)
        if (layer === 'underlay') cameraRoot.addChild(scene)
      }
      const worldClip = new d.pixi.Graphics()
      this.worldClip = worldClip
      scene.addChild(worldClip)
      worldClip.rect(0, 0, manifest.width, manifest.height).fill(0xffffff)
      scene.mask = worldClip
      const vectorNodes = new Map<number, Container>(),
        preparedLayers = [...manifest.layers]
      let nativeCount = 0,
        fallbackCount = 0,
        primitiveBudget = 1024
      for (let i = 0; i < manifest.layers.length; i++) {
        const layer = manifest.layers[i]!
        if (layer.kind === 'weather' || layer.kind === 'animal' || !this.loadedIds.has(layer.id))
          continue
        if (!isNativeVectorEligible(layer) || layer.vector!.primitiveCount > primitiveBudget) {
          if (layer.vector) fallbackCount++
          preparedLayers[i] = { ...layer, vector: undefined }
          continue
        }
        const holder = new d.pixi.Container(),
          releases: (() => void)[] = []
        try {
          for (const part of nativeVectorParts(layer)) {
            const lease = acquireGeometry(part.svg, d.pixi)
            releases.push(lease.release)
            const graphic = new d.pixi.Graphics(lease.context)
            graphic.setFromMatrix(new d.pixi.Matrix(...part.matrix))
            holder.addChild(graphic)
          }
          vectorNodes.set(i, holder)
          this.orphanNodes.add(holder)
          primitiveBudget -= layer.vector!.primitiveCount
          nativeCount++
          this.leases.push(...releases)
        } catch {
          holder.destroy({ children: true })
          for (const release of releases) release()
          preparedLayers[i] = { ...layer, vector: undefined }
          fallbackCount++
        }
      }
      const assetPlan = planSceneTextures(
        { ...manifest, layers: preparedLayers },
        this.tier,
        this.count,
      )
      const rasterCount =
        manifest.layers.filter((l) => !l.kind && this.loadedIds.has(l.id)).length - nativeCount
      this.options.onVectorStats?.({
        native: nativeCount,
        raster: rasterCount,
        fallback: fallbackCount,
      })
      this.canvas = app.canvas
      this.canvas.setAttribute('aria-hidden', 'true')
      this.canvas.setAttribute('data-animal-life-version', String(manifest.animalLifeVersion ?? 0))
      this.canvas.setAttribute(
        'data-native-animal-count',
        String(
          manifest.layers.filter((layer) => layer.kind === 'animal' && this.loadedIds.has(layer.id))
            .length,
        ),
      )
      this.canvas.setAttribute('data-native-vector-count', String(nativeCount))
      this.canvas.setAttribute('data-vector-fallback-count', String(fallbackCount))
      this.canvas.setAttribute(
        'data-estimated-texture-bytes',
        String(Math.ceil(assetPlan.estimatedBytes)),
      )
      this.canvas.addEventListener('webglcontextlost', this.contextLost)
      this.options.host.appendChild(this.canvas)
      if (manifest.animalLifeVersion === 1) {
        const plan = getAnimalHabitat(manifest.id)
        const slots = manifest.layers.filter(
          (layer) => layer.kind === 'animal' && this.loadedIds.has(layer.id),
        )
        const ids = slots.map((layer) => layer.animalId!)
        if (new Set(ids).size !== ids.length) throw Error('Duplicate active animal slots')
        if (ids.some((id) => !plan.actors.some((actor) => actor.id === id)))
          throw Error('Unknown living animal')
        this.animals = createPixiAnimalLife({
          plan: { ...plan, actors: plan.actors.filter((actor) => ids.includes(actor.id)) },
          pixi: d.pixi,
          seed: [...manifest.id].reduce((n, c) => n + c.charCodeAt(0), 0),
        })
      }
      const sprites = new Map<number, Container>()
      let index = 0
      const worker = async () => {
        while (index < manifest.layers.length) {
          const i = index++,
            layer = manifest.layers[i]!
          if (this.destroyed) return
          if (!this.loadedIds.has(layer.id)) continue
          if (layer.kind === 'weather') {
            continue
          }
          let root: Container
          if (layer.kind === 'animal') {
            const actor = this.animals?.getNode(layer.animalId!)
            if (!actor) throw Error('Missing living animal renderer')
            root = actor
          } else if (vectorNodes.has(i)) {
            root = vectorNodes.get(i)!
          } else {
            const lease = await acquire(assetPlan.layers[layer.id]!.src, d.pixi)
            if (this.destroyed) {
              lease.release()
              return
            }
            this.leases.push(lease.release)
            const sprite = new d.pixi.Sprite(lease.texture)
            sprite.position.set(layer.x!, layer.y!)
            sprite.width = layer.width!
            sprite.height = layer.height!
            root = sprite
          }
          for (const m of [...(layer.motions ?? (layer.motion ? [layer.motion] : []))].reverse()) {
            const c = new d.pixi.Container()
            c.addChild(root)
            c.pivot.set(m.pivotX ?? 0, m.pivotY ?? 0)
            c.position.set(m.pivotX ?? 0, m.pivotY ?? 0)
            this.animated.push({ node: c, motion: m })
            root = c
          }
          if (layer.clipMask) {
            let maskLease: Awaited<ReturnType<typeof acquire>>
            try {
              maskLease = await acquire(assetPlan.layers[layer.id]!.clipMask!, d.pixi)
            } catch (error) {
              root.destroy({ children: true })
              throw error
            }
            if (this.destroyed) {
              maskLease.release()
              root.destroy({ children: true })
              return
            }
            this.leases.push(maskLease.release)
            const wrapper = new d.pixi.Container()
            const mask = new d.pixi.Sprite(maskLease.texture)
            mask.width = 800
            mask.height = 820
            wrapper.addChild(root, mask)
            wrapper.mask = mask
            root = wrapper
          }
          root.visible = coffeeLayerVisible(layer, this.count)
          if (vectorNodes.has(i)) this.orphanNodes.delete(vectorNodes.get(i)!)
          this.layers.push({ layer, node: root })
          sprites.set(i, root)
        }
      }
      await Promise.all(Array.from({ length: 8 }, worker))
      if (this.destroyed) return
      let weatherAdded = false
      const addWeather = async () => {
        if (weatherAdded) return
        weatherAdded = true
        const mask = await acquire(assetPlan.weatherMask, d.pixi)
        if (this.destroyed) {
          mask.release()
          return
        }
        this.leases.push(mask.release)
        this.precipitation = d.weather.createPixiWeather({
          weather: getSceneWeather(manifest.id),
          maskTexture: mask.texture,
          width: 800,
          height: 820,
          seed: [...manifest.id].reduce((n, c) => n + c.charCodeAt(0), 0),
        })
        scene.addChild(this.precipitation.container)
      }
      for (let i = 0; i < manifest.layers.length; i++) {
        if (manifest.layers[i]!.kind === 'weather') await addWeather()
        else if (sprites.has(i)) scene.addChild(sprites.get(i)!)
      }
      if (!weatherAdded) await addWeather()
      if (this.destroyed) return
      this.interactions = createPixiSceneInteractions(
        getSceneInteractiveObjects(this.options.id),
        d.pixi,
      )
      scene.addChild(this.interactions.container)
      app.ticker.maxFPS = 30
      app.ticker.add((ticker) => {
        if (this.paused || this.destroyed || this.options.reducedMotion) return
        const delta =
          Number.isFinite(ticker.deltaMS) && ticker.deltaMS > 0
            ? Math.min(ticker.deltaMS, 100) / 1000
            : 0
        this.time += delta
        this.animate(delta)
        this.interactions?.advance(delta * 1000)
      })
      this.animate()
      this.ready = true
      this.resize()
      if (this.rebuildRequested) return
      app.render()
      if (!this.paused && !this.options.reducedMotion) app.start()
      this.notify('ready')
    } catch (error) {
      if (!this.initialized) {
        try {
          this.app?.destroy(true, { children: true, texture: false, textureSource: false })
        } catch {}
        this.releaseGPU?.()
        this.releaseGPU = null
      }
      if (!this.destroyed) {
        this.notify(
          'error',
          error instanceof Error ? error.message : '장면 그래픽을 시작하지 못했어요.',
        )
        this.destroy()
      }
    }
  }
  private animate(delta = 0) {
    if (!this.dependencies) return
    for (const { node, motion } of this.animated) {
      const v = this.dependencies.motion.evaluateMotion(motion, this.time)
      node.position.set((motion.pivotX ?? 0) + (v.x ?? 0), (motion.pivotY ?? 0) + (v.y ?? 0))
      node.rotation = v.rotation ?? 0
      const transform = cssSkewToPixi(v)
      node.scale.set(transform.scaleX, transform.scaleY)
      node.skew.set(transform.skewX, transform.skewY)
      node.alpha = v.alpha ?? 1
    }
    this.precipitation?.update(this.time, 1 / 30)
    this.animals?.update(delta)
  }
  resize() {
    if (!this.app || !this.scene || !this.cameraRoot || !this.initialized) return
    const { width, height } = this.options.host.getBoundingClientRect()
    if (![width, height].every((value) => Number.isFinite(value) && value > 0)) return
    const frame = frameSceneWorld(width, height, this.options.id)
    const quality = sceneRenderQuality(
      width,
      height,
      globalThis.devicePixelRatio || 1,
      this.options.fullscreen,
      frame.scale,
    )
    if (this.ready && quality.tier !== this.tier) {
      this.requestRebuild()
      return
    }
    this.options.onQuality?.(this.tier, quality.resolution)
    this.app.renderer.resize(width, height, quality.resolution)
    this.cameraRoot.scale.set(frame.scale)
    this.cameraRoot.position.set(frame.x, frame.y)
    try {
      this.options.onFraming?.(frame)
    } catch {}
    this.app.render()
  }
  setPaused(value: boolean) {
    this.paused = value
    if (value) {
      this.stopReactionTimer()
      this.interactions?.clear()
      if (this.initialized && !this.destroyed) this.app?.render()
    }
    if (!this.app || !this.ready) return
    if (value || this.options.reducedMotion) this.app.stop()
    else this.app.start()
  }
  activateSceneObject(id: string): boolean {
    if (!this.ready || this.paused || this.destroyed || this.rebuildRequested) return false
    if (!this.interactions?.activate(id, this.options.reducedMotion)) return false
    this.app?.render()
    if (this.options.reducedMotion && this.reactionTimer === null) this.scheduleReactionFrame()
    return true
  }
  private stopReactionTimer() {
    if (this.reactionTimer !== null) clearTimeout(this.reactionTimer)
    this.reactionTimer = null
  }
  private scheduleReactionFrame() {
    this.reactionTimer = setTimeout(() => {
      this.reactionTimer = null
      if (this.destroyed || this.paused || !this.ready) return
      this.interactions?.advance(1000 / 30)
      this.app?.render()
      if (this.interactions?.activeCount) this.scheduleReactionFrame()
    }, 1000 / 30)
  }
  private requestRebuild() {
    if (this.rebuildRequested || this.destroyed) return
    this.rebuildRequested = true
    this.stopReactionTimer()
    this.interactions?.clear()
    this.options.onRebuild?.()
  }
  setCoffeeCount(value: number) {
    this.count = value
    if (
      this.manifest &&
      this.manifest.layers.some(
        (layer) => coffeeLayerVisible(layer, value) !== this.loadedIds.has(layer.id),
      )
    ) {
      this.requestRebuild()
      return
    }
    for (const { layer, node } of this.layers) node.visible = coffeeLayerVisible(layer, value)
    if (this.initialized && !this.destroyed) this.app?.render()
  }
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.abort.abort()
    this.stopReactionTimer()
    this.interactions?.destroy()
    this.interactions = null
    this.canvas?.removeEventListener('webglcontextlost', this.contextLost)
    this.animals?.destroy()
    this.animals = null
    for (const art of this.worldArt) {
      try {
        art.removeFromParent()
        art.destroy({ context: true })
      } catch {}
    }
    this.worldArt = []
    if (this.worldClip) {
      const clip = this.worldClip
      this.worldClip = null
      try {
        if (this.scene) this.scene.mask = null
        clip.removeFromParent()
        clip.destroy({ context: true })
      } catch {}
    }
    try {
      if (this.initialized) {
        for (const node of this.orphanNodes)
          try {
            node.destroy({ children: true })
          } catch {}
        this.orphanNodes.clear()
        for (const { node } of this.layers)
          if (!node.parent)
            try {
              node.destroy({ children: true })
            } catch {}
        try {
          this.app?.stop()
        } catch {}
        try {
          this.precipitation?.destroy()
        } catch {}
        try {
          this.app?.destroy(true, { children: true, texture: false, textureSource: false })
        } catch {}
      }
    } finally {
      if (this.initialized) {
        this.releaseGPU?.()
        this.releaseGPU = null
      }
      for (const release of this.leases)
        try {
          release()
        } catch {}
      this.leases = []
    }
    this.layers = []
    this.animated = []
    this.scene = null
    this.cameraRoot = null
  }
}
