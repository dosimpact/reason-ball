import type {
  SceneInteractiveObject,
  SceneObjectReactionFrame,
} from '../model/sceneInteractiveTypes.ts'

export type ScenePropTransform = {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  alpha: number
}
export type ScenePropPose = { subject: ScenePropTransform; effects: ScenePropTransform[] }
const rest = (): ScenePropTransform => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1 })
const number = (value: number) => Number(value.toFixed(5))
/** Shared by the native renderer and CPU QA snapshots; no wall clock or random input. */
export function sceneInteractivePose(
  object: SceneInteractiveObject,
  frame?: SceneObjectReactionFrame,
): ScenePropPose {
  const subject = rest(),
    effects = Array.from({ length: 3 }, () => ({ ...rest(), alpha: 0 }))
  if (!frame || frame.progress <= 0 || frame.progress >= 1) return { subject, effects }
  const p = frame.progress,
    a = frame.intensity,
    wave = Math.sin(p * Math.PI * 4)
  const type = object.reaction.type
  if (frame.reducedMotion) {
    subject.alpha = 1 - a * 0.18
    effects[0]!.alpha = a * 0.5
    return { subject, effects }
  }
  switch (type) {
    case 'wobble':
      subject.rotation = wave * a * 0.16
      break
    case 'spin':
      subject.rotation = Math.PI * 2 * (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) ** 2)
      break
    case 'open':
      subject.scaleY = 1 - 0.5 * a
      subject.rotation = -0.12 * a
      break
    case 'press':
      subject.y = 4 * a
      subject.scaleY = 1 - 0.15 * a
      subject.scaleX = 1 + 0.05 * a
      break
    case 'glow':
      subject.alpha = 1 - 0.16 * a
      break
    case 'ripple':
      subject.y = wave * a * 0.8
      break
    case 'steam':
      subject.rotation = wave * a * 0.025
      break
    case 'flutter':
      subject.scaleX = 1 - 0.27 * Math.abs(wave) * a
      subject.rotation = wave * a * 0.09
      break
    case 'orbit':
      subject.rotation = 0.05 * a
      break
    case 'pour':
      subject.rotation = -0.28 * a
      subject.x = -2 * a
      break
    case 'sparkle':
      subject.rotation = wave * a * 0.035
      break
    case 'bounce':
      subject.y = -10 * Math.abs(Math.sin(p * Math.PI * 2)) * a
      subject.scaleY = 1 - 0.08 * wave * a
      break
    case 'unfold':
      subject.scaleX = 1 + 0.28 * a
      subject.scaleY = 1 + 0.08 * a
      break
    case 'swing':
      subject.rotation = Math.sin(p * Math.PI * 3) * a * 0.23
      break
    case 'bloom':
      subject.scaleX = 1 + 0.17 * a
      subject.scaleY = 1 + 0.2 * a
      break
    case 'tick':
      subject.rotation = (p < 0.5 ? -0.09 : 0.09) * a
      break
  }
  effects.forEach((fx, i) => {
    const phase = (p + i / 3) % 1
    fx.alpha = a * (0.5 - i * 0.08)
    if (type === 'ripple') {
      fx.scaleX = 0.4 + phase * 1.2
      fx.scaleY = 0.25 + phase * 0.4
      fx.y = 15
    } else if (type === 'steam') {
      fx.x = (i - 1) * 10 + Math.sin(phase * 6) * 3
      fx.y = 4 - phase * 20
      fx.scaleX = fx.scaleY = 0.6 + phase * 0.3
    } else if (type === 'orbit') {
      fx.x = Math.cos(p * 6.28 + i * 2.09) * 17
      fx.y = Math.sin(p * 6.28 + i * 2.09) * 12
      fx.scaleX = fx.scaleY = 0.6
    } else if (type === 'pour') {
      fx.x = -14 + i * 3
      fx.y = 1 + phase * 17
      fx.scaleX = 0.4
      fx.scaleY = 0.6
    } else if (type === 'glow') {
      fx.scaleX = fx.scaleY = 0.8 + i * 0.28
      fx.alpha = a * (0.22 - i * 0.04)
    } else if (type === 'swing' || type === 'tick') {
      fx.x = (i - 1) * 12
      fx.y = -9
      fx.scaleX = fx.scaleY = 0.5 + phase * 0.4
    } else if (type === 'flutter') {
      fx.x = (i - 1) * 15
      fx.y = -phase * 10
      fx.rotation = wave * 0.2
      fx.scaleX = fx.scaleY = 0.5
    } else {
      fx.x = (i - 1) * 14
      fx.y = -7 - Math.sin(p * Math.PI + i) * 7
      fx.scaleX = fx.scaleY = 0.4 + a * 0.35
      fx.rotation = p * 0.6
    }
  })
  return { subject, effects }
}
/** Native-compatible SVG, parsed once per node, with no filters, audio or text. */
export function sceneInteractiveEffectSvg(object: SceneInteractiveObject): string {
  const c = object.reaction.color
  let shape: string
  switch (object.reaction.type) {
    case 'ripple':
    case 'glow':
    case 'swing':
    case 'tick':
      shape = '<circle cx="48" cy="48" r="12" fill="none" stroke-width="1.4"/>'
      break
    case 'steam':
      shape = '<path d="M47 56Q42 52 48 48Q53 44 48 39" fill="none" stroke-width="1.7"/>'
      break
    case 'pour':
      shape = '<path d="M48 40Q40 51 48 54Q56 51 48 40" stroke="none"/>'
      break
    case 'flutter':
      shape = '<path d="M41 51Q40 41 48 46Q56 41 55 51L48 48Z" stroke="none"/>'
      break
    case 'bloom':
      shape = '<path d="M48 40Q56 45 48 55Q40 45 48 40" stroke="none"/>'
      break
    case 'orbit':
      shape = '<circle cx="48" cy="48" r="3" stroke="none"/>'
      break
    default:
      shape = '<path d="M48 41L50 46L55 48L50 50L48 55L46 50L41 48L46 46Z" stroke="none"/>'
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><g fill="${c}" stroke="${c}">${shape}</g></svg>`
}
export function sceneInteractiveArtSvg(art: string): string {
  return /^\s*<svg\b/.test(art)
    ? art
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${art}</svg>`
}
function inner(svg: string): string {
  return svg.replace(/^\s*<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '')
}
function transform(t: ScenePropTransform, pivot: { x: number; y: number }) {
  return `translate(${number(pivot.x + t.x)} ${number(pivot.y + t.y)}) rotate(${number((t.rotation * 180) / Math.PI)}) scale(${number(t.scaleX)} ${number(t.scaleY)}) translate(${-pivot.x} ${-pivot.y})`
}
/** A reusable same-frame SVG snapshot: finite reactions and exact idle artwork. */
export function sceneInteractiveObjectSvg(
  object: SceneInteractiveObject,
  frame?: SceneObjectReactionFrame,
): string {
  const pose = sceneInteractivePose(object, frame),
    pivot = object.art.pivot ?? { x: 48, y: 78 }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${inner(object.art.base)}<g transform="${transform(pose.subject, pivot)}" opacity="${number(pose.subject.alpha)}">${inner(object.art.subject)}</g>${pose.effects.map((fx) => (fx.alpha > 0 ? `<g transform="${transform(fx, { x: 48, y: 48 })}" opacity="${number(fx.alpha)}">${inner(sceneInteractiveEffectSvg(object))}</g>` : '')).join('')}</svg>`
}
export function sceneInteractiveLayerSvg(
  objects: readonly SceneInteractiveObject[],
  frames: ReadonlyMap<string, SceneObjectReactionFrame> = new Map(),
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820" viewBox="0 0 800 820">${objects.map((o) => `<g transform="translate(${o.position.x} ${o.position.y}) scale(${o.scale}) translate(-48 -88)">${inner(sceneInteractiveObjectSvg(o, frames.get(o.id)))}</g>`).join('')}</svg>`
}
