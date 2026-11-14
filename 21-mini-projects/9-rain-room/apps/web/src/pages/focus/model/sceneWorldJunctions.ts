/** Semantic edge registration from Cafe, SpecialCafeScenes and PremiumScene.
 * These are source geometry, never inferred from the expanded-room vanishing point. */
export type SceneWorldJunction = {
  id: string
  source: 'ordinary' | 'premium' | 'original' | 'barista' | 'dome'
  wallMaterial: string
  floorMaterial: string
  floorLeft: number
  floorRight: number
  slopeLeft: number
  slopeRight: number
  textureBottom: number
  horizon?: { y: number; color: string }
  rail?: { courses: number[]; bottom: number; width: number }
  counter?: true
}
const normalMaterials: Record<string, string> = {
  'cafe-rain': 'plaster',
  'cafe-alley': 'brick',
  'cafe-greenhouse': 'plaster',
  'cafe-rooftop': 'metal',
  'cafe-seaside': 'slats',
  'study-fire': 'brick',
  'study-attic': 'panels',
  'study-library': 'panels',
  'study-city': 'plaster',
  'study-moon': 'wallpaper',
  'forest-mist': 'slats',
  'forest-cabin': 'logs',
  'forest-fireflies': 'plaster',
  'forest-bamboo': 'lattice',
  'forest-autumn': 'slats',
  'water-moon': 'stone',
  'water-lake': 'slats',
  'water-stream': 'stone',
  'water-harbor': 'brick',
  'water-falls': 'plaster',
  'travel-train': 'panels',
  'travel-tent': 'canvas',
  'travel-van': 'metal',
  'travel-lodge': 'logs',
  'travel-stars': 'plaster',
  'garden-hanok': 'lattice',
  'garden-court': 'stone',
  'garden-glass': 'plaster',
  'garden-lotus': 'slats',
  'garden-snow': 'plaster',
  'study-linen': 'plaster',
  'forest-pine-fireflies': 'logs',
  'study-granite': 'stone',
  'water-harbor-deep': 'brick',
  'water-velvet-tide': 'slats',
  'cafe-barista-long-table': 'brick',
  'cafe-rain-dome': 'stone',
  'cafe-neon-night': 'brick',
}
const premiumMaterials: Record<string, readonly [string, string]> = {
  'premium-christmas-bookcafe': ['brick', 'parquet'],
  'premium-halloween-greenhouse': ['iron', 'tile'],
  'premium-sakura-teahouse': ['paper', 'tatami'],
  'premium-autumn-lake': ['plaster', 'boards'],
  'premium-newyear-attic': ['beams', 'herringbone'],
  'premium-orient-express': ['panel', 'carpet'],
  'premium-treetop-house': ['timber', 'boards'],
  'premium-storm-lighthouse': ['stone', 'flagstone'],
  'premium-canal-houseboat': ['painted', 'boards'],
  'premium-cloud-airship': ['rivets', 'metal'],
  'premium-wizard-library': ['gothic', 'carpet'],
  'premium-dragon-study': ['stone', 'flagstone'],
  'premium-mushroom-teahouse': ['organic', 'mosaic'],
  'premium-moon-alchemy': ['tile', 'mosaic'],
  'premium-spirit-tree': ['bark', 'roots'],
  'premium-neon-loft': ['concrete', 'metal'],
  'premium-midnight-jazz': ['acoustic', 'parquet'],
  'premium-museum-studio': ['plaster', 'tile'],
  'premium-last-bookstore': ['panel', 'herringbone'],
  'premium-rooftop-cinema': ['concrete', 'deck'],
  'premium-waterfall-study': ['stone', 'flagstone'],
  'premium-underwater-library': ['rivets', 'mosaic'],
  'premium-rain-garden-dome': ['lattice', 'tile'],
  'premium-desert-rain': ['adobe', 'mosaic'],
  'premium-onsen-veranda': ['timber', 'deck'],
  'premium-observatory': ['gothic', 'metal'],
  'premium-moon-base': ['rivets', 'metal'],
  'premium-cloud-post': ['painted', 'herringbone'],
  'premium-personal-roastery': ['brick', 'tile'],
  'premium-memory-house': ['wallpaper', 'parquet'],
}
export const SCENE_WORLD_JUNCTIONS: Record<string, SceneWorldJunction> = {
  ...Object.fromEntries(
    Object.entries(normalMaterials).map(([id, wallMaterial]) => [
      id,
      {
        id,
        source: 'ordinary',
        wallMaterial,
        floorMaterial: 'ordinary',
        floorLeft: 658,
        floorRight: 620,
        slopeLeft: -38 / 800,
        slopeRight: -38 / 800,
        textureBottom: 580,
      } satisfies SceneWorldJunction,
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(premiumMaterials).map(([id, [wallMaterial, floorMaterial]]) => [
      id,
      {
        id,
        source: 'premium',
        wallMaterial,
        floorMaterial,
        floorLeft: 590,
        floorRight: 590,
        slopeLeft: 25 / 400,
        slopeRight: -25 / 400,
        textureBottom: 590,
      } satisfies SceneWorldJunction,
    ]),
  ),
}
Object.assign(SCENE_WORLD_JUNCTIONS['cafe-rain'], {
  source: 'original',
  floorLeft: 665,
  floorRight: 625,
  slopeLeft: -40 / 800,
  slopeRight: -40 / 800,
  counter: true,
  textureBottom: 600,
})
Object.assign(SCENE_WORLD_JUNCTIONS['cafe-barista-long-table'], {
  source: 'barista',
  floorLeft: 535,
  floorRight: 535,
  slopeLeft: 0,
  slopeRight: 0,
  textureBottom: 535,
})
Object.assign(SCENE_WORLD_JUNCTIONS['cafe-rain-dome'], {
  source: 'dome',
  floorLeft: 644,
  floorRight: 644,
  slopeLeft: -66 / 400,
  slopeRight: 66 / 400,
  textureBottom: 600,
})
// The enlarged round window now leaves the original wall texture visible to y600;
// CozyRoom's lower wall starts at610. Match that visible band in the PC side bays.
Object.assign(SCENE_WORLD_JUNCTIONS['forest-fireflies'], { textureBottom: 600 })
for (const [id, y, color] of [
  ['water-moon', 400, '#29484f'],
  ['water-lake', 460, '#3b5553'],
  ['water-velvet-tide', 280, '#486665'],
] as const)
  Object.assign(SCENE_WORLD_JUNCTIONS[id], {
    floorLeft: 650,
    floorRight: 650,
    slopeLeft: 0,
    slopeRight: 0,
    textureBottom: 107,
    horizon: { y, color },
    rail: { courses: [574, 586], bottom: 655, width: 9 },
  })
Object.assign(SCENE_WORLD_JUNCTIONS['premium-onsen-veranda'], {
  floorLeft: 580,
  floorRight: 580,
  slopeLeft: 0,
  slopeRight: 0,
  floorMaterial: 'onsen-deck',
  textureBottom: 580,
})
export function getSceneWorldJunction(id: string): SceneWorldJunction {
  const junction = SCENE_WORLD_JUNCTIONS[id]
  if (!junction) throw new Error(`Missing semantic room junction: ${id}`)
  return junction
}
/** Source tangents continue at both vertical borders without an invented camera shift. */
export function sideFloorAt(junction: SceneWorldJunction, x: number): number {
  return x <= 0
    ? junction.floorLeft + x * junction.slopeLeft
    : junction.floorRight + (x - 800) * junction.slopeRight
}

/** Full-width outdoor openings in the original premium core, not inferred from theme names. */
export const PREMIUM_SIDE_OPENINGS: Record<
  string,
  {
    top: number
    bottom: number
    horizon: number
    water: string
    beamY: number
    beamWidth: number
    beamColor: string
    railY?: number
    railColor?: string
  }
> = {
  'premium-rooftop-cinema': {
    top: 160,
    bottom: 565,
    horizon: 500,
    water: '#364b49',
    beamY: 150,
    beamWidth: 24,
    beamColor: '#697763',
    railY: 510,
    railColor: '#8e9c86',
  },
  'premium-onsen-veranda': {
    top: 155,
    bottom: 540,
    horizon: 400,
    water: '#668274',
    beamY: 130,
    beamWidth: 27,
    beamColor: '#8b8060',
  },
}
