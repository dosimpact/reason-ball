import { Container, Graphics, GraphicsContext, Sprite, type Texture } from 'pixi.js'
import type { SceneWeather } from '../model/sceneWeather'
import {
  createSakuraPetals,
  sakuraPetalPose,
  SAKURA_PETAL_COLORS,
  SAKURA_PETAL_CURVES,
  SAKURA_PETAL_COUNT,
  type SakuraPetalParticle,
} from '../model/sakuraPetals.ts'
import {
  createThunderstormTimeline,
  thunderstormWeatherState,
  THUNDERSTORM_STYLE,
  THUNDERSTORM_BOLTS,
  THUNDERSTORM_CLOUDS,
  THUNDERSTORM_REFLECTION_BANDS,
  type ThunderstormPoint,
} from '../model/thunderstorm.ts'

/** Deliberately dense precipitation: each tier retains the original authored weight. */
export const PIXI_WEATHER_PROFILES = {
  rain: { rain: 330, snow: 0, speed: 180 / 1.05, length: 60, slant: -16, alpha: 0.55, width: 1.6 },
  'heavy-rain': {
    rain: 540,
    snow: 0,
    speed: 180 / 0.78,
    length: 80,
    slant: -20,
    alpha: 0.62,
    width: 1.8,
  },
  storm: { rain: 720, snow: 0, speed: 180 / 0.52, length: 100, slant: -23, alpha: 0.7, width: 2 },
  sleet: { rain: 250, snow: 220, speed: 90, length: 60, slant: -16, alpha: 0.46, width: 1.6 },
  snow: { rain: 0, snow: 410, speed: 0, length: 0, slant: 0, alpha: 1, width: 0 },
  'sakura-rain': {
    rain: 330,
    snow: 0,
    petals: SAKURA_PETAL_COUNT,
    speed: 180 / 1.05,
    length: 60,
    slant: -16,
    alpha: 0.55,
    width: 1.6,
  },
  thunderstorm: {
    rain: 720,
    snow: 0,
    speed: 180 / 0.52,
    length: 100,
    slant: -23,
    alpha: 0.7,
    width: 2,
  },
} as const
export interface WeatherParticle {
  kind: 'rain' | 'snow' | 'petal'
  petal?: SakuraPetalParticle
  x: number
  y: number
  depth: number
  phase: number
}
/** Seeded initial layout never changes when pausing, resizing or rerendering. */
export function createWeatherParticles(
  weather: SceneWeather,
  width: number,
  height: number,
  seed = 1,
): WeatherParticle[] {
  let state = seed >>> 0
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
  const profile = PIXI_WEATHER_PROFILES[weather]
  const precipitation: WeatherParticle[] = Array.from(
    { length: profile.rain + profile.snow },
    (_, index) => ({
      kind: index < profile.rain ? 'rain' : 'snow',
      x: random() * (width + 180) - 90,
      y: random() * (height + 260) - 130,
      depth: random(),
      phase: random() * Math.PI * 2,
    }),
  )
  return weather === 'sakura-rain'
    ? [
        ...precipitation,
        ...createSakuraPetals(width, height, seed).map(
          (petal): WeatherParticle => ({
            kind: 'petal',
            x: petal.x,
            y: petal.y,
            depth: petal.depth,
            phase: petal.phase,
            petal,
          }),
        ),
      ]
    : precipitation
}
const wrap = (value: number, span: number) => ((value % span) + span) % span
export function weatherParticlePosition(
  p: WeatherParticle,
  weather: SceneWeather,
  width: number,
  height: number,
  time: number,
) {
  const profile = PIXI_WEATHER_PROFILES[weather]
  if (p.kind === 'petal' && p.petal) {
    const { x, y } = sakuraPetalPose(p.petal, width, height, time)
    return { x, y }
  }
  if (p.kind === 'rain') {
    const distance = time * profile.speed * (p.depth > 0.72 && weather !== 'sleet' ? 0.74 : 1)
    return {
      x:
        wrap(p.x + (distance * profile.slant) / Math.max(1, profile.length) + 90, width + 180) - 90,
      y: wrap(p.y + distance + 130, height + 260) - 130,
    }
  }
  const near = p.depth > 0.5
  const speed = weather === 'sleet' ? (near ? 153 / 8 : 133 / 11) : near ? 153 / 9 : 133 / 13
  const drift =
    (near ? -18 : 12) * Math.sin(time * (near ? (Math.PI * 2) / 9 : (Math.PI * 2) / 13) + p.phase)
  return {
    x: wrap(p.x + drift + 90, width + 180) - 90,
    y: wrap(p.y + time * speed + 130, height + 260) - 130,
  }
}
/** Sparse storm events use the same absolute clock, so pause/reduced motion freeze them too. */
export function stormWeatherState(time: number, seed = 1) {
  const first = 42 + (Math.abs(seed) % 29)
  if (time < first) return { flash: 0, gust: 0, travelTime: time }
  const elapsed = time - first,
    cycle = Math.floor(elapsed / 90),
    phase = elapsed % 90
  const gust = phase < 4 ? Math.sin((Math.PI * phase) / 4) ** 2 : 0
  // Integral of sin² supplies continuous forward travel through gust onset/offset.
  const integrated = phase < 4 ? phase / 2 - Math.sin((Math.PI * phase) / 2) / Math.PI : 2
  const flash =
    phase < 0.91
      ? 0.12 * Math.sin((Math.PI * phase) / (2 * 0.91)) ** 2
      : phase < 2.6
        ? 0.12 * Math.cos((Math.PI * (phase - 0.91)) / (2 * 1.69)) ** 2
        : 0
  return { flash, gust, travelTime: time + 0.3 * (cycle * 2 + integrated) }
}
/** Native Pixi primitives; aperture texture includes foreground exclusions from the compiler. */
export function createPixiWeather({
  weather,
  maskTexture,
  width = 800,
  height = 820,
  seed = 1,
}: {
  weather: SceneWeather
  maskTexture: Texture
  width?: number
  height?: number
  seed?: number
}) {
  const container = new Container({ label: `weather:${weather}` })
  const particles = createWeatherParticles(weather, width, height, seed)
  const profile = PIXI_WEATHER_PROFILES[weather]
  const drawing = new Container({ label: 'precipitation' })
  const petalContexts =
    weather === 'sakura-rain'
      ? SAKURA_PETAL_COLORS.map((color) => {
          const context = new GraphicsContext().moveTo(0, 6)
          for (const curve of SAKURA_PETAL_CURVES)
            context.bezierCurveTo(curve[0], curve[1], curve[2], curve[3], curve[4], curve[5])
          context.closePath().fill(color)
          context
            .moveTo(0, 4.5)
            .lineTo(0.2, -2.5)
            .stroke({ color: '#b77791', width: 0.45, alpha: 0.28 })
          return context
        })
      : []
  const sprites = particles.map((p) => {
    const context = p.petal ? petalContexts[SAKURA_PETAL_COLORS.indexOf(p.petal.color)] : undefined
    const g = new Graphics(context)
    if (p.kind === 'rain') {
      const depth =
        p.depth > 0.72 &&
        (weather === 'heavy-rain' || weather === 'storm' || weather === 'thunderstorm')
      g.moveTo(0, 0)
        .lineTo(profile.slant, profile.length)
        .stroke({
          color: 0xc2d8d4,
          width: profile.width,
          alpha: depth
            ? weather === 'storm' || weather === 'thunderstorm'
              ? 0.3
              : 0.18
            : profile.alpha,
        })
    } else if (p.kind === 'snow') {
      const near = p.depth > 0.5
      const radius = near ? 2.2 + p.depth : 1.3 + p.depth * 0.8
      g.circle(0, 0, radius).fill({
        color: near ? 0xdce5dc : 0xc4d5d0,
        alpha: (near ? 0.85 : 0.55) * (weather === 'sleet' ? 0.65 : 1),
      })
      if (near && p.phase > 5.8)
        g.moveTo(-5, 0)
          .lineTo(5, 0)
          .moveTo(0, -5)
          .lineTo(0, 5)
          .stroke({ color: 0xe1e8de, width: 1.1, alpha: 0.85 })
    }
    drawing.addChild(g)
    return g
  })
  const lightning =
    weather === 'storm' ? new Graphics().rect(0, 0, width, height).fill(0xe4ebe5) : null
  if (lightning) {
    lightning.alpha = 0
    drawing.addChild(lightning)
  }
  // Four prebuilt branching bolts and their sea reflections: no frame reparsing/drawing.
  const thunderstorm =
    weather === 'thunderstorm'
      ? (() => {
          const style = THUNDERSTORM_STYLE
          const sky = new Graphics({ label: 'thunderstorm:sky' })
            .rect(0, 0, width, height)
            .fill(style.skyColor)
          const clouds = new Graphics({ label: 'thunderstorm:clouds' })
          for (const cloud of THUNDERSTORM_CLOUDS)
            clouds
              .ellipse(cloud.x, cloud.y, cloud.rx, cloud.ry)
              .fill({ color: style.cloudColor, alpha: cloud.alpha })
          const trace = (graphic: Graphics, points: readonly ThunderstormPoint[]) => {
            graphic.moveTo(points[0]![0], points[0]![1])
            for (const point of points.slice(1)) graphic.lineTo(point[0], point[1])
            return graphic
          }
          const bolts = THUNDERSTORM_BOLTS.map((bolt, index) => {
            const graphic = new Graphics({ label: `thunderstorm:bolt:${index}` })
            trace(graphic, bolt.spine).stroke({
              color: style.haloColor,
              width: style.haloWidth,
              alpha: style.haloAlpha,
              cap: 'round',
              join: 'round',
            })
            trace(graphic, bolt.spine).stroke({
              color: style.boltColor,
              width: style.boltWidth,
              cap: 'round',
              join: 'round',
            })
            for (const branch of bolt.branches)
              trace(graphic, branch).stroke({
                color: style.branchColor,
                width: style.branchWidth,
                alpha: style.branchAlpha,
                cap: 'round',
                join: 'round',
              })
            return graphic
          })
          const reflections = THUNDERSTORM_BOLTS.map((bolt, index) => {
            const graphic = new Graphics({ label: `thunderstorm:reflection:${index}` })
            for (const band of THUNDERSTORM_REFLECTION_BANDS)
              graphic
                .ellipse(bolt.reflectionX, band.y, band.rx, band.ry)
                .fill({ color: style.reflectionColor, alpha: band.alpha })
            return graphic
          })
          drawing.addChild(sky, clouds, ...bolts, ...reflections)
          return { timeline: createThunderstormTimeline(seed), sky, clouds, bolts, reflections }
        })()
      : null
  const mask = new Sprite(maskTexture)
  mask.width = width
  mask.height = height
  container.addChild(drawing, mask)
  drawing.mask = mask
  let destroyed = false
  const update = (timeSeconds: number, _deltaSeconds = 0) => {
    if (destroyed) return
    const time = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0
    const storm = weather === 'storm' ? stormWeatherState(time, seed) : null
    const thunder = thunderstorm
      ? thunderstormWeatherState(time, seed, thunderstorm.timeline)
      : null
    particles.forEach((p, index) => {
      if (p.kind === 'petal' && p.petal) {
        const pose = sakuraPetalPose(p.petal, width, height, time)
        sprites[index].position.set(pose.x, pose.y)
        sprites[index].rotation = pose.rotation
        sprites[index].scale.set(pose.scaleX, pose.scaleY)
        sprites[index].alpha = pose.alpha
        return
      }
      const pos = weatherParticlePosition(
        p,
        weather,
        width,
        height,
        thunder?.travelTime ?? storm?.travelTime ?? time,
      )
      sprites[index].position.set(pos.x, pos.y)
      sprites[index].alpha = 1 + (thunder?.gust ?? storm?.gust ?? 0) * 0.11
    })
    if (lightning) lightning.alpha = storm?.flash ?? 0
    if (thunderstorm && thunder) {
      thunderstorm.sky.alpha = thunder.skyAlpha
      thunderstorm.clouds.alpha = thunder.cloudAlpha
      thunderstorm.bolts.forEach((node, index) => {
        node.alpha = index === thunder.variant ? thunder.boltAlpha : 0
      })
      thunderstorm.reflections.forEach((node, index) => {
        node.alpha = index === thunder.variant ? thunder.reflectionAlpha : 0
      })
    }
  }
  update(0)
  return {
    container,
    update,
    destroy() {
      if (destroyed) return
      destroyed = true
      drawing.mask = null
      // Container forwards its child options, so Graphics does not implicitly
      // destroy an owned context when {children:true} is supplied. Release each
      // context once, including the three contexts shared by the petals.
      const contexts = new Set((drawing.children as Graphics[]).map((node) => node.context))
      container.destroy({ children: true })
      for (const context of contexts) if (!context.destroyed) context.destroy()
    },
  }
}
