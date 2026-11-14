/** CSS-authored scene motion evaluated on the shared, pausable Pixi clock. */
export interface MotionFrame {
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
export interface SceneMotion {
  kind: string
  duration: number
  delay?: number
  amplitude?: number
  cssName?: string
  easing?: string
  alternate?: boolean
  iterations?: number
  baseAlpha?: number
  keyframes?: MotionFrame[]
}
export type MotionValue = Omit<MotionFrame, 'offset'>
const rad = (degrees: number) => (degrees * Math.PI) / 180
const frame = (offset: number, value: MotionValue): MotionFrame => ({ offset, ...value })
const ends = (a: MotionValue, b: MotionValue) => [frame(0, a), frame(1, b)]
const pulse = (a: MotionValue, b: MotionValue) => [frame(0, a), frame(0.5, b), frame(1, a)]
/** Original authored channels, including distinct signature mechanical gestures. */
const authored: Record<string, MotionFrame[]> = {
  'signature-turn': ends({ rotation: 0 }, { rotation: Math.PI * 2 }),
  'signature-rock': ends({ rotation: rad(-6) }, { rotation: rad(6) }),
  'signature-dial': ends({ rotation: rad(-18) }, { rotation: rad(24) }),
  'signature-page': [
    frame(0, { skewY: 0, scaleX: 1 }),
    frame(0.65, { skewY: 0, scaleX: 1 }),
    frame(0.78, { skewY: rad(-12), scaleX: 0.16 }),
    frame(0.88, { skewY: rad(5), scaleX: 0.7 }),
    frame(1, { skewY: 0, scaleX: 1 }),
  ],
  'signature-travel': ends({ x: -24 }, { x: 30 }),
  'signature-current': ends({ x: -6, scaleX: 0.92 }, { x: 6, scaleX: 1.05 }),
  'signature-sweep': ends({ rotation: rad(-12) }, { rotation: rad(14) }),
  'signature-drift': ends({ x: -8, y: 3 }, { x: 12, y: -7 }),
  'signature-wing': ends({ scaleY: 0.7 }, { scaleY: 1 }),
  'signature-capsule': ends({ y: -22 }, { y: 22 }),
  'signature-breathe': ends({ scaleX: 1, scaleY: 1 }, { scaleX: 1.035, scaleY: 1.035 }),
  'signature-fall': [
    frame(0, { y: 0, alpha: 0 }),
    frame(0.2, { y: 0, alpha: 0 }),
    frame(0.35, { alpha: 1 }),
    frame(0.9, { y: 35, alpha: 0 }),
    frame(1, { y: 35, alpha: 0 }),
  ],
  'signature-stamp': [
    frame(0, { y: 0 }),
    frame(0.65, { y: 0 }),
    frame(0.75, { y: 18 }),
    frame(0.83, { y: 18 }),
    frame(1, { y: 0 }),
  ],
  'signature-keypress': [
    frame(0, { y: 0 }),
    frame(0.65, { y: 0 }),
    frame(0.76, { y: 2 }),
    frame(0.84, { y: 2 }),
    frame(1, { y: 0 }),
  ],
  'scene-firefly': ends({ alpha: 1 }, { alpha: 0.15 }),
  'scene-rain-fall': ends({ y: 0 }, { y: 180 }),
  'lamp-breathe': pulse({ alpha: 0.48 }, { alpha: 1 }),
  'coffee-rise': [
    frame(0, { y: 5, alpha: 0.12 }),
    frame(0.5, { alpha: 0.48 }),
    frame(1, { y: -14, alpha: 0.04 }),
  ],
  'gentle-lightning': [
    frame(0, { alpha: 0 }),
    frame(0.35, { alpha: 0.12 }),
    frame(1, { alpha: 0 }),
  ],
  'cat-yawn': [
    frame(0, { alpha: 0, scaleY: 0.1 }),
    frame(0.25, { alpha: 1, scaleY: 1 }),
    frame(0.7, { alpha: 1, scaleY: 1 }),
    frame(1, { alpha: 0, scaleY: 0.1 }),
  ],
  'premium-rain': ends({ y: 0 }, { y: 150 }),
  'premium-steam': pulse({ y: 0, alpha: 1 }, { y: -7, alpha: 0.14 }),
  'premium-light': ends({ alpha: 1 }, { alpha: 0.72 }),
  'premium-petals': ends({ x: 0, y: 0 }, { x: 12, y: 90 }),
  'premium-bubbles': pulse({ y: 0, alpha: 1 }, { y: -35, alpha: 0.25 }),
  'premium-motes': ends({ alpha: 1 }, { alpha: 0.65 }),
  'premium-swim': ends({ x: 0 }, { x: 22 }),
  'premium-neon': [
    frame(0, { alpha: 1 }),
    frame(0.7, { alpha: 1 }),
    frame(0.75, { alpha: 0.75 }),
    frame(0.78, { alpha: 0.95 }),
    frame(0.82, { alpha: 0.75 }),
    frame(0.86, { alpha: 0.95 }),
    frame(1, { alpha: 1 }),
  ],
  'premium-yawn': [
    frame(0, { alpha: 0, scaleY: 0 }),
    frame(0.9, { alpha: 0, scaleY: 0 }),
    frame(0.94, { alpha: 0.8, scaleY: 1 }),
    frame(0.97, { alpha: 0.8, scaleY: 1 }),
    frame(1, { alpha: 0, scaleY: 0 }),
  ],
  'detail-glass': [
    frame(0, { alpha: 0.15, y: -8 }),
    frame(0.3, { alpha: 0.8 }),
    frame(0.75, { alpha: 0.8 }),
    frame(0.9, { alpha: 0.15, y: 16 }),
    frame(1, { alpha: 0.15, y: -8 }),
  ],
  'detail-leaf': pulse(
    { alpha: 0.15, x: 0, y: 0, rotation: rad(-2) },
    { alpha: 0.8, x: 3, y: -2, rotation: rad(2) },
  ),
  'detail-ripple': pulse({ alpha: 0.04, scaleX: 0.7 }, { alpha: 0.65, scaleX: 1.5 }),
  'detail-fall': pulse({ alpha: 0.1, y: -6 }, { alpha: 0.6, y: 9 }),
  'detail-twinkle': [
    frame(0, { alpha: 0.12, x: 0, y: 0 }),
    frame(0.45, { alpha: 0.85, x: 3, y: -5 }),
    frame(0.7, { alpha: 0.3 }),
    frame(1, { alpha: 0.12, x: 0, y: 0 }),
  ],
  'detail-float': pulse({ alpha: 0.06, x: 0, y: 7 }, { alpha: 0.4, x: 4, y: -9 }),
  'detail-ember': [
    frame(0, { alpha: 0.08, y: 5 }),
    frame(0.45, { alpha: 0.75, y: -19 }),
    frame(1, { alpha: 0.08, y: 5 }),
  ],
  'detail-curtain': pulse({ alpha: 0.15, x: 0 }, { alpha: 0.35, x: 3 }),
  'detail-reflection': pulse({ alpha: 0.12 }, { alpha: 0.45 }),
  'neon-water': pulse({ alpha: 0.15, scaleY: 0.94 }, { alpha: 0.55, scaleY: 1.04 }),
  'neon-breathe': [
    frame(0, { alpha: 0.58 }),
    frame(0.23, { alpha: 0.85 }),
    frame(0.39, { alpha: 0.9 }),
    frame(0.51, { alpha: 0.4 }),
    frame(0.64, { alpha: 1 }),
    frame(0.76, { alpha: 0.72 }),
    frame(1, { alpha: 0.58 }),
  ],
  'neon-sparkle': [
    frame(0, { alpha: 0.08 }),
    frame(0.25, { alpha: 0.08 }),
    frame(0.5, { alpha: 0.65 }),
    frame(0.8, { alpha: 0.08 }),
    frame(1, { alpha: 0.08 }),
  ],
}
// CSS cubic-bezier timing: solve x before evaluating y (per keyframe segment).
function ease(t: number, easing = 'ease-in-out'): number {
  if (easing === 'linear') return t
  const presets: Record<string, number[]> = {
    ease: [0.25, 0.1, 0.25, 1],
    'ease-in': [0.42, 0, 1, 1],
    'ease-out': [0, 0, 0.58, 1],
    'ease-in-out': [0.42, 0, 0.58, 1],
  }
  const custom = easing
    .match(/^cubic-bezier\(([^)]+)\)$/)?.[1]
    .split(',')
    .map(Number)
  const [x1, y1, x2, y2] =
    custom?.length === 4 ? custom : (presets[easing] ?? presets['ease-in-out'])
  const bez = (u: number, a: number, b: number) =>
    3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u
  let lo = 0,
    hi = 1
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2
    if (bez(m, x1, x2) < t) lo = m
    else hi = m
  }
  return bez((lo + hi) / 2, y1, y2)
}
export function evaluateMotion(motion: SceneMotion, timeSeconds: number, _seed = 0): MotionValue {
  const duration = Math.max(0.001, motion.duration)
  const elapsed =
    Math.max(0, (Number.isFinite(timeSeconds) ? timeSeconds : 0) - (motion.delay ?? 0)) / duration
  const finished = motion.iterations !== undefined && elapsed >= motion.iterations
  const cycle = finished ? Math.max(0, Math.ceil(motion.iterations!) - 1) : Math.floor(elapsed)
  let progress = finished ? 1 : elapsed % 1
  if (motion.alternate && cycle % 2 === 1) progress = 1 - progress
  const name = motion.cssName ?? motion.kind
  let frames = motion.keyframes ?? authored[name]
  if (!frames && name === 'detail-pass')
    frames = [
      frame(0, { alpha: 0, x: 0 }),
      frame(0.1, { alpha: 0, x: 0 }),
      frame(0.2, { alpha: 0.5 }),
      frame(0.75, { alpha: 0.5 }),
      frame(0.9, { alpha: 0, x: motion.amplitude ?? 120 }),
      frame(1, { alpha: 0, x: 0 }),
    ]
  if (!frames) return {}
  const result: MotionValue = {}
  const keys: (keyof MotionValue)[] = [
    'x',
    'y',
    'rotation',
    'scaleX',
    'scaleY',
    'skewX',
    'skewY',
    'alpha',
  ]
  for (const key of keys) {
    const points = frames
      .filter((f) => f[key] !== undefined)
      .slice()
      .sort((a, b) => a.offset - b.offset)
    if (!points.length) continue
    const initial = key === 'alpha' ? (motion.baseAlpha ?? 1) : key.startsWith('scale') ? 1 : 0
    if (points[0].offset > 0) points.unshift(frame(0, { [key]: initial }))
    if (points[points.length - 1].offset < 1) points.push(frame(1, { [key]: initial }))
    let left = points[0],
      right = points[points.length - 1]
    for (let i = 1; i < points.length; i++)
      if (progress <= points[i].offset) {
        left = points[i - 1]
        right = points[i]
        break
      }
    const t =
      right.offset === left.offset
        ? 0
        : Math.max(0, Math.min(1, (progress - left.offset) / (right.offset - left.offset)))
    result[key] = left[key]! + (right[key]! - left[key]!) * ease(t, motion.easing)
    if (key === 'alpha' && motion.baseAlpha !== undefined)
      result[key] = motion.baseAlpha > 0 ? result[key]! / motion.baseAlpha : 0
  }
  return result
}
