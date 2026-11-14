import { ALL_BACKGROUNDS } from './backgrounds.ts'
import { SCENE_INTERIORS } from './sceneInterior.ts'
import { STANDARD_WORLD_RENOVATIONS } from './sceneRenovationStandard.ts'
import { PREMIUM_WORLD_RENOVATIONS } from './sceneRenovationPremium.ts'
import { SCENE_EDGE_MATERIALS, type SceneEdgeMaterials } from './sceneWorldEdges.ts'
import type { SceneRenovation } from './sceneRenovation.ts'

export const SCENE_WORLD_BOUNDS = { x: -900, y: -760, width: 2600, height: 2340 } as const
export type SceneWorld = {
  id: string
  bounds: typeof SCENE_WORLD_BOUNDS
  wall: string
  floor: string
  trim: string
  detail: string
  open: boolean
  renovation: SceneRenovation
  edge: SceneEdgeMaterials
}

const premiumPalette: Record<string, readonly [string, string, string]> = {
  'premium-christmas-bookcafe': ['#282923', '#665039', '#8f7855'],
  'premium-halloween-greenhouse': ['#262b28', '#554b39', '#66715c'],
  'premium-sakura-teahouse': ['#36382d', '#8a7657', '#9d9479'],
  'premium-autumn-lake': ['#332d26', '#69513b', '#897453'],
  'premium-newyear-attic': ['#302e2a', '#6c5741', '#9e855a'],
  'premium-orient-express': ['#292a28', '#5b4434', '#a38d5e'],
  'premium-treetop-house': ['#2c3526', '#776044', '#827251'],
  'premium-storm-lighthouse': ['#343d3a', '#6a6856', '#9b9f88'],
  'premium-canal-houseboat': ['#3c3a2b', '#6b563d', '#a39163'],
  'premium-cloud-airship': ['#303d3b', '#6c7163', '#a4ac96'],
  'premium-wizard-library': ['#2b2931', '#675443', '#8b7c60'],
  'premium-dragon-study': ['#332f2a', '#756247', '#9a8764'],
  'premium-mushroom-teahouse': ['#383a2c', '#817255', '#a3a485'],
  'premium-moon-alchemy': ['#292e39', '#5d5e5a', '#939c92'],
  'premium-spirit-tree': ['#26382e', '#6c6247', '#819976'],
  'premium-neon-loft': ['#252c35', '#555455', '#6b8190'],
  'premium-midnight-jazz': ['#2b2730', '#71543e', '#967d56'],
  'premium-museum-studio': ['#3e4039', '#8c8269', '#afb19c'],
  'premium-last-bookstore': ['#322c25', '#72573d', '#937b56'],
  'premium-rooftop-cinema': ['#242c31', '#645b45', '#7f8e7e'],
  'premium-waterfall-study': ['#2e3c37', '#67745d', '#91a28c'],
  'premium-underwater-library': ['#20373b', '#536b66', '#92b3a5'],
  'premium-rain-garden-dome': ['#263a2e', '#6a7056', '#8fa78b'],
  'premium-desert-rain': ['#494132', '#9b815c', '#c0af86'],
  'premium-onsen-veranda': ['#31372c', '#7c6b4e', '#a7a582'],
  'premium-observatory': ['#2d303d', '#666777', '#a4a5b2'],
  'premium-moon-base': ['#293d43', '#627b7b', '#a8c2b7'],
  'premium-cloud-post': ['#353a33', '#827155', '#a9a182'],
  'premium-personal-roastery': ['#302c29', '#71604b', '#9c8a6d'],
  'premium-memory-house': ['#3b3931', '#897353', '#ad9c7a'],
}
/** The per-room architectural plan is authoritative; old ceiling/tile presets are retired.
 * Keep original composition and animal supports fixed, then review both portrait and landscape. */
export const SCENE_WORLDS: Record<string, SceneWorld> = Object.fromEntries(
  ALL_BACKGROUNDS.map((room) => {
    const renovation = STANDARD_WORLD_RENOVATIONS[room.id] || PREMIUM_WORLD_RENOVATIONS[room.id]
    const edge = SCENE_EDGE_MATERIALS[room.id]
    const interior = SCENE_INTERIORS[room.id]
    const palette = premiumPalette[room.id]
    if (!renovation || !edge || (!interior && !palette))
      throw new Error(`Missing authored architecture/materials: ${room.id}`)
    return [
      room.id,
      {
        id: room.id,
        bounds: SCENE_WORLD_BOUNDS,
        wall: interior?.wall.color || palette[0],
        floor: interior?.floor || palette[1],
        trim: interior?.trim || palette[2],
        detail: room.id,
        open: renovation.envelope === 'open',
        renovation,
        edge,
      } satisfies SceneWorld,
    ]
  }),
)
export function getSceneWorld(id: string): SceneWorld {
  return SCENE_WORLDS[id] || SCENE_WORLDS['cafe-rain']
}
