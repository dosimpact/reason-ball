/** Authored, room-local discoveries. These props never initiate their own reaction. */
export type SceneObjectReaction =
  | 'wobble'
  | 'spin'
  | 'open'
  | 'press'
  | 'glow'
  | 'ripple'
  | 'steam'
  | 'flutter'
  | 'orbit'
  | 'pour'
  | 'sparkle'
  | 'bounce'
  | 'unfold'
  | 'swing'
  | 'bloom'
  | 'tick'

export type SceneInteractiveObject = {
  /** Globally unique, stable identity; state belongs only to this room's object. */
  id: string
  roomId: string
  label: { ko: string; en: string; zh: string }
  /** Original discoveries omit this field and stay small. Large props have authored silhouettes. */
  size?: 'small' | 'large'
  /** Contact/mount position in the original 800×820 world, NOT screen coordinates. */
  position: { x: number; y: number }
  scale: number
  /** Tight local art bounds for pointer targets; avoids invisible corners stealing nearby taps. */
  interactionBounds?: { x: number; y: number; width: number; height: number }
  surface: {
    kind: 'table' | 'shelf' | 'wall' | 'window' | 'ceiling' | 'floor' | 'water'
    /** Source fixture or authored support explaining why the prop belongs here. */
    note: string
  }
  /** Local 96×96 art, contact at(48,88). Plain native-compatible SVG shapes only.
   * Base stays fixed; subject moves around pivot. No images, filters, text or idle CSS.
   * Stroke-only paths need explicit fill="none"; implicit SVG fill closes crank elbows. */
  art: { base: string; subject: string; pivot?: { x: number; y: number } }
  reaction: {
    type: SceneObjectReaction
    durationMs: number
    color: string
    strength?: number
    /** Authoring/catalog description; never rendered as a discovery hint. */
    description: string
  }
}

export type SceneObjectReactionFrame = {
  id: string
  type: SceneObjectReaction
  progress: number
  intensity: number
  elapsedMs: number
  durationMs: number
  trigger: number
  reducedMotion: boolean
}
