import { getSceneInterior } from './sceneInterior.ts'
import { BACKGROUNDS, validateSceneCatalogKeys, type Background } from './backgrounds.ts'
export const DETAIL_KINDS = [
  'droplets',
  'distant-lights',
  'leaf-glints',
  'water-ripples',
  'fireflies',
  'dust',
  'embers',
  'curtain-shadow',
  'table-reflection',
  'neon-sign',
  'neon-reflection',
] as const
export type DetailKind = (typeof DETAIL_KINDS)[number]
export type SceneDetail = {
  kind: DetailKind
  x: number
  y: number
  width: number
  height: number
  count: number
  intensity: number
  duration: number
  delay: number
  layer: 'window' | 'room'
  surface?: 'stream' | 'falls'
  color: string
}
const rows: Record<string, DetailKind[]> = {
  'cafe-neon-night': ['neon-sign', 'neon-reflection', 'droplets'],
  'cafe-rain': ['droplets', 'distant-lights'],
  'cafe-alley': ['distant-lights', 'dust'],
  'cafe-greenhouse': ['leaf-glints', 'droplets'],
  'cafe-rooftop': ['distant-lights', 'dust'],
  'cafe-seaside': ['water-ripples', 'droplets'],
  'study-fire': ['embers', 'dust'],
  'study-attic': ['droplets', 'dust'],
  'study-library': ['dust', 'table-reflection'],
  'study-city': ['distant-lights', 'droplets'],
  'study-moon': ['droplets', 'dust'],
  'forest-mist': ['leaf-glints', 'droplets'],
  'forest-cabin': ['leaf-glints', 'dust'],
  'forest-fireflies': ['fireflies', 'leaf-glints'],
  'forest-bamboo': ['leaf-glints', 'droplets'],
  'forest-autumn': ['leaf-glints', 'droplets'],
  'water-moon': ['water-ripples', 'dust'],
  'water-lake': ['water-ripples', 'dust'],
  'water-stream': ['water-ripples', 'leaf-glints'],
  'water-harbor': ['distant-lights', 'water-ripples'],
  'water-falls': ['water-ripples', 'droplets'],
  'travel-train': ['distant-lights', 'droplets'],
  'travel-tent': ['dust', 'droplets'],
  'travel-van': ['leaf-glints', 'dust'],
  'travel-lodge': ['distant-lights', 'droplets'],
  'travel-stars': ['dust', 'droplets'],
  'garden-hanok': ['leaf-glints', 'droplets'],
  'garden-court': ['leaf-glints', 'dust'],
  'garden-glass': ['leaf-glints', 'droplets'],
  'garden-lotus': ['water-ripples', 'fireflies'],
  'garden-snow': ['droplets', 'dust'],
  'study-linen': ['curtain-shadow', 'dust'],
  'forest-pine-fireflies': ['fireflies', 'leaf-glints'],
  'study-granite': ['droplets', 'dust'],
  'water-harbor-deep': ['distant-lights', 'water-ripples'],
  'water-velvet-tide': ['water-ripples', 'dust'],
  'cafe-barista-long-table': ['distant-lights', 'dust', 'droplets'],
  'cafe-rain-dome': ['droplets', 'dust'],
}
const detailSeeds: Record<string, number> = {
  'cafe-rain': 0,
  'cafe-alley': 17,
  'cafe-greenhouse': 34,
  'cafe-rooftop': 51,
  'cafe-seaside': 68,
  'study-fire': 85,
  'study-attic': 102,
  'study-library': 119,
  'study-city': 136,
  'study-moon': 153,
  'forest-mist': 170,
  'forest-cabin': 187,
  'forest-fireflies': 204,
  'forest-bamboo': 221,
  'forest-autumn': 238,
  'water-moon': 255,
  'water-lake': 272,
  'water-stream': 289,
  'water-harbor': 306,
  'water-falls': 323,
  'travel-train': 340,
  'travel-tent': 357,
  'travel-van': 374,
  'travel-lodge': 391,
  'travel-stars': 408,
  'garden-hanok': 425,
  'garden-court': 442,
  'garden-glass': 459,
  'garden-lotus': 476,
  'garden-snow': 493,
  'study-linen': 510,
  'forest-pine-fireflies': 527,
  'study-granite': 544,
  'water-harbor-deep': 561,
  'water-velvet-tide': 578,
  'cafe-barista-long-table': 595,
  'cafe-rain-dome': 612,
  'cafe-neon-night': 629,
}
function descriptor(room: Background, kind: DetailKind, index: number): SceneDetail {
  const seed = detailSeeds[room.id] + index * 31
  const detail: SceneDetail = {
    kind,
    x: 100,
    y: 220,
    width: 590,
    height: 300,
    count: 3,
    intensity: 0.8,
    duration: 8 + (seed % 13),
    delay: -(seed % 23),
    layer: 'window',
    color: '#bed3c5',
  }
  if (kind === 'droplets')
    Object.assign(detail, {
      x: room.id === 'cafe-rain' ? 110 : 210,
      y: 220 + (seed % 50),
      width: room.id === 'cafe-rain-dome' ? 410 : 350,
      height: 220,
      duration: 16 + (seed % 11),
      color: '#c5d9d0',
    })
  if (kind === 'distant-lights')
    Object.assign(detail, {
      count: 1,
      x: 90,
      y: room.id === 'cafe-barista-long-table' ? 285 : room.id === 'travel-train' ? 310 : 420,
      width: 600,
      height: 38,
      duration: room.id === 'travel-train' ? 18 : 27 + (seed % 17),
      color: '#d5bb81',
    })
  if (kind === 'leaf-glints')
    Object.assign(detail, {
      x: room.id === 'water-stream' ? 90 : 110,
      y: room.id === 'garden-glass' ? 320 : 290,
      width: room.id === 'water-stream' ? 180 : 550,
      height: 210,
      duration: 11 + (seed % 8),
      color: room.id === 'forest-autumn' ? '#bfa479' : '#8eb6a0',
    })
  if (kind === 'water-ripples')
    Object.assign(detail, {
      x: 95,
      y: room.id === 'garden-lotus' ? 440 : room.id === 'cafe-rain-dome' ? 505 : 465,
      width: 610,
      height: 85,
      duration: 9 + (seed % 8),
      color: '#a5c3bc',
    })
  if (room.id === 'water-stream' && kind === 'water-ripples')
    Object.assign(detail, { x: 330, y: 470, width: 190, height: 100, surface: 'stream' })
  if (room.id === 'water-falls' && kind === 'water-ripples')
    Object.assign(detail, { x: 345, y: 270, width: 160, height: 250, surface: 'falls' })
  if (kind === 'fireflies')
    Object.assign(detail, {
      count: 6,
      x: 140,
      y: room.id === 'garden-lotus' ? 345 : 270,
      width: 510,
      height: 220,
      duration: 9 + (seed % 10),
      color: '#c9d99a',
    })
  if (kind === 'dust') {
    const lamp = getSceneInterior(room.id).lights[0]
    Object.assign(detail, {
      count: 5,
      x: Math.max(0, lamp.x - 32),
      y: lamp.y + 25,
      width: 64,
      height: Math.min(150, 790 - lamp.y),
      layer: 'room',
      duration: 17 + (seed % 12),
      color: '#d7bb85',
    })
  }
  if (kind === 'embers')
    Object.assign(detail, {
      x: 345,
      y: 470,
      width: 105,
      height: 95,
      duration: 8 + (seed % 4),
      layer: 'window',
      color: '#dfb16b',
    })
  if (kind === 'neon-sign' || kind === 'neon-reflection')
    Object.assign(detail, {
      x: 0,
      y: 0,
      width: 800,
      height: 580,
      count: 3,
      intensity: 1,
      duration: kind === 'neon-sign' ? 12 : 17,
      color: '#8cdbd1',
    })
  if (kind === 'table-reflection')
    Object.assign(detail, {
      count: 1,
      x: 275,
      y: 625,
      width: 72,
      height: 8,
      duration: 15,
      layer: 'room',
      color: '#d7bb85',
    })
  if (kind === 'curtain-shadow')
    Object.assign(detail, {
      count: 1,
      x: 72,
      y: 125,
      width: 55,
      height: 305,
      duration: 13,
      layer: 'room',
      color: '#454e39',
    })
  return detail
}
export const SCENE_DETAILS: Record<string, SceneDetail[]> = Object.fromEntries(
  BACKGROUNDS.map((room) => [
    room.id,
    (rows[room.id] ?? []).map((kind, index) => descriptor(room, kind, index)),
  ]),
)
export function validateSceneDetails(configs = SCENE_DETAILS): string[] {
  const errors: string[] = [
    ...validateSceneCatalogKeys(rows, 'detail families'),
    ...validateSceneCatalogKeys(detailSeeds, 'detail seeds'),
    ...validateSceneCatalogKeys(configs, 'details'),
  ]
  for (const id of Object.keys(configs))
    if (!BACKGROUNDS.some((room) => room.id === id)) errors.push(`unexpected detail room: ${id}`)
  for (const id of Object.keys(rows))
    if (!BACKGROUNDS.some((room) => room.id === id)) errors.push(`unknown detail room: ${id}`)
  for (const room of BACKGROUNDS) {
    const details = configs[room.id]
    if (!details || details.length < 2 || new Set(details.map((item) => item.kind)).size < 2) {
      errors.push(`${room.id}: two detail families required`)
      continue
    }
    for (const detail of details) {
      if (
        !DETAIL_KINDS.includes(detail.kind) ||
        !['window', 'room'].includes(detail.layer) ||
        !/^#[0-9a-f]{6}$/i.test(detail.color)
      )
        errors.push(`${room.id}: detail kind/layer/color`)
      if (
        !Number.isInteger(detail.count) ||
        detail.count < 1 ||
        detail.count > 6 ||
        !Number.isFinite(detail.intensity) ||
        detail.intensity <= 0 ||
        detail.intensity > 1 ||
        (detail.surface && !['stream', 'falls'].includes(detail.surface))
      )
        errors.push(`${room.id}: detail count/intensity/surface`)
      if (
        ![detail.x, detail.y, detail.width, detail.height, detail.duration, detail.delay].every(
          Number.isFinite,
        ) ||
        detail.x < 0 ||
        detail.y < 0 ||
        detail.width <= 0 ||
        detail.height <= 0 ||
        detail.x + detail.width > 800 ||
        detail.y + detail.height > 820 ||
        detail.duration < 4 ||
        detail.duration > 60
      )
        errors.push(`${room.id}: detail bounds/timing`)
    }
  }
  return errors
}
