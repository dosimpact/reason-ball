/** 파생 효과 카탈로그. 원본 설정은 backgrounds/sceneInterior/sceneArchitecture/sceneCast/
 * sceneAnimals/scenePlants/sceneDetails에 있다. 광원·고양이·식물 위치를 여기서 별도로 복제하지 않는다.
 * validate:scenes에서 검사·JSON 내보내기를 실행하며, 전체 관리 안내는 backgrounds.ts 상단에 있다. */
import { getScenePlants, validateScenePlants, type ScenePlant } from './scenePlants.ts'
import { getSceneAnimals, getIndoorCatAnchor, validateSceneAnimals } from './sceneAnimals.ts'
import { getSceneInterior, validateSceneInteriors, type SceneInterior } from './sceneInterior.ts'
import {
  getSceneArchitecture,
  validateSceneArchitecture,
  type SceneArchitecture,
} from './sceneArchitecture.ts'
import { SCENE_DETAILS, validateSceneDetails, type SceneDetail } from './sceneDetails.ts'
import { getSceneSeats, getSeatGeometry, validateSceneCast } from './sceneCast.ts'
import {
  BACKGROUNDS,
  DEFAULT_BACKGROUND_ID,
  validateBackgrounds,
  validateSceneCatalogKeys,
} from './backgrounds.ts'
export type Anchor = { x: number; y: number; scale?: number }
export type SceneEffectConfig = {
  id: string
  assetPath: string
  plants: ScenePlant[]
  architecture: SceneArchitecture
  interior: SceneInterior
  details: SceneDetail[]
  timing: { yawnDelay: [number, number]; yawnDuration: number }
  lamps: Anchor[]
  sparkles: Anchor[]
  steam: Anchor[]
  cat: (Anchor & { coat: string }) | null
  weather: {
    base: 'rain' | 'heavy'
    storm: boolean
    thunderAudio: false
    gustDelay: [number, number]
    gustDuration: [number, number]
    lightningDelay: [number, number]
  }
}
export const DEFAULT_EFFECT_TIMING = {
  yawnDelay: [35000, 90000] as [number, number],
  yawnDuration: 2400,
}
const glowIds = new Set([
  'cafe-rain',
  'cafe-alley',
  'study-fire',
  'study-attic',
  'study-moon',
  'forest-cabin',
  'travel-lodge',
  'travel-tent',
  'study-linen',
  'forest-pine-fireflies',
  'water-harbor-deep',
  'water-velvet-tide',
  'cafe-barista-long-table',
  'cafe-rain-dome',
  'cafe-neon-night',
])
const stormIds = new Set([
  'cafe-rain-dome',
  'water-harbor-deep',
  'water-velvet-tide',
  'cafe-seaside',
  'water-harbor',
  'travel-lodge',
])
/** Coordinates use the same 800×820 artwork space as both SVG and raster scenes. */
export const SCENE_EFFECTS: Record<string, SceneEffectConfig> = Object.fromEntries(
  BACKGROUNDS.map((room) => {
    const interior = getSceneInterior(room.id)
    const cat = getIndoorCatAnchor(room)
    const special = room.id === 'cafe-barista-long-table' || room.id === 'cafe-rain-dome'
    const castRoom =
      room.id === 'cafe-barista-long-table' ? { ...room, companions: 2 as const } : room
    const cupSteam = getSceneSeats(castRoom)
      .filter((seat) => seat.pose === 'coffee')
      .map((seat) => {
        const geometry = getSeatGeometry(castRoom, seat, !(room.id === 'cafe-rain' || special))
        return {
          x: seat.x + 16 * geometry.scale * (seat.facing ?? 1),
          y: geometry.y - 102 * geometry.scale,
          scale: 0.45,
        }
      })
    return [
      room.id,
      {
        id: room.id,
        plants: getScenePlants(room),
        interior,
        architecture: getSceneArchitecture(room.id),
        details: SCENE_DETAILS[room.id],
        timing: { ...DEFAULT_EFFECT_TIMING },
        assetPath: `/backgrounds/rear/fullscreen/${room.id}.png`,
        lamps: !glowIds.has(room.id)
          ? []
          : interior.lights.map((light) => ({ x: light.x, y: light.y })),
        sparkles: ['cafe-rain', 'cafe-rooftop', 'garden-glass', 'cafe-neon-night'].includes(room.id)
          ? [{ x: interior.lights[0].x + 14, y: interior.lights[0].y }]
          : [],
        steam: [
          ...cupSteam,
          ...(room.id === 'cafe-rain'
            ? [{ x: 484, y: 614 }]
            : special
              ? [
                  {
                    x: room.id === 'cafe-barista-long-table' ? 407 : 402,
                    y: room.id === 'cafe-barista-long-table' ? 637 : 631,
                  },
                ]
              : room.companions === 0
                ? [{ x: 535, y: 608 }]
                : []),
        ],
        cat: cat
          ? {
              ...cat,
              coat: getSceneAnimals(room).find(
                (animal) => animal.habitat === 'indoor' && animal.species === 'cat',
              )!.coat,
            }
          : null,
        weather: {
          base: room.id === 'cafe-rain-dome' ? 'heavy' : 'rain',
          thunderAudio: false,
          storm: stormIds.has(room.id),
          gustDelay: [45000, 100000],
          gustDuration: [8000, 14000],
          lightningDelay: [90000, 180000],
        },
      } satisfies SceneEffectConfig,
    ]
  }),
)
export function getSceneEffects(id: string) {
  return SCENE_EFFECTS[id] ?? SCENE_EFFECTS[DEFAULT_BACKGROUND_ID]
}
export function validateSceneEffects(configs = SCENE_EFFECTS): string[] {
  const errors: string[] = validateSceneDetails(
    Object.fromEntries(Object.entries(configs).map(([id, config]) => [id, config.details])),
  )
  errors.push(
    ...validateBackgrounds(),
    ...validateSceneCatalogKeys(configs, 'effects'),
    ...validateSceneInteriors(),
    ...validateScenePlants(),
    ...validateSceneAnimals(),
    ...validateSceneCast(),
    ...validateSceneArchitecture(),
  )
  if (Object.keys(configs).length !== BACKGROUNDS.length) errors.push('catalog coverage')
  for (const id of [...glowIds, ...stormIds])
    if (!BACKGROUNDS.some((room) => room.id === id)) errors.push(`unknown effect ID: ${id}`)
  for (const room of BACKGROUNDS) {
    const config = configs[room.id]
    if (
      !config ||
      config.id !== room.id ||
      config.assetPath !== `/backgrounds/rear/fullscreen/${room.id}.png`
    ) {
      errors.push(room.id)
      continue
    }
    const architecture = getSceneArchitecture(room.id)
    if (
      config.architecture.opening !== architecture.opening ||
      config.architecture.frames !== architecture.frames ||
      config.architecture.kind !== architecture.kind ||
      !Number.isFinite(config.architecture.frameWidth) ||
      config.architecture.frameWidth <= 0
    )
      errors.push(`${room.id}: window architecture`)
    if (!Number.isFinite(config.timing.yawnDuration) || config.timing.yawnDuration <= 0)
      errors.push(`${room.id}: yawn duration`)
    if (
      !['rain', 'heavy'].includes(config.weather.base) ||
      typeof config.weather.storm !== 'boolean' ||
      config.weather.thunderAudio !== false
    )
      errors.push(`${room.id}: weather`)
    for (const point of [
      ...config.lamps,
      ...config.sparkles,
      ...config.steam,
      ...(config.cat ? [config.cat] : []),
    ])
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.x > 800 ||
        point.y < 0 ||
        point.y > 820
      )
        errors.push(`${room.id}: anchor`)
    for (const range of [
      config.timing.yawnDelay,
      config.weather.gustDelay,
      config.weather.gustDuration,
      config.weather.lightningDelay,
    ])
      if (
        range.length !== 2 ||
        !range.every(Number.isFinite) ||
        range[0] <= 0 ||
        range[1] < range[0]
      )
        errors.push(`${room.id}: timing`)
  }
  return errors
}
