export interface PixiMotionFrame {
  offset: number
  x?: number
  y?: number
  rotation?: number
  scaleX?: number
  scaleY?: number
  skewX?: number
  skewY?: number
  alpha?: number
}
export interface PixiMotion {
  kind: string
  duration: number
  delay?: number
  amplitude?: number
  pivotX?: number
  pivotY?: number
  cssName?: string
  className?: string
  keyframes?: PixiMotionFrame[]
  easing?: string
  alternate?: boolean
  iterations?: number
  baseAlpha?: number
}
export interface PixiSceneLayer {
  id: string
  vector?: PixiVector
  src?: string
  srcHigh?: string
  resolutionHigh?: number
  clipMask?: string
  clipMaskHigh?: string
  x?: number
  y?: number
  width?: number
  height?: number
  kind?: 'weather' | 'animal'
  animalId?: string
  motion?: PixiMotion
  motions?: PixiMotion[]
  ifCoffeeMin?: number
  ifCoffeeMax?: number
  sourceMotionId?: string
  sourceClass?: string
  sourceClasses?: string[]
  sourceTag?: string
  sourceRole?: 'character' | 'structural' | 'soft-effect'
}
export interface PixiSceneManifest {
  version: 1
  id: string
  width: 800
  height: 820
  animalLifeVersion?: 1
  layers: PixiSceneLayer[]
  weatherMask: string
  weatherMaskHigh?: string
}
function validSceneAsset(value: unknown) {
  return (
    typeof value === 'string' &&
    value.startsWith('/backgrounds/') &&
    value.endsWith('.png') &&
    !value.includes('..') &&
    !/[?#]/.test(value)
  )
}
function finiteOptional(value: unknown) {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value))
}
export function validatePixiManifest(input: unknown, id: string): PixiSceneManifest {
  const m = input as PixiSceneManifest
  if (
    !m ||
    m.version !== 1 ||
    m.id !== id ||
    m.width !== 800 ||
    m.height !== 820 ||
    !Array.isArray(m.layers) ||
    m.layers.length > 256 ||
    !validSceneAsset(m.weatherMask)
  )
    throw Error('장면 구성 파일을 읽을 수 없어요.')
  if (m.weatherMaskHigh !== undefined && !validSceneAsset(m.weatherMaskHigh))
    throw Error('올바르지 않은 고해상도 마스크예요.')
  const ids = new Set<string>()
  for (const l of m.layers) {
    if (!l || typeof l.id !== 'string' || ids.has(l.id)) throw Error('중복된 장면 요소예요.')
    ids.add(l.id)
    if (l.kind === 'weather') continue
    if (l.kind === 'animal') {
      if (
        m.animalLifeVersion !== 1 ||
        typeof l.animalId !== 'string' ||
        !/^[a-z0-9:_-]{1,180}$/.test(l.animalId) ||
        l.src !== undefined ||
        l.srcHigh !== undefined ||
        l.vector ||
        l.motion ||
        l.motions ||
        ![l.ifCoffeeMin, l.ifCoffeeMax].every(
          (value) => value === undefined || (Number.isSafeInteger(value) && value >= 0),
        ) ||
        (l.ifCoffeeMax ?? Infinity) < (l.ifCoffeeMin ?? 0) ||
        (l.clipMask !== undefined && !validSceneAsset(l.clipMask)) ||
        (l.clipMaskHigh !== undefined && (!l.clipMask || !validSceneAsset(l.clipMaskHigh)))
      )
        throw Error('올바르지 않은 동물 슬롯이에요.')
      continue
    }
    if (l.kind) throw Error('알 수 없는 장면 요소예요.')
    if (
      !validSceneAsset(l.src) ||
      ![l.x, l.y, l.width, l.height].every((n) => typeof n === 'number' && Number.isFinite(n)) ||
      l.width! <= 0 ||
      l.height! <= 0
    )
      throw Error('올바르지 않은 장면 요소예요.')
    if (l.clipMask !== undefined && !validSceneAsset(l.clipMask))
      throw Error('올바르지 않은 장면 마스크예요.')
    if (
      (l.srcHigh !== undefined && !validSceneAsset(l.srcHigh)) ||
      (l.clipMaskHigh !== undefined && !validSceneAsset(l.clipMaskHigh))
    )
      throw Error('올바르지 않은 고해상도 장면 요소예요.')
    for (const motion of l.motions ?? (l.motion ? [l.motion] : [])) {
      if (
        !motion ||
        typeof motion.kind !== 'string' ||
        !Number.isFinite(motion.duration) ||
        motion.duration <= 0 ||
        ![
          motion.delay,
          motion.amplitude,
          motion.pivotX,
          motion.pivotY,
          motion.baseAlpha,
          motion.iterations,
        ].every(finiteOptional)
      )
        throw Error('올바르지 않은 장면 움직임이에요.')
      if (motion.keyframes) {
        if (!Array.isArray(motion.keyframes) || motion.keyframes.length > 100)
          throw Error('움직임 프레임이 너무 많아요.')
        for (const f of motion.keyframes)
          if (
            !f ||
            !Number.isFinite(f.offset) ||
            f.offset < 0 ||
            f.offset > 1 ||
            ![f.x, f.y, f.rotation, f.scaleX, f.scaleY, f.skewX, f.skewY, f.alpha].every(
              finiteOptional,
            )
          )
            throw Error('올바르지 않은 움직임 프레임이에요.')
      }
    }
  }
  return m
}
export function sceneManifestUrl(id: string) {
  return `/backgrounds/pixi/${encodeURIComponent(id)}/manifest.json`
}
export function coverScene(width: number, height: number) {
  const scale = Math.max(width / 800, height / 820)
  return { scale, x: (width - 800 * scale) / 2, y: (height - 820 * scale) / 2 }
}
export type SceneFraming = { scale: number; x: number; y: number; width: number; height: number }
export type SceneFrame = SceneFraming
/** Center the complete authored composition without stretching or cropping. */
export function fitScene(
  width: number,
  height: number,
  sourceWidth = 800,
  sourceHeight = 820,
): SceneFraming {
  if (
    ![width, height, sourceWidth, sourceHeight].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new RangeError('Scene and viewport dimensions must be finite and positive')
  const scale = Math.min(width / sourceWidth, height / sourceHeight)
  const fittedWidth = sourceWidth * scale,
    fittedHeight = sourceHeight * scale
  if (![scale, fittedWidth, fittedHeight].every((value) => Number.isFinite(value) && value > 0))
    throw new RangeError('Scene framing exceeds numeric bounds')
  return {
    scale,
    x: (width - fittedWidth) / 2,
    y: (height - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  }
}
export function coffeeLayerVisible(layer: PixiSceneLayer, count: number) {
  return count >= (layer.ifCoffeeMin ?? 0) && count <= (layer.ifCoffeeMax ?? Infinity)
}

/** Pixi uses sine/cosine skew axes; CSS uses tangent shears.
 * Keep the CSS matrix, including scale, while bounding singular ±90° inputs. */
export function cssSkewToPixi(
  value: Pick<PixiMotionFrame, 'skewX' | 'skewY' | 'scaleX' | 'scaleY'>,
) {
  const bound = (angle: number | undefined) =>
    Number.isFinite(angle)
      ? Math.max((-Math.PI * 85) / 180, Math.min((Math.PI * 85) / 180, angle!))
      : 0
  const skewX = bound(value.skewX),
    skewY = bound(value.skewY)
  const scale = (n: number | undefined) => (Number.isFinite(n) ? n! : 1)
  return {
    skewX,
    skewY,
    scaleX: scale(value.scaleX) / Math.cos(skewY),
    scaleY: scale(value.scaleY) / Math.cos(skewX),
  }
}

export type SceneTextureTier = 'base' | 'high'
/** Cap backing-store size, independently from logical scene coordinates. */
export function sceneRenderQuality(
  width: number,
  height: number,
  dpr: number,
  fullscreen = false,
  sourceScale?: number,
) {
  const w = Math.max(1, Number.isFinite(width) ? width : 1),
    h = Math.max(1, Number.isFinite(height) ? height : 1)
  const resolution = Math.max(
    Number.MIN_VALUE,
    Math.min(
      Number.isFinite(dpr) ? Math.max(1, dpr) : 1,
      2,
      4096 / Math.max(w, h),
      Math.sqrt(4_000_000 / (w * h)),
    ),
  )
  return {
    resolution,
    tier: (fullscreen || (sourceScale ?? fitScene(w, h).scale) * resolution > 1
      ? 'high'
      : 'base') as SceneTextureTier,
  }
}

/** Logical RGBA estimate, excluding driver overhead; keep sharp structural art first. */
export function sceneTexturePriority(layer: PixiSceneLayer) {
  if (layer.id === 'rear') return 100
  if (layer.sourceRole === 'character') return 98
  if (layer.sourceRole === 'soft-effect') return 20
  if (layer.sourceRole === 'structural') return layer.id.startsWith('art') ? 95 : 70
  const tags = [
    layer.id,
    layer.sourceClass,
    ...(layer.sourceClasses ?? []),
    ...(layer.motions ?? []).flatMap((m) => [m.className, m.cssName]),
  ].join(' ')
  if (layer.sourceRole === 'character' || /character|person|face|companion|hand/.test(tags))
    return 98
  if (
    layer.sourceRole === 'soft-effect' ||
    /glow|bloom|dust|mote|shadow|halo|light-breathe/.test(tags)
  )
    return 20
  if (layer.id.startsWith('art')) return 95
  return /glow|bloom|dust|mote|shadow|halo|light-breathe/.test(tags) ? 20 : 70
}
export function planSceneTextures(
  manifest: PixiSceneManifest,
  tier: SceneTextureTier,
  count: number,
  budget = 96 * 1024 * 1024,
) {
  const active = manifest.layers.filter((l) => l.kind !== 'weather' && coffeeLayerVisible(l, count))
  const sources = new Map<
    string,
    { high?: string; pixels: number; priority: number; ratio: number }
  >()
  const add = (
    src: string,
    high: string | undefined,
    pixels: number,
    priority: number,
    ratio = 3,
  ) => {
    const previous = sources.get(src)
    if (!previous || priority > previous.priority)
      sources.set(src, { high, pixels, priority, ratio })
  }
  for (const layer of active) {
    if (layer.kind === 'animal') {
      if (layer.clipMask) add(layer.clipMask, layer.clipMaskHigh, 800 * 820, 50)
      continue
    }
    if (isNativeVectorEligible(layer)) continue
    add(
      layer.src!,
      layer.srcHigh,
      layer.width! * layer.height!,
      sceneTexturePriority(layer),
      layer.resolutionHigh ?? 3,
    )
    if (layer.clipMask) add(layer.clipMask, layer.clipMaskHigh, 800 * 820, 50)
  }
  add(manifest.weatherMask, manifest.weatherMaskHigh, 800 * 820, 10)
  let estimatedBytes = [...sources.values()].reduce((n, s) => n + s.pixels * 4, 0)
  const selected = new Map<string, string>()
  if (tier === 'high')
    for (const [src, entry] of [...sources.entries()].sort(
      (a, b) => b[1].priority - a[1].priority || a[1].pixels - b[1].pixels,
    )) {
      const extra = entry.pixels * 4 * (entry.ratio * entry.ratio - 1)
      if (entry.high && estimatedBytes + extra <= budget) {
        selected.set(src, entry.high)
        estimatedBytes += extra
      }
    }
  return {
    layers: Object.fromEntries(
      active.map((l) => [
        l.id,
        {
          src: selected.get(l.src!) ?? l.src!,
          clipMask: l.clipMask ? (selected.get(l.clipMask) ?? l.clipMask) : undefined,
        },
      ]),
    ),
    weatherMask: selected.get(manifest.weatherMask) ?? manifest.weatherMask,
    estimatedBytes,
  }
}

export interface PixiVectorPart {
  svg: string
  matrix: [number, number, number, number, number, number]
  primitiveCount: number
}
export interface PixiVector {
  svg?: string
  parts?: PixiVectorPart[]
  primitiveCount: number
  sourceBounds: { x: number; y: number; width: number; height: number }
}
const simplePaint = (s: string | undefined) =>
  s === 'none' || (!!s && /^(?:#[a-f\d]{3}|#[a-f\d]{6}|black|white)$/i.test(s))
function strictFlatVector(svg: string) {
  if (typeof svg !== 'string' || svg.length > 180000 || /[&]/.test(svg)) return 0
  const root = svg.match(/^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i)
  if (!root) return 0
  const attributes = (text: string) => {
    const result: Record<string, string> = {}
    const remainder = text.replace(
      /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
      (_s, k: string, a: string, b: string) => {
        if (Object.hasOwn(result, k)) result.__duplicate = 'yes'
        result[k] = a ?? b
        return ''
      },
    )
    return remainder.trim() ? null : result
  }
  const ra = attributes(root[1]!)
  if (
    !ra ||
    Object.keys(ra).some((k) => !['xmlns', 'width', 'height', 'viewBox'].includes(k)) ||
    (ra.viewBox && ra.viewBox.trim() !== '0 0 800 820')
  )
    return 0
  let count = 0,
    commands = 0,
    ok = true
  const rest = root[2]!.replace(
    /<(path|rect|circle|ellipse|line)\b([^<>]*?)\s*\/>/gi,
    (_s, tag: string, text: string) => {
      const a = attributes(text)
      count++
      if (!a) {
        ok = false
        return ''
      }
      const allowed = [
        'd',
        'fill',
        'stroke',
        'stroke-width',
        'fill-opacity',
        'stroke-opacity',
        'fill-rule',
        'x',
        'y',
        'width',
        'height',
        'rx',
        'ry',
        'cx',
        'cy',
        'r',
        'x1',
        'y1',
        'x2',
        'y2',
      ]
      if (
        Object.keys(a).some((k) => !allowed.includes(k)) ||
        !simplePaint(a.fill ?? 'none') ||
        !simplePaint(a.stroke ?? 'none') ||
        ((!a.fill || a.fill === 'none') && (!a.stroke || a.stroke === 'none'))
      )
        ok = false
      for (const [k, v] of Object.entries(a))
        if (
          !['d', 'fill', 'stroke', 'fill-rule'].includes(k) &&
          (!/^[-+\d.eE]+$/.test(v) || !Number.isFinite(Number(v)))
        )
          ok = false
      for (const key of ['width', 'height', 'r', 'rx', 'ry', 'stroke-width'])
        if (a[key] !== undefined && Number(a[key]) < 0) ok = false
      for (const key of ['fill-opacity', 'stroke-opacity'])
        if (a[key] !== undefined && (Number(a[key]) < 0 || Number(a[key]) > 1)) ok = false
      if (tag.toLowerCase() !== 'line' && a.fill === undefined) ok = false
      if (a['fill-rule'] && a['fill-rule'] !== 'nonzero') ok = false
      if (tag.toLowerCase() === 'path') {
        const d = a.d ?? ''
        if (
          !/^[MmLlHhVvCcSsQqTtAaZz\d.eE,+\s-]+$/.test(d) ||
          (a.fill !== 'none' && (d.match(/[Mm]/g) || []).length !== 1)
        )
          ok = false
        if (
          (d.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || []).some(
            (n) => !Number.isFinite(Number(n)),
          )
        )
          ok = false
        const arity: Record<string, number> = {
          m: 2,
          l: 2,
          h: 1,
          v: 1,
          c: 6,
          s: 4,
          q: 4,
          t: 2,
          a: 7,
          z: 0,
        }
        for (const command of d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g)) {
          const values = command[2]!.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || []
          const size = arity[command[1]!.toLowerCase()]!
          if (size === 0 ? values.length > 0 : values.length < size || values.length % size !== 0)
            ok = false
        }
        commands += (d.match(/[MmLlHhVvCcSsQqTtAaZz]/g) || []).length
      }
      if (tag.toLowerCase() === 'rect' && a.rx && a.ry && Number(a.rx) !== Number(a.ry)) ok = false
      return ''
    },
  )
  return ok && !rest.trim() && count <= 64 && commands <= 4096 ? count : 0
}
export function nativeVectorParts(layer: PixiSceneLayer): PixiVectorPart[] {
  if (!layer.vector) return []
  return (
    layer.vector.parts ??
    (layer.vector.svg
      ? [
          {
            svg: layer.vector.svg,
            matrix: [1, 0, 0, 1, 0, 0],
            primitiveCount: layer.vector.primitiveCount,
          },
        ]
      : [])
  )
}
/** Never pass unrestricted SVG into Pixi's incomplete SVG parser. */
export function isNativeVectorEligible(layer: PixiSceneLayer) {
  const v = layer.vector
  if (
    !v ||
    layer.sourceRole === 'character' ||
    layer.clipMask ||
    layer.clipMaskHigh ||
    !Number.isInteger(v.primitiveCount) ||
    v.primitiveCount < 1 ||
    v.primitiveCount > 128
  )
    return false
  if (
    !v.sourceBounds ||
    !Object.values(v.sourceBounds).every(Number.isFinite) ||
    v.sourceBounds.width <= 0 ||
    v.sourceBounds.height <= 0
  )
    return false
  const parts = nativeVectorParts(layer)
  if (parts.length < 1 || parts.length > 64) return false
  let count = 0
  for (const p of parts) {
    if (!Array.isArray(p.matrix) || p.matrix.length !== 6 || !p.matrix.every(Number.isFinite))
      return false
    const actual = strictFlatVector(p.svg)
    if (!actual || actual !== p.primitiveCount) return false
    count += actual
  }
  return count === v.primitiveCount
}
