/** Shared physical timeline: UI and mechanical audio consume the same feed times. */
export const PRINT_DURATION_MS = 3400
export const PAPER_FEED_START_MS = 350
export const PAPER_FEED_END_MS = 2700
export const PAPER_FEED_CUE_TIMES_MS = [350, 850, 1350, 1850, 2350] as const
export const REDUCED_PRINT_DURATION_MS = 180
export const RECEIPT_PAPER_BANDS = 40
export const RECEIPT_PAPER_LENGTH = 288
export type PaperPhase = 'waiting' | 'feeding' | 'unrolling' | 'settling' | 'complete'
export type PaperBand = {
  index: number
  y: number
  z: number
  rotation: number
  height: number
  sourceHeight: number
  sourceY: number
  visible: boolean
  backVisible: boolean
  shade: number
}
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
const smooth = (n: number) => {
  const t = clamp(n)
  return t * t * (3 - 2 * t)
}
export function paperFeedFraction(progress: number): number {
  const time = clamp(progress) * PRINT_DURATION_MS
  if (time < PAPER_FEED_START_MS) return 0
  if (time >= PAPER_FEED_END_MS) return 1
  let pulse = 0
  while (pulse + 1 < PAPER_FEED_CUE_TIMES_MS.length && time >= PAPER_FEED_CUE_TIMES_MS[pulse + 1])
    pulse++
  const start = PAPER_FEED_CUE_TIMES_MS[pulse]
  const end = PAPER_FEED_CUE_TIMES_MS[pulse + 1] ?? PAPER_FEED_END_MS
  return (pulse + smooth((time - start) / ((end - start) * 0.8))) / PAPER_FEED_CUE_TIMES_MS.length
}
export function paperPhase(progress: number): PaperPhase {
  const time = clamp(progress) * PRINT_DURATION_MS
  return time < PAPER_FEED_START_MS
    ? 'waiting'
    : time < PAPER_FEED_END_MS
      ? 'feeding'
      : time < PRINT_DURATION_MS
        ? 'settling'
        : 'complete'
}
export type PaperLayout = { top?: number; bottom?: number; height?: number; bands?: number }
/** A finite sheet feeds into an expanding-radius spiral. Its straight trailing
 * section stays attached to the lower emission origin until the final feed
 * pulse releases it. Unwinding and delivery happen together, before the final
 * flat handoff; there is no subsequent lift, scaling, or replacement artwork. */
export function receiptPaperFrame(
  progress: number,
  {
    top = 0,
    bottom = 640,
    height = RECEIPT_PAPER_LENGTH,
    bands = RECEIPT_PAPER_BANDS,
  }: PaperLayout = {},
) {
  const feed = paperFeedFraction(progress)
  const visibleLength = height * feed
  const segment = visibleLength / bands
  const unwind = smooth((feed - 0.52) / 0.48)
  const curl = Math.PI * 2.6 * (1 - unwind)
  const release = smooth((feed - 0.8) / 0.2)
  const tailY = bottom + (top + height - bottom) * release
  const coilLength = visibleLength * 0.78
  const angles = Array.from({ length: bands }, (_, i) => {
    const ratio = coilLength ? Math.min(1, ((i + 0.5) * segment) / coilLength) : 1
    // Decreasing curvature gives successive turns distinct radii rather than
    // placing multiple layers on the same circular trajectory.
    return curl * (1 - Math.log1p(0.8 * ratio) / Math.log(1.8))
  })
  const vertices = Array.from({ length: bands + 1 }, () => ({ y: 0, z: 0 }))
  vertices[bands] = { y: tailY, z: 0 }
  for (let i = bands - 1; i >= 0; i--) {
    vertices[i] = {
      y: vertices[i + 1].y - segment * Math.cos(angles[i]),
      z: vertices[i + 1].z - segment * Math.sin(angles[i]),
    }
  }
  const poses: PaperBand[] = angles.map((angle, index) => ({
    index,
    ...vertices[index],
    rotation: (angle * 180) / Math.PI,
    height: segment,
    sourceHeight: segment,
    sourceY: index * segment,
    visible: segment > 0.001,
    backVisible: Math.cos(angle) < 0,
    shade: Math.max(
      0,
      Math.min(0.3, 0.24 * (1 - Math.abs(Math.cos(angle))) + 0.025 * Math.sin(angle)),
    ),
  }))
  return {
    phase: feed > 0.8 && feed < 1 ? ('unrolling' as const) : paperPhase(progress),
    feed,
    unroll: unwind,
    leadingY: vertices[0].y,
    targetTop: top,
    visibleLength,
    curl,
    winding: curl / (Math.PI * 2),
    tailAnchored: feed <= 0.8,
    vertices,
    bands: poses,
    edge: { y: tailY, z: 0, rotation: 0 },
  }
}
