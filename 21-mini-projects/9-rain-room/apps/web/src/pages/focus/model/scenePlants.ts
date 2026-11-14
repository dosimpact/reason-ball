/** 공간별 식물 원본. 각 배경 ID에 식물 배치를 명시한다. 표시 순서와 무관하다.
 * ScenePlants가 그림과 비 가림을 공유한다. 위치/크기 변경 시 지지대와 모바일 잘림도 검토한다. */
import {
  BACKGROUNDS,
  getBackground,
  validateSceneCatalogKeys,
  type Background,
} from './backgrounds.ts'
export type PlantSpecies =
  | 'monstera'
  | 'rubber'
  | 'pothos'
  | 'succulent'
  | 'snake'
  | 'bonsai'
  | 'fern'
  | 'moss'
  | 'ivy'
  | 'grass'
  | 'olive'
  | 'bamboo'
  | 'camellia'
  | 'blossom'
  | 'rosemary'
export type PlantContainer =
  | 'terracotta'
  | 'ceramic'
  | 'brass'
  | 'basket'
  | 'stone'
  | 'glass'
  | 'wood'
export type ScenePlant = {
  species: PlantSpecies
  container: PlantContainer
  support: 'floor' | 'stand' | 'shelf' | 'hanging'
  x: number
  y: number
  scale: number
  layer: 'indoor'
  mountX?: number
  mountY?: number
  floorY?: number
}
const plant = (
  species: PlantSpecies,
  container: PlantContainer,
  support: ScenePlant['support'],
  x: number,
  y: number,
  scale: number,
  mount?: number,
): ScenePlant => ({
  species,
  container,
  support,
  x,
  y,
  scale,
  layer: 'indoor',
  ...(support === 'hanging'
    ? { mountY: mount ?? 65 }
    : support === 'shelf'
      ? { mountX: mount ?? 765 }
      : {}),
})
const stand = (
  species: PlantSpecies,
  container: PlantContainer,
  x: number,
  y: number,
  floorY: number,
  scale: number,
): ScenePlant => ({ species, container, support: 'stand', x, y, scale, layer: 'indoor', floorY })
/** Each arrangement has a real floor/stand, supported wall shelf, or ceiling hook. Landscape trees stay separate. */
const rows: Record<string, ScenePlant[]> = {
  'cafe-rain': [plant('monstera', 'terracotta', 'floor', 756, 724, 1.05)],
  'cafe-alley': [
    plant('rubber', 'ceramic', 'floor', 756, 710, 0.78),
    plant('pothos', 'brass', 'shelf', 94, 320, 0.65, 42),
  ],
  'cafe-greenhouse': [plant('monstera', 'basket', 'floor', 752, 710, 0.75)],
  'cafe-rooftop': [plant('succulent', 'stone', 'shelf', 112, 342, 0.72, 38)],
  'cafe-seaside': [plant('olive', 'terracotta', 'floor', 755, 720, 0.8)],
  'study-fire': [plant('snake', 'brass', 'floor', 66, 710, 0.8)],
  'study-attic': [plant('bonsai', 'ceramic', 'shelf', 664, 322, 0.7, 742)],
  'study-library': [plant('pothos', 'ceramic', 'shelf', 766, 275, 0.44, 784)],
  'study-city': [plant('succulent', 'ceramic', 'shelf', 128, 325, 0.75, 38)],
  'study-moon': [plant('bonsai', 'stone', 'shelf', 710, 450, 0.68, 765)],
  'forest-mist': [
    stand('fern', 'basket', 70, 660, 710, 0.86),
    plant('ivy', 'ceramic', 'hanging', 690, 270, 0.65, 75),
  ],
  'forest-cabin': [
    stand('moss', 'stone', 84, 660, 705, 0.86),
    plant('fern', 'basket', 'hanging', 722, 352, 0.68, 85),
  ],
  'forest-fireflies': [
    plant('ivy', 'terracotta', 'hanging', 54, 185, 0.48, 82),
    stand('moss', 'stone', 755, 660, 710, 0.7),
  ],
  'forest-bamboo': [plant('bamboo', 'basket', 'floor', 750, 718, 0.86)],
  'forest-autumn': [stand('fern', 'terracotta', 74, 660, 710, 0.9)],
  'water-moon': [
    stand('grass', 'stone', 52, 660, 718, 0.85),
    plant('olive', 'terracotta', 'floor', 757, 720, 0.7),
  ],
  'water-lake': [stand('grass', 'glass', 757, 660, 718, 0.85)],
  'water-stream': [plant('olive', 'stone', 'floor', 72, 715, 0.8)],
  'water-harbor': [
    stand('grass', 'wood', 69, 660, 710, 0.85),
    plant('pothos', 'brass', 'hanging', 706, 320, 0.62, 75),
  ],
  'water-falls': [
    stand('fern', 'stone', 72, 660, 710, 0.86),
    plant('moss', 'ceramic', 'shelf', 710, 445, 0.72, 766),
  ],
  'travel-train': [plant('snake', 'ceramic', 'shelf', 744, 410, 0.5, 770)],
  'travel-tent': [stand('rosemary', 'wood', 752, 660, 712, 0.85)],
  'travel-van': [plant('rosemary', 'wood', 'shelf', 125, 390, 0.7, 83)],
  'travel-lodge': [
    stand('fern', 'basket', 70, 660, 712, 0.86),
    plant('ivy', 'terracotta', 'hanging', 687, 288, 0.65, 80),
  ],
  'travel-stars': [plant('succulent', 'brass', 'shelf', 737, 435, 0.8, 770)],
  'garden-hanok': [
    plant('bamboo', 'wood', 'floor', 60, 718, 0.8),
    plant('camellia', 'ceramic', 'floor', 755, 720, 0.72),
  ],
  'garden-court': [
    stand('bonsai', 'stone', 74, 660, 710, 0.88),
    plant('blossom', 'ceramic', 'floor', 750, 718, 0.86),
  ],
  'garden-glass': [
    plant('fern', 'basket', 'hanging', 112, 320, 0.78, 100),
    plant('rubber', 'ceramic', 'floor', 755, 720, 0.7),
  ],
  'garden-lotus': [
    plant('bamboo', 'stone', 'floor', 756, 718, 0.78),
    plant('blossom', 'ceramic', 'shelf', 106, 358, 0.65, 38),
  ],
  'garden-snow': [plant('camellia', 'terracotta', 'floor', 70, 718, 0.8)],
  'study-linen': [plant('pothos', 'ceramic', 'hanging', 220, 290, 0.65, 42)],
  'forest-pine-fireflies': [
    stand('moss', 'stone', 72, 660, 712, 0.8),
    plant('fern', 'basket', 'hanging', 694, 310, 0.68, 82),
  ],
  'study-granite': [plant('snake', 'stone', 'floor', 90, 715, 0.88)],
  'water-harbor-deep': [plant('olive', 'brass', 'floor', 756, 722, 0.72)],
  'water-velvet-tide': [stand('grass', 'basket', 757, 660, 742, 0.62)],
  'cafe-barista-long-table': [
    plant('succulent', 'ceramic', 'shelf', 80, 322, 0.65, 30),
    plant('rubber', 'wood', 'floor', 765, 772, 0.74),
  ],
  'cafe-rain-dome': [plant('ivy', 'terracotta', 'hanging', 136, 336, 0.72, 155)],
  'cafe-neon-night': [
    plant('rubber', 'ceramic', 'floor', 754, 720, 0.7),
    plant('pothos', 'brass', 'shelf', 112, 420, 0.58, 38),
  ],
}
export const SCENE_PLANTS: Record<string, ScenePlant[]> = Object.fromEntries(
  BACKGROUNDS.map((room) => [room.id, rows[room.id]]),
)
export function getScenePlants(backgroundOrId: Background | string): ScenePlant[] {
  const room = typeof backgroundOrId === 'string' ? getBackground(backgroundOrId) : backgroundOrId
  return SCENE_PLANTS[room.id]
}
export function validateScenePlants(): string[] {
  const errors: string[] = validateSceneCatalogKeys(rows, 'plant rows')
  errors.push(...validateSceneCatalogKeys(SCENE_PLANTS, 'plants'))
  for (const room of BACKGROUNDS) {
    const plants = SCENE_PLANTS[room.id]
    if (!plants || plants.length < 1 || plants.length > 3) {
      errors.push(room.id)
      continue
    }
    for (const item of plants)
      if (
        ![item.x, item.y, item.scale].every(Number.isFinite) ||
        item.x < 0 ||
        item.x > 800 ||
        item.y < 0 ||
        item.y > 820 ||
        item.scale <= 0 ||
        item.scale > 1.5 ||
        item.layer !== 'indoor' ||
        !['floor', 'stand', 'shelf', 'hanging'].includes(item.support) ||
        ![
          'monstera',
          'rubber',
          'pothos',
          'succulent',
          'snake',
          'bonsai',
          'fern',
          'moss',
          'ivy',
          'grass',
          'olive',
          'bamboo',
          'camellia',
          'blossom',
          'rosemary',
        ].includes(item.species) ||
        !['terracotta', 'ceramic', 'brass', 'basket', 'stone', 'glass', 'wood'].includes(
          item.container,
        ) ||
        (item.support === 'hanging' && (!Number.isFinite(item.mountY) || item.mountY! >= item.y)) ||
        (item.support === 'shelf' && !Number.isFinite(item.mountX)) ||
        (item.support === 'stand' && (!Number.isFinite(item.floorY) || item.floorY! <= item.y))
      )
        errors.push(`${room.id}: plant support/anchor`)
  }
  return errors
}
