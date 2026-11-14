/** Architectural decisions for the real space outside the preserved 800×820 composition.
 * Features must be visible in portrait framing, attached to a surface and appropriate to the room.
 * Coordinates are world coordinates; do not use viewport padding or repeat a floor tile image. */
export type RoomEnvelope =
  | 'timber'
  | 'vault'
  | 'glasshouse'
  | 'attic'
  | 'fabric'
  | 'cabin'
  | 'hull'
  | 'dome'
  | 'organic'
  | 'open'
  | 'industrial'
  | 'salon'
export type RoomForeground =
  | 'counter'
  | 'desk'
  | 'rug'
  | 'deck'
  | 'tatami'
  | 'cabin'
  | 'stone'
  | 'organic'
  | 'platform'
  | 'workshop'
export type UpperFeature =
  | 'coving'
  | 'shelf'
  | 'curtain'
  | 'skylight'
  | 'lockers'
  | 'plants'
  | 'ducts'
  | 'rope'
  | 'branches'
  | 'panels'
  | 'luggage'
  | 'lanterns'
export type LowerFeature =
  | 'foot-rail'
  | 'rug-edge'
  | 'woven-edge'
  | 'planter'
  | 'drawers'
  | 'cases'
  | 'books'
  | 'cables'
  | 'stone-step'
  | 'roots'
  | 'cushion'
  | 'joinery'
export type SceneRenovation = {
  envelope: RoomEnvelope
  foreground: RoomForeground
  roofRise: number
  vanishing: { x: number; y: number }
  upperFeature: UpperFeature
  upperX: number
  lowerFeature: LowerFeature
  lowerX: number
  /** Why this structure continues the original room; an authoring note, never product copy. */
  rationale: string
}
