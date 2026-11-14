/** 공간별 인테리어 원본. 각 항목은 안정적인 배경 ID로 연결한다.
 * 벽/책상/조명을 바꿀 때 접점과 글로우·비 가림을 함께 확인한다. 추가 절차는 backgrounds.ts 상단 참고. */
import { BACKGROUNDS, resolveBackgroundId, validateSceneCatalogKeys } from './backgrounds.ts'
export type LightKind =
  | 'brass'
  | 'opal'
  | 'rattan'
  | 'track'
  | 'desk'
  | 'sconce'
  | 'library'
  | 'lantern'
  | 'paper'
  | 'rope'
  | 'string'
  | 'strip'
  | 'floor'
  | 'cage'
export type LightFixture = {
  kind: LightKind
  x: number
  y: number
  mountY?: number
  reach?: number
  glow: number
}
export type WallMaterial =
  | 'plaster'
  | 'brick'
  | 'slats'
  | 'logs'
  | 'panels'
  | 'wallpaper'
  | 'stone'
  | 'canvas'
  | 'metal'
  | 'lattice'
export type TableShape =
  | 'writing'
  | 'oval'
  | 'live-edge'
  | 'stone'
  | 'round'
  | 'counter'
  | 'fold-down'
  | 'tea'
  | 'glass'
export type SceneInterior = {
  id: string
  wall: { material: WallMaterial; color: string; detail: string }
  trim: string
  floor: string
  table: {
    shape: TableShape
    surface: string
    edge: string
    material: 'wood' | 'stone' | 'metal' | 'bamboo' | 'glass' | 'linen'
    support: 'four' | 'pedestal' | 'slab' | 'brackets' | 'trestle'
  }
  lights: LightFixture[]
  enclosure: 'room' | 'terrace'
}
const light = (
  kind: LightKind,
  x: number,
  y: number,
  glow = 0.22,
  mountY = 0,
  reach?: number,
): LightFixture => ({ kind, x, y, glow, mountY, reach })
type Row = [
  WallMaterial,
  string,
  string,
  string,
  TableShape,
  string,
  SceneInterior['table']['material'],
  SceneInterior['table']['support'],
  LightFixture[],
]
/** Authored by room: silhouettes, mount positions and contact-safe furniture are deliberate choices. */
const rows: Record<string, Row> = {
  'cafe-rain': [
    'plaster',
    '#252a24',
    '#756951',
    '#554431',
    'counter',
    '#786046',
    'wood',
    'four',
    [light('brass', 574, 182)],
  ],
  'cafe-alley': [
    'brick',
    '#2c2524',
    '#9b7a60',
    '#503e33',
    'round',
    '#745745',
    'wood',
    'pedestal',
    [light('opal', 400, 170, 0.26)],
  ],
  'cafe-greenhouse': [
    'plaster',
    '#26352c',
    '#7d8d73',
    '#5e5140',
    'glass',
    '#71857a',
    'glass',
    'four',
    [light('rattan', 405, 172, 0.2)],
  ],
  'cafe-rooftop': [
    'metal',
    '#212a30',
    '#6d7c81',
    '#494c48',
    'counter',
    '#58656a',
    'metal',
    'trestle',
    [light('track', 230, 142, 0.18), light('track', 590, 142, 0.18)],
  ],
  'cafe-seaside': [
    'slats',
    '#263336',
    '#82928d',
    '#5b5144',
    'live-edge',
    '#9a8b70',
    'wood',
    'four',
    [light('rope', 145, 190, 0.24), light('rope', 655, 190, 0.24)],
  ],
  'study-fire': [
    'brick',
    '#2d2520',
    '#886950',
    '#503c2c',
    'writing',
    '#6c4d34',
    'wood',
    'four',
    [light('sconce', 36, 325, 0.3), light('sconce', 764, 325, 0.3)],
  ],
  'study-attic': [
    'panels',
    '#30332b',
    '#82775e',
    '#5d4f3b',
    'fold-down',
    '#9a835f',
    'wood',
    'brackets',
    [light('desk', 270, 527, 0.26, 0, 280)],
  ],
  'study-library': [
    'panels',
    '#262a27',
    '#8e856b',
    '#51422f',
    'counter',
    '#71583e',
    'wood',
    'trestle',
    [light('library', 400, 170, 0.24)],
  ],
  'study-city': [
    'plaster',
    '#273136',
    '#747e78',
    '#4b4c42',
    'stone',
    '#6e7772',
    'stone',
    'four',
    [light('strip', 400, 143, 0.2)],
  ],
  'study-moon': [
    'wallpaper',
    '#282c32',
    '#777e8b',
    '#4b4540',
    'tea',
    '#5c6267',
    'wood',
    'pedestal',
    [light('desk', 280, 534, 0.23, 0, 290)],
  ],
  'forest-mist': [
    'slats',
    '#23342b',
    '#718571',
    '#66513a',
    'live-edge',
    '#9a835d',
    'wood',
    'four',
    [light('lantern', 145, 215, 0.24)],
  ],
  'forest-cabin': [
    'logs',
    '#302b22',
    '#877052',
    '#604c36',
    'live-edge',
    '#886342',
    'wood',
    'trestle',
    [light('lantern', 660, 218, 0.28)],
  ],
  'forest-fireflies': [
    'plaster',
    '#1e2a27',
    '#557666',
    '#3e4638',
    'round',
    '#596f5b',
    'wood',
    'pedestal',
    [light('sconce', 47, 325, 0.2), light('sconce', 753, 325, 0.2)],
  ],
  'forest-bamboo': [
    'lattice',
    '#29362a',
    '#8c9470',
    '#665b3c',
    'oval',
    '#a09361',
    'bamboo',
    'four',
    [light('paper', 600, 176, 0.24)],
  ],
  'forest-autumn': [
    'slats',
    '#3a3025',
    '#a28a62',
    '#705239',
    'live-edge',
    '#a78052',
    'wood',
    'trestle',
    [light('rattan', 400, 186, 0.24)],
  ],
  'water-moon': [
    'stone',
    '#414943',
    '#a5a58c',
    '#706959',
    'stone',
    '#a0a695',
    'stone',
    'slab',
    [light('rope', 135, 216, 0.25, 125), light('rope', 665, 216, 0.25, 125)],
  ],
  'water-lake': [
    'slats',
    '#3b4943',
    '#a0aa8e',
    '#6c6b53',
    'round',
    '#9b9b7c',
    'wood',
    'pedestal',
    [
      light('string', 160, 168, 0.17, 145),
      light('string', 400, 190, 0.17, 145),
      light('string', 640, 168, 0.17, 145),
    ],
  ],
  'water-stream': [
    'stone',
    '#2c3e39',
    '#7c9181',
    '#585d49',
    'stone',
    '#87998c',
    'stone',
    'slab',
    [light('sconce', 42, 325, 0.26), light('sconce', 758, 325, 0.26)],
  ],
  'water-harbor': [
    'brick',
    '#27343a',
    '#7b8b88',
    '#4b504b',
    'counter',
    '#5d7075',
    'metal',
    'trestle',
    [light('cage', 620, 178, 0.24)],
  ],
  'water-falls': [
    'plaster',
    '#34443d',
    '#9aa38b',
    '#686852',
    'oval',
    '#a0a68d',
    'stone',
    'four',
    [light('sconce', 40, 300, 0.25), light('sconce', 760, 300, 0.25)],
  ],
  'travel-train': [
    'panels',
    '#303231',
    '#9a927a',
    '#625745',
    'fold-down',
    '#897154',
    'wood',
    'brackets',
    [light('strip', 400, 112, 0.2)],
  ],
  'travel-tent': [
    'canvas',
    '#35392c',
    '#a39772',
    '#6e5a3d',
    'counter',
    '#9b815c',
    'linen',
    'trestle',
    [light('lantern', 400, 178, 0.26)],
  ],
  'travel-van': [
    'metal',
    '#303934',
    '#8a9989',
    '#5b6252',
    'fold-down',
    '#9b9e88',
    'metal',
    'brackets',
    [light('strip', 400, 105, 0.22)],
  ],
  'travel-lodge': [
    'logs',
    '#332a22',
    '#967a55',
    '#61472f',
    'writing',
    '#8e6542',
    'wood',
    'trestle',
    [light('cage', 165, 192, 0.28), light('sconce', 760, 325, 0.25)],
  ],
  'travel-stars': [
    'plaster',
    '#292c34',
    '#8d91a0',
    '#4d4e4c',
    'oval',
    '#727b80',
    'wood',
    'four',
    [light('sconce', 45, 320, 0.2)],
  ],
  'garden-hanok': [
    'lattice',
    '#303426',
    '#a89d76',
    '#766545',
    'tea',
    '#9a875f',
    'wood',
    'four',
    [light('paper', 600, 168, 0.27)],
  ],
  'garden-court': [
    'stone',
    '#3e4540',
    '#a2a58e',
    '#77745d',
    'round',
    '#a9ac94',
    'stone',
    'pedestal',
    [light('sconce', 43, 300, 0.25), light('sconce', 757, 300, 0.25)],
  ],
  'garden-glass': [
    'plaster',
    '#304238',
    '#9eac8a',
    '#6b6b52',
    'glass',
    '#90a38b',
    'glass',
    'four',
    [light('opal', 400, 173, 0.24)],
  ],
  'garden-lotus': [
    'slats',
    '#2f423b',
    '#8d9f88',
    '#746c4e',
    'tea',
    '#a39d76',
    'bamboo',
    'four',
    [light('paper', 195, 186, 0.26)],
  ],
  'garden-snow': [
    'plaster',
    '#444a43',
    '#bcc0a9',
    '#777a68',
    'oval',
    '#acb1a0',
    'wood',
    'pedestal',
    [light('floor', 670, 597, 0.28)],
  ],
  'study-linen': [
    'plaster',
    '#4a493d',
    '#b4ab8a',
    '#807052',
    'writing',
    '#b29b74',
    'linen',
    'four',
    [light('desk', 653, 466, 0.25, 0, 665)],
  ],
  'forest-pine-fireflies': [
    'logs',
    '#263d31',
    '#7d9478',
    '#64563e',
    'live-edge',
    '#8c845f',
    'wood',
    'four',
    [light('lantern', 144, 211, 0.24)],
  ],
  'study-granite': [
    'stone',
    '#3c4945',
    '#a1a795',
    '#737568',
    'stone',
    '#9b9f94',
    'stone',
    'slab',
    [light('track', 200, 152, 0.21), light('track', 610, 152, 0.21)],
  ],
  'water-harbor-deep': [
    'brick',
    '#223d44',
    '#678f92',
    '#435c5b',
    'counter',
    '#4e7478',
    'metal',
    'trestle',
    [light('track', 200, 145, 0.23), light('track', 630, 145, 0.23)],
  ],
  'water-velvet-tide': [
    'slats',
    '#3d4944',
    '#a7ad94',
    '#77755c',
    'live-edge',
    '#b1ab8d',
    'wood',
    'four',
    [light('floor', 685, 610, 0.27, 125)],
  ],
  'cafe-barista-long-table': [
    'brick',
    '#2b2921',
    '#9c825e',
    '#5e4d36',
    'counter',
    '#8a6947',
    'wood',
    'four',
    [light('brass', 165, 192, 0.24), light('brass', 650, 192, 0.24)],
  ],
  'cafe-rain-dome': [
    'stone',
    '#5b5b4b',
    '#c2b28d',
    '#665b41',
    'oval',
    '#91714e',
    'wood',
    'four',
    [light('brass', 400, 303, 0.3)],
  ],
  'cafe-neon-night': [
    'brick',
    '#202d36',
    '#637982',
    '#41494a',
    'counter',
    '#52666b',
    'metal',
    'trestle',
    [light('track', 210, 142, 0.21), light('track', 610, 142, 0.21)],
  ],
}
export const SCENE_INTERIORS: Record<string, SceneInterior> = Object.fromEntries(
  BACKGROUNDS.map((room) => {
    const [material, color, detail, floor, shape, surface, tableMaterial, support, lights] =
      rows[room.id]
    return [
      room.id,
      {
        id: room.id,
        wall: { material, color, detail },
        trim: detail,
        floor,
        table: { shape, surface, edge: color, material: tableMaterial, support },
        lights,
        enclosure: ['water-moon', 'water-lake', 'water-velvet-tide'].includes(room.id)
          ? 'terrace'
          : 'room',
      } satisfies SceneInterior,
    ]
  }),
)
export function getSceneInterior(sceneOrId: number | string): SceneInterior {
  return SCENE_INTERIORS[resolveBackgroundId(sceneOrId)]
}
export function validateSceneInteriors(): string[] {
  const errors: string[] = validateSceneCatalogKeys(rows, 'interior rows')
  errors.push(...validateSceneCatalogKeys(SCENE_INTERIORS, 'interiors'))
  for (const room of BACKGROUNDS) {
    const config = SCENE_INTERIORS[room.id]
    if (!config || !config.lights.length) {
      errors.push(room.id)
      continue
    }
    for (const light of config.lights)
      if (
        ![light.x, light.y, light.glow].every(Number.isFinite) ||
        light.x < 0 ||
        light.x > 800 ||
        light.y < 0 ||
        light.y > 820 ||
        light.glow <= 0 ||
        light.glow > 1
      )
        errors.push(`${room.id}: light`)
  }
  return errors
}
