/** Lighthouse-only lightning: deterministic sparse pulses inside a frequent, bounded cycle.
 * Pure geometry/clock data; no Pixi, timers, sound, DOM or mutable global state. */
export const THUNDERSTORM_CYCLE_SECONDS = 27
export const THUNDERSTORM_STYLE = {
  boltColor: '#d5e5ed',
  boltWidth: 1.9,
  haloColor: '#94bdd4',
  haloWidth: 7,
  haloAlpha: 0.17,
  branchColor: '#bcd6e5',
  branchWidth: 1.05,
  branchAlpha: 0.72,
  skyColor: '#87aac4',
  cloudColor: '#b8cbd9',
  reflectionColor: '#a9c9db',
} as const
export const THUNDERSTORM_CLOUDS = [
  { x: 285, y: 154, rx: 180, ry: 72, alpha: 0.65 },
  { x: 480, y: 110, rx: 150, ry: 65, alpha: 0.4 },
  { x: 445, y: 270, rx: 210, ry: 48, alpha: 0.25 },
].flatMap((patch) =>
  // Eight faint concentric paints keep the center close to its original
  // brightness while the largest silhouette starts at roughly 1–2% opacity.
  Array.from({ length: 8 }, (_, layer) => ({
    x: patch.x,
    y: patch.y,
    rx: patch.rx * (1 - layer * 0.1),
    ry: patch.ry * (1 - layer * 0.1),
    alpha: patch.alpha / 8,
  })),
)
export const THUNDERSTORM_BOLTS = [
  {
    spine: [
      [275, 92],
      [261, 141],
      [289, 149],
      [252, 203],
      [276, 196],
      [238, 260],
      [259, 246],
      [226, 310],
    ],
    branches: [
      [
        [252, 203],
        [218, 211],
        [229, 241],
        [196, 268],
      ],
      [
        [261, 141],
        [235, 163],
        [246, 180],
      ],
    ],
    reflectionX: 226,
  },
  {
    spine: [
      [410, 76],
      [389, 127],
      [415, 141],
      [377, 190],
      [402, 184],
      [366, 248],
      [378, 241],
      [340, 300],
    ],
    branches: [
      [
        [377, 190],
        [427, 207],
        [415, 236],
        [450, 270],
      ],
      [
        [389, 127],
        [363, 151],
        [376, 169],
      ],
    ],
    reflectionX: 340,
  },
  {
    spine: [
      [505, 95],
      [481, 139],
      [508, 154],
      [474, 201],
      [494, 193],
      [456, 250],
      [476, 239],
      [441, 303],
    ],
    branches: [
      [
        [474, 201],
        [529, 213],
        [515, 242],
        [546, 271],
      ],
      [
        [481, 139],
        [451, 157],
        [465, 181],
      ],
    ],
    reflectionX: 441,
  },
  {
    spine: [
      [330, 88],
      [354, 126],
      [328, 149],
      [352, 182],
      [324, 198],
      [341, 235],
      [307, 280],
      [327, 271],
      [299, 324],
    ],
    branches: [
      [
        [352, 182],
        [386, 208],
        [368, 235],
        [399, 265],
      ],
      [
        [328, 149],
        [294, 170],
        [307, 195],
      ],
    ],
    reflectionX: 299,
  },
] as const
export type ThunderstormPoint = readonly [number, number]
export type ThunderstormPulse = { offset: number; attack: number; decay: number; strength: number }
export type ThunderstormEvent = {
  start: number
  variant: number
  pulses: readonly ThunderstormPulse[]
  duration: number
}
export type ThunderstormTimeline = { cycleSeconds: number; events: readonly ThunderstormEvent[] }
export type ThunderstormEnvelope = {
  boltAlpha: number
  skyAlpha: number
  cloudAlpha: number
  reflectionAlpha: number
  gust: number
}
export function createThunderstormTimeline(seed = 1): ThunderstormTimeline {
  let randomState = seed >>> 0
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
    return randomState / 4294967296
  }
  return {
    cycleSeconds: THUNDERSTORM_CYCLE_SECONDS,
    events: [1.55, 7.75, 14.05, 20.85].map((start, index) => {
      const variant = (index + ((seed >>> 0) % 4)) % 4
      return {
        start: start + (random() - 0.5) * 0.3,
        variant,
        duration: 3,
        pulses: [
          { offset: 0, attack: 0.085, decay: 0.5, strength: 1 },
          ...(variant % 2 === 0 ? [{ offset: 0.7, attack: 0.1, decay: 0.55, strength: 0.72 }] : []),
        ],
      }
    }),
  }
}
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => {
  const t = clamp(value)
  return t * t * (3 - 2 * t)
}
function pulseAlpha(pulse: ThunderstormPulse, elapsed: number) {
  const t = elapsed - pulse.offset
  if (t < 0 || t >= pulse.attack + pulse.decay) return 0
  return (
    pulse.strength *
    (t < pulse.attack
      ? smooth(t / pulse.attack)
      : (1 + Math.cos((Math.PI * (t - pulse.attack)) / pulse.decay)) / 2)
  )
}
/** Per-event envelope can also generate CSS keyframe samples without React frame updates. */
export function thunderstormEventEnvelope(
  event: ThunderstormEvent,
  elapsed: number,
): ThunderstormEnvelope {
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= event.duration)
    return { boltAlpha: 0, skyAlpha: 0, cloudAlpha: 0, reflectionAlpha: 0, gust: 0 }
  const pulse = Math.max(...event.pulses.map((p) => pulseAlpha(p, elapsed)))
  const afterglow =
    elapsed >= 0.07 && elapsed < 1.9
      ? (smooth((elapsed - 0.07) / 0.12) * (1 + Math.cos((Math.PI * (elapsed - 0.07)) / 1.83))) / 2
      : 0
  return {
    boltAlpha: clamp(0.92 * pulse + 0.06 * afterglow),
    skyAlpha: 0.13 * pulse + 0.035 * afterglow,
    cloudAlpha: 0.24 * pulse + 0.045 * afterglow,
    reflectionAlpha: 0.22 * pulse + 0.06 * afterglow,
    gust: Math.sin((Math.PI * elapsed) / 3) ** 2,
  }
}
function integratedGust(elapsed: number) {
  if (elapsed <= 0) return 0
  if (elapsed >= 3) return 1.5
  return elapsed / 2 - (3 * Math.sin((2 * Math.PI * elapsed) / 3)) / (4 * Math.PI)
}
/** Absolute clock: identical time/seed means identical flashes, gust and rain positions. */
export function thunderstormWeatherState(
  seconds: number,
  seed = 1,
  timeline = createThunderstormTimeline(seed),
) {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const cycle = Math.floor(time / timeline.cycleSeconds),
    phase = time % timeline.cycleSeconds
  const active = timeline.events.find(
    (event) => phase >= event.start && phase < event.start + event.duration,
  )
  const envelope = active
    ? thunderstormEventEnvelope(active, phase - active.start)
    : { boltAlpha: 0, skyAlpha: 0, cloudAlpha: 0, reflectionAlpha: 0, gust: 0 }
  const integrated =
    cycle * timeline.events.length * 1.5 +
    timeline.events.reduce((sum, event) => sum + integratedGust(phase - event.start), 0)
  return {
    variant: active?.variant ?? -1,
    ...envelope,
    travelTime: Math.min(Number.MAX_VALUE, time + 0.3 * integrated),
  }
}
export function thunderstormPath(points: readonly ThunderstormPoint[]): string {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join('')
}
/** SVG fragments share the exact native polyline geometry/style; caller owns the aperture. */
export function thunderstormBoltMarkup(variant: number, alpha = 1): string {
  const bolt = THUNDERSTORM_BOLTS[variant]
  if (!bolt) return ''
  const d = thunderstormPath(bolt.spine),
    s = THUNDERSTORM_STYLE
  return `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${d}" stroke="${s.haloColor}" stroke-width="${s.haloWidth}" opacity="${s.haloAlpha * alpha}"/><path d="${d}" stroke="${s.boltColor}" stroke-width="${s.boltWidth}" opacity="${alpha}"/>${bolt.branches.map((branch) => `<path d="${thunderstormPath(branch)}" stroke="${s.branchColor}" stroke-width="${s.branchWidth}" opacity="${s.branchAlpha * alpha}"/>`).join('')}</g>`
}
export const THUNDERSTORM_REFLECTION_BANDS = [
  { y: 345, rx: 16, ry: 2.4, alpha: 0.4 },
  { y: 367, rx: 29, ry: 2.8, alpha: 0.28 },
  { y: 395, rx: 45, ry: 3.4, alpha: 0.18 },
  { y: 428, rx: 64, ry: 4, alpha: 0.1 },
] as const
export function thunderstormReflectionMarkup(variant: number, alpha = 1): string {
  const bolt = THUNDERSTORM_BOLTS[variant]
  return bolt
    ? `<g fill="${THUNDERSTORM_STYLE.reflectionColor}">${THUNDERSTORM_REFLECTION_BANDS.map((b) => `<ellipse cx="${bolt.reflectionX}" cy="${b.y}" rx="${b.rx}" ry="${b.ry}" opacity="${b.alpha * alpha}"/>`).join('')}</g>`
    : ''
}
export function thunderstormSkyMarkup(
  skyAlpha: number,
  cloudAlpha: number,
  width = 800,
  height = 820,
): string {
  return `<rect width="${width}" height="${height}" fill="${THUNDERSTORM_STYLE.skyColor}" opacity="${skyAlpha}"/><g fill="${THUNDERSTORM_STYLE.cloudColor}">${THUNDERSTORM_CLOUDS.map((c) => `<ellipse cx="${c.x}" cy="${c.y}" rx="${c.rx}" ry="${c.ry}" opacity="${c.alpha * cloudAlpha}"/>`).join('')}</g>`
}
