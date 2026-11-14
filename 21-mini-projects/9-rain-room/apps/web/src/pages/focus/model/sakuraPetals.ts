/** Pure authored petal geometry and absolute-clock poses shared by Pixi and CPU QA. */
export const SAKURA_PETAL_COUNT = 36
export const SAKURA_PETAL_COLORS = ['#d9a8b4', '#e5bdc3', '#c993a5'] as const
export const SAKURA_PETAL_CURVES = [
  [-4, 3, -6, -1, -3.8, -4.7],
  [-2.4, -6.5, -0.8, -5.6, 0.2, -3.8],
  [1.2, -6, 3.3, -6.1, 4.4, -4.3],
  [6, -1.4, 3.1, 3.4, 0, 6],
] as const
export const SAKURA_PETAL_PATH =
  'M0 6' + SAKURA_PETAL_CURVES.map((curve) => 'C' + curve.join(' ')).join('') + 'Z'
export interface SakuraPetalParticle {
  x: number
  y: number
  depth: number
  phase: number
  driftPhase: number
  tumblePhase: number
  speed: number
  wind: number
  drift: number
  driftRate: number
  tumbleRate: number
  spinRate: number
  size: number
  color: (typeof SAKURA_PETAL_COLORS)[number]
}
export interface SakuraPetalPose {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  alpha: number
}
const tau = Math.PI * 2
const wrap = (value: number, span: number) => ((value % span) + span) % span
const angle = (time: number, rate: number) => wrap(time, tau / Math.abs(rate)) * rate
/** Separate seed stream leaves every existing rain drop and profile unchanged. */
export function createSakuraPetals(width = 800, height = 820, seed = 1): SakuraPetalParticle[] {
  let state = (seed ^ 0x53414b55) >>> 0
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
  return Array.from({ length: SAKURA_PETAL_COUNT }, () => {
    const depth = random()
    return {
      x: random() * (width + 180) - 90,
      y: random() * (height + 260) - 130,
      depth,
      phase: random() * tau,
      driftPhase: random() * tau,
      tumblePhase: random() * tau,
      speed: 14 + depth * 15 + random() * 5,
      wind: 3 + random() * 8,
      drift: 9 + random() * 18,
      driftRate: 0.28 + random() * 0.24,
      tumbleRate: 0.6 + random() * 0.85,
      spinRate: (random() > 0.5 ? 1 : -1) * (0.18 + random() * 0.42),
      size: 0.62 + depth * 0.64,
      color: SAKURA_PETAL_COLORS[Math.floor(random() * SAKURA_PETAL_COLORS.length)]!,
    }
  })
}
/** Periodic travel is reduced before multiplication, remaining finite even for very long clocks. */
export function sakuraPetalPose(
  p: SakuraPetalParticle,
  width: number,
  height: number,
  seconds: number,
): SakuraPetalPose {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const horizontal = wrap(time, (width + 180) / p.wind) * p.wind
  const vertical = wrap(time, (height + 260) / p.speed) * p.speed
  const drift = Math.sin(angle(time, p.driftRate) + p.driftPhase) * p.drift
  const tumble = angle(time, p.tumbleRate) + p.tumblePhase
  const face = Math.abs(Math.cos(tumble))
  return {
    x: wrap(p.x + horizontal + drift + 90, width + 180) - 90,
    y: wrap(p.y + vertical + 130, height + 260) - 130,
    rotation:
      wrap(p.phase + angle(time, p.spinRate) + 0.35 * Math.sin(tumble) + Math.PI, tau) - Math.PI,
    scaleX: p.size * (0.3 + 0.7 * face),
    scaleY: p.size * (0.9 + 0.1 * Math.sin(tumble)),
    alpha: (0.42 + p.depth * 0.32) * (0.76 + 0.24 * face),
  }
}
/** One petal only, with no root viewport/mask; caller places it in the actual weather slot. */
export function sakuraPetalMarkup(p: SakuraPetalParticle, pose: SakuraPetalPose): string {
  return `<g transform="translate(${pose.x} ${pose.y}) rotate(${(pose.rotation * 180) / Math.PI}) scale(${pose.scaleX} ${pose.scaleY})" opacity="${pose.alpha}"><path d="${SAKURA_PETAL_PATH}" fill="${p.color}"/><path d="M0 4.5 .2-2.5" fill="none" stroke="#b77791" stroke-width=".45" opacity=".28"/></g>`
}
