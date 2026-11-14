import { BACKGROUNDS, resolveBackgroundId, validateSceneCatalogKeys } from './backgrounds.ts'
/** 창문/테라스 형상 원본. 각 공간 ID에 창문 형상을 명시한다. 숫자 API는 그림 선택자를 ID로 해석한다.
 * 그림·비·효과 클리핑이 같은 개구부를 사용한다. 테라스 변경 시 sceneInterior.enclosure와 유리 효과도 맞춘다. */
export type WindowKind =
  | 'original'
  | 'arch'
  | 'panorama'
  | 'bay'
  | 'twin-arch'
  | 'greenhouse'
  | 'lattice'
  | 'attic'
  | 'round'
  | 'train'
  | 'stone'
  | 'dome'
  | 'terrace'
export type SceneArchitecture = {
  kind: WindowKind
  opening: string
  frames: string
  frameWidth: number
}
const rounded = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`
const arch = 'M70 580V275Q70 65 400 65T730 275V580Z'
const twin = 'M90 580V275Q90 105 245 105T390 275V580Z M410 580V275Q410 105 555 105T710 275V580Z'
const presets: Record<WindowKind, SceneArchitecture> = {
  terrace: { kind: 'terrace', opening: 'M0 142H800V562H0Z', frames: '', frameWidth: 18 },
  original: {
    kind: 'original',
    opening: 'M56 0H690V598H56Z',
    frames: 'M362 0V625',
    frameWidth: 16,
  },
  arch: { kind: 'arch', opening: arch, frames: 'M400 65V580', frameWidth: 11 },
  panorama: {
    kind: 'panorama',
    opening: rounded(36, 110, 728, 470, 24),
    frames: 'M265 110V580M535 110V580',
    frameWidth: 9,
  },
  bay: {
    kind: 'bay',
    opening: 'M110 95H690L755 580H45Z',
    frames: 'M285 95L265 580M515 95L535 580',
    frameWidth: 11,
  },
  'twin-arch': { kind: 'twin-arch', opening: twin, frames: '', frameWidth: 12 },
  greenhouse: {
    kind: 'greenhouse',
    opening: 'M65 580V220Q400-100 735 220V580Z',
    frames: 'M65 300H735M120 165H680M240 90V580M400 30V580M560 90V580',
    frameWidth: 10,
  },
  lattice: {
    kind: 'lattice',
    opening: rounded(75, 100, 650, 480, 10),
    frames: 'M240 100V580M400 100V580M560 100V580M75 260H725M75 420H725',
    frameWidth: 9,
  },
  attic: {
    kind: 'attic',
    opening: 'M160 70L650 50 720 460H110Z',
    frames: 'M390 60L415 460M130 285L685 265',
    frameWidth: 15,
  },
  round: {
    kind: 'round',
    opening: 'M618 300A218 218 0 1 1 182 300A218 218 0 1 1 618 300Z',
    frames: 'M182 300H618M400 82V518',
    frameWidth: 12,
  },
  train: {
    kind: 'train',
    opening: rounded(80, 155, 640, 400, 45),
    frames: 'M400 155V555',
    frameWidth: 13,
  },
  stone: { kind: 'stone', opening: 'M172 64H628V580H172Z', frames: 'M400 64V580', frameWidth: 12 },
  dome: {
    kind: 'dome',
    opening: 'M70 620V390Q70 120 400 120T730 390V620Z',
    frames: 'M400 121V620M154 620Q95 320 400 122M646 620Q705 320 400 122',
    frameWidth: 11,
  },
}
const kinds: Record<string, WindowKind> = {
  'cafe-rain': 'original',
  'cafe-alley': 'arch',
  'cafe-greenhouse': 'greenhouse',
  'cafe-rooftop': 'panorama',
  'cafe-seaside': 'bay',
  'study-fire': 'arch',
  'study-attic': 'attic',
  'study-library': 'twin-arch',
  'study-city': 'panorama',
  'study-moon': 'round',
  'forest-mist': 'panorama',
  'forest-cabin': 'arch',
  'forest-fireflies': 'round',
  'forest-bamboo': 'lattice',
  'forest-autumn': 'bay',
  'water-moon': 'panorama',
  'water-lake': 'bay',
  'water-stream': 'arch',
  'water-harbor': 'panorama',
  'water-falls': 'arch',
  'travel-train': 'train',
  'travel-tent': 'bay',
  'travel-van': 'train',
  'travel-lodge': 'arch',
  'travel-stars': 'round',
  'garden-hanok': 'lattice',
  'garden-court': 'twin-arch',
  'garden-glass': 'greenhouse',
  'garden-lotus': 'panorama',
  'garden-snow': 'bay',
  'study-linen': 'stone',
  'forest-pine-fireflies': 'arch',
  'study-granite': 'stone',
  'water-harbor-deep': 'panorama',
  'water-velvet-tide': 'bay',
  'cafe-barista-long-table': 'panorama',
  'cafe-rain-dome': 'dome',
  'cafe-neon-night': 'panorama',
}
export function getSceneArchitecture(scene: number | string): SceneArchitecture {
  const id = resolveBackgroundId(scene)
  if (id === 'forest-fireflies')
    return {
      kind: 'round',
      opening: 'M685 305A285 285 0 1 1 115 305A285 285 0 1 1 685 305Z',
      frames: 'M115 305H685M400 20V590',
      frameWidth: 12,
    }
  if (['water-moon', 'water-lake', 'water-velvet-tide'].includes(id)) return presets.terrace
  if (id === 'study-linen')
    return { ...presets.stone, kind: 'stone', opening: 'M154 64H646V580H154Z' }
  if (id === 'cafe-barista-long-table')
    return {
      kind: 'panorama',
      opening: 'M38 70H762V535H38Z',
      frames: 'M266 70V535M536 70V535',
      frameWidth: 12,
    }
  if (id === 'cafe-neon-night')
    return {
      ...presets.panorama,
      opening: rounded(38, 62, 724, 518, 20),
      frames: 'M280 62V580M525 62V580',
    }
  return presets[kinds[id] ?? 'panorama']
}

export function validateSceneArchitecture(): string[] {
  const errors = validateSceneCatalogKeys(kinds, 'architecture')
  for (const room of BACKGROUNDS) {
    const config = getSceneArchitecture(room.id)
    if (!config.opening || !Number.isFinite(config.frameWidth) || config.frameWidth <= 0)
      errors.push(`${room.id}: architecture`)
  }
  return errors
}
