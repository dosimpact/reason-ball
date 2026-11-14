import { PREMIUM_SPACES } from './premiumSpaces.ts'

/**
 * Pixi 런타임: scripts/export-pixi-scenes.mjs → public/backgrounds/pixi/<id>/manifest.json.
 * SVG는 보존한 저작 원본이며 변경 후 pnpm --filter @rain-room/web export:pixi 필수.
 * validate:pixi에서 자산 및 원본 최신성을 확인한다. ?renderer=legacy로 기존 화면 비교 가능.
 *
 * 기본 38개 공간 카탈로그 — 기존 그림과 효과 설정의 기준이다.
 * 프리미엄 30개 메타데이터는 premiumSpaces.ts, 전체 선택 목록은 ALL_BACKGROUNDS를 사용한다.
 * 프리미엄 에셋만 갱신하려면 scripts/render-premium-scenes.mjs를 실행한다.
 *
 * 관련 설정(같은 디렉터리):
 * - sceneArchitecture.ts: 창문·개방형 테라스의 개구부와 프레임, 비 클리핑.
 * - sceneInterior.ts: 벽 마감·바닥·책상·조명 본체와 글로우 위치.
 * - sceneCast.ts: 인물 배치·자세·외형; sceneAnimals.ts: 실내/실외 동물·하품 위치.
 * - scenePlants.ts: 식물·화분·받침/선반/행잉 위치와 비 가림 실루엣.
 * - sceneDetails.ts: 공간별 작은 움직임; neonSigns.ts: 도심 간판과 외벽 원근.
 * - sceneAutumn.ts: 6개 장소 그룹에 지정한 가을 공간 8곳의 모티프·원경 팔레트.
 * - sceneEffects.ts: 위 설정 중 효과에 필요한 정보·날씨·타이밍·에셋 경로를 조합/검증한다.
 *
 * 변경 규칙:
 * 1. id는 저장된 사용자 선택과 /backgrounds/<id>.webp의 키다. 기존 id/scene은 유지한다.
 * 2. 각 공간은 안정적인 id로 설정을 연결한다. 표시 순서는 자유롭게 바꿀 수 있다.
 *    scene은 기존 SVG 그림 분기를 위한 명시적 선택자이며 배열 위치에서 계산하지 않는다.
 * 3. 일부 그림은 ../ui/Cafe.tsx, SpecialCafeScenes.tsx, SongInspiredArt.tsx 등에 직접 구현되어
 *    있다. 메타데이터만 추가해도 새 그림이 자동 생성되는 구조는 아니므로 렌더 분기를 확인한다.
 * 4. 좌표는 공통 800×820 기준. 가구·손·컵·동물·식물의 접점, 광원/글로우, 비 가림을 함께 확인한다.
 * 5. 그림 변경 후(저장소 루트에서) 아래 순서로 전체화면 이미지와 검증을 갱신한다:
 *    pnpm --filter @rain-room/web exec node scripts/render-fullscreen-backgrounds.mjs
 *    pnpm --filter @rain-room/web validate:scenes
 *    pnpm --filter @rain-room/web exec node scripts/render-immersion.mjs
 *    pnpm --filter @rain-room/web test
 *    pnpm --filter @rain-room/web typecheck
 *    pnpm --filter @rain-room/web lint
 *    pnpm --filter @rain-room/web build
 *    확대/모바일/래스터 PNG를 검토한다. 정적 렌더는 실제 브라우저 애니메이션 검증과 구분한다.
 *
 * validate:scenes는 효과 설정과 WebP 존재 여부를 검사하고 artifacts/scene-effects/catalog.json을
 * 생성한다. 이 JSON은 파생된 효과 목록이며, 전체 인물/동물/그림 소스의 원본 카탈로그가 아니다.
 * 사람 중심의 변경 이력/기획은 aidlc/spaces/default/knowledge/documents/business-book.md를 참고한다.
 */
export const BACKGROUND_CATEGORIES = [
  { id: 'cafe', name: '함께하는 카페' },
  { id: 'study', name: '조용한 서재' },
  { id: 'forest', name: '숲 전망실' },
  { id: 'water', name: '물가 전망실' },
  { id: 'travel', name: '여행의 방' },
  { id: 'garden', name: '정원 전망실' },
] as const

export type BackgroundCategory = (typeof BACKGROUND_CATEGORIES)[number]['id']
export type CompanionCount = 0 | 1 | 2 | 3
export interface Background {
  id: string
  name: string
  category: BackgroundCategory
  description: string
  scene: number
  companions: CompanionCount
}

export const BACKGROUNDS: Background[] = [
  {
    id: 'cafe-rain',
    name: '빗소리 창가 라운지',
    description: '비 내리는 창밖을 보며 이웃들과 조용히 몰입하는 따뜻한 카페',
    category: 'cafe',
    companions: 2,
    scene: 0,
  },
  {
    id: 'cafe-alley',
    name: '은행잎 골목 북카페',
    description:
      '황금빛 은행나무와 젖은 낙엽 골목 너머, 빗소리와 따뜻한 조명 아래 함께 읽는 북카페',
    category: 'cafe',
    companions: 3,
    scene: 1,
  },
  {
    id: 'cafe-greenhouse',
    name: '비 내리는 온실 카페',
    description: '유리 천장에 흐르는 빗방울 아래 함께 공부하는 초록빛 온실 카페',
    category: 'cafe',
    companions: 3,
    scene: 2,
  },
  {
    id: 'cafe-rooftop',
    name: '도심 위 코워킹 카페',
    description: '비 오는 도시를 내려다보며 나란히 작업하는 포근한 옥상 라운지',
    category: 'cafe',
    companions: 3,
    scene: 3,
  },
  {
    id: 'cafe-seaside',
    name: '바다 창가 커피 바',
    description: '빗물 어린 바다 창 앞에서 둘이 말없이 집중하는 따뜻한 커피 바',
    category: 'cafe',
    companions: 2,
    scene: 4,
  },
  {
    id: 'study-fire',
    name: '벽난로 공용 서재',
    description: '차가운 비가 내리는 밤, 벽난로 곁에서 함께 읽는 포근한 서재',
    category: 'study',
    companions: 2,
    scene: 5,
  },
  {
    id: 'study-attic',
    name: '빗소리 다락 서재',
    description: '지붕 창에 비가 두드리는 고요하고 아늑한 나만의 다락 작업실',
    category: 'study',
    companions: 0,
    scene: 6,
  },
  {
    id: 'study-library',
    name: '함께 읽는 심야 도서관',
    description: '창밖의 비를 배경으로 이웃들이 각자의 책에 몰입하는 따뜻한 도서관',
    category: 'study',
    companions: 3,
    scene: 7,
  },
  {
    id: 'study-city',
    name: '도시 불빛 워크룸',
    description: '비에 번지는 도시 불빛 앞에서 나란히 일하는 조용한 공동 작업실',
    category: 'study',
    companions: 2,
    scene: 8,
  },
  {
    id: 'study-moon',
    name: '달빛 원형 서재',
    description: '비구름 사이 달빛과 스탠드 불빛이 머무는 포근한 원형 서재',
    category: 'study',
    companions: 0,
    scene: 9,
  },
  {
    id: 'forest-mist',
    name: '소나무 숲 전망 라운지',
    description: '비안개 낀 소나무 숲을 큰 창으로 바라보는 따뜻한 실내 라운지',
    category: 'forest',
    companions: 0,
    scene: 10,
  },
  {
    id: 'forest-cabin',
    name: '숲속 오두막 작업실',
    description: '빗속 오두막 안, 장작불과 나무 향이 감도는 아늑한 작업실',
    category: 'forest',
    companions: 1,
    scene: 11,
  },
  {
    id: 'forest-fireflies',
    name: '반딧불 숲 창가',
    description: '비에 젖은 반딧불 숲을 바라보며 조용히 머무는 포근한 창가 자리',
    category: 'forest',
    companions: 0,
    scene: 12,
  },
  {
    id: 'forest-bamboo',
    name: '대나무 정원 티룸',
    description: '빗방울 맺힌 대나무 정원과 따뜻한 차가 있는 실내 티룸',
    category: 'forest',
    companions: 0,
    scene: 13,
  },
  {
    id: 'forest-autumn',
    name: '가을 숲 독서실',
    description: '붉은 단풍과 황금빛 숲길에 비가 내리는, 깊은 가을빛을 품은 따뜻한 독서실',
    category: 'forest',
    companions: 0,
    scene: 14,
  },
  {
    id: 'water-moon',
    name: '달빛 바다 지붕 테라스',
    description: '비 내리는 바다 앞, 지붕과 기둥 아래 유리 없이 탁 트인 달빛 테라스',
    category: 'water',
    companions: 0,
    scene: 15,
  },
  {
    id: 'water-lake',
    name: '호숫가 오픈 테라스',
    description: '비 오는 호수의 물결을 유리 없이 바라보는 지붕 아래 따뜻한 오픈 테라스',
    category: 'water',
    companions: 0,
    scene: 16,
  },
  {
    id: 'water-stream',
    name: '계곡 소리 라운지',
    description: '빗물로 깊어진 계곡을 유리창 너머로 품은 아늑한 라운지',
    category: 'water',
    companions: 0,
    scene: 17,
  },
  {
    id: 'water-harbor',
    name: '항구 불빛 서재',
    description: '비에 번지는 항구의 불빛과 낮은 스탠드가 어우러진 실내 서재',
    category: 'water',
    companions: 0,
    scene: 18,
  },
  {
    id: 'water-falls',
    name: '폭포 전망 휴게실',
    description: '빗속 폭포가 보이는 큰 창과 따뜻한 나무 테이블이 있는 휴게실',
    category: 'water',
    companions: 0,
    scene: 19,
  },
  {
    id: 'travel-train',
    name: '가을 협곡 열차 코치',
    description: '비 내리는 황금빛 자작나무 협곡과 푸른 강을 바라보며 함께 집중하는 가을 열차',
    category: 'travel',
    companions: 2,
    scene: 20,
  },
  {
    id: 'travel-tent',
    name: '캠핑 텐트 워크룸',
    description: '빗소리를 막아 주는 천막 안, 랜턴 아래 차분한 작업 자리',
    category: 'travel',
    companions: 0,
    scene: 21,
  },
  {
    id: 'travel-van',
    name: '단풍길 캠핑카 데스크',
    description: '비에 젖은 참나무 단풍과 낙엽 길 옆에 멈춘, 랜턴이 따뜻한 가을 캠핑카 작업실',
    category: 'travel',
    companions: 1,
    scene: 22,
  },
  {
    id: 'travel-lodge',
    name: '겨울 산장 공용실',
    description: '눈비 내리는 산을 보며 함께 책을 읽는 따뜻한 산장 실내',
    category: 'travel',
    companions: 2,
    scene: 23,
  },
  {
    id: 'travel-stars',
    name: '별빛 전망대 서재',
    description: '비구름 사이 별을 기다리며 머무는 조용하고 아늑한 전망대 서재',
    category: 'travel',
    companions: 0,
    scene: 24,
  },
  {
    id: 'garden-hanok',
    name: '단풍 마루 작업실',
    description: '비 내리는 붉은 단풍 마당과 젖은 돌길을 처마 아래에서 바라보는 따뜻한 한옥 마루',
    category: 'garden',
    companions: 2,
    scene: 25,
  },
  {
    id: 'garden-court',
    name: '은행잎 중정 라운지',
    description: '황금빛 은행잎과 가을 국화가 있는 빗속 중정을 아치 창 너머로 품은 포근한 라운지',
    category: 'garden',
    companions: 0,
    scene: 26,
  },
  {
    id: 'garden-glass',
    name: '유리 온실 워크룸',
    description: '유리 지붕 위 빗소리와 초록 잎 사이에서 함께 집중하는 온실',
    category: 'garden',
    companions: 2,
    scene: 27,
  },
  {
    id: 'garden-lotus',
    name: '연못 전망 찻방',
    description: '비가 번지는 연꽃 연못을 바라보며 차를 마시는 따뜻한 실내',
    category: 'garden',
    companions: 0,
    scene: 28,
  },
  {
    id: 'garden-snow',
    name: '설경 정원 서재',
    description: '눈 섞인 비가 내리는 정원과 낮은 조명이 어우러진 아늑한 서재',
    category: 'garden',
    companions: 0,
    scene: 29,
  },
  {
    id: 'study-linen',
    name: '가을빛 린넨 작업실',
    description:
      '비에 젖은 감나무와 구릿빛 가을 잎을 바라보며 린넨 커튼과 따뜻한 차 곁에서 집중하는 작업실',
    category: 'study',
    companions: 1,
    scene: 30,
  },
  {
    id: 'forest-pine-fireflies',
    name: '반딧불 소나무 서재',
    description: '빗방울 맺힌 창 너머 민트빛 소나무와 반딧불을 함께 바라보는 서재',
    category: 'forest',
    companions: 2,
    scene: 31,
  },
  {
    id: 'study-granite',
    name: '빗속 화강암 스튜디오',
    description: '비에 젖은 화강암 능선과 단단한 돌벽을 품은 차분한 작업 스튜디오',
    category: 'study',
    companions: 1,
    scene: 32,
  },
  {
    id: 'water-harbor-deep',
    name: '푸른 항구 작업실',
    description: '깊은 청록빛 항구와 빗속의 작은 불빛을 바라보며 함께 몰입하는 작업실',
    category: 'water',
    companions: 2,
    scene: 33,
  },
  {
    id: 'water-velvet-tide',
    name: '잔잔한 해안 포치',
    description:
      '비 오는 해안을 유리 없이 바라보며 지붕과 기둥 아래 포근한 직물 곁에서 쉬는 열린 포치',
    category: 'water',
    companions: 0,
    scene: 34,
  },
  {
    id: 'cafe-barista-long-table',
    name: '바리스타의 긴 테이블',
    description:
      '넓은 통유리 밖의 비와 커피를 내리는 바리스타 곁, 긴 테이블에서 함께 집중하는 카페',
    category: 'cafe',
    companions: 3,
    scene: 35,
  },
  {
    id: 'cafe-rain-dome',
    name: '빗속의 포근한 돔 카페',
    description: '거센 비를 막아 주는 두꺼운 돔과 아치 창 안, 따뜻한 조명 아래 함께 머무는 카페',
    category: 'cafe',
    companions: 2,
    scene: 36,
  },
  {
    id: 'cafe-neon-night',
    name: '비에 젖은 네온 카페',
    description:
      '창밖 빗물에 번지는 청록빛과 분홍빛 네온, 따뜻한 조명 아래 함께 집중하는 심야 카페',
    category: 'cafe',
    companions: 2,
    scene: 37,
  },
]

/** Original 38-room catalogs intentionally use BACKGROUNDS; selection uses all 68. */
export const ALL_BACKGROUNDS: Background[] = [...BACKGROUNDS, ...PREMIUM_SPACES]

export const DEFAULT_BACKGROUND_ID = 'cafe-rain'
const backgroundsById = new Map(ALL_BACKGROUNDS.map((background) => [background.id, background]))
const artworkIds = new Map(ALL_BACKGROUNDS.map((background) => [background.scene, background.id]))
/** Legacy numeric calls resolve the explicit artwork selector, never display-array position. */
export function resolveBackgroundId(sceneOrId: number | string): string {
  return typeof sceneOrId === 'number'
    ? (artworkIds.get(sceneOrId) ?? DEFAULT_BACKGROUND_ID)
    : backgroundsById.has(sceneOrId)
      ? sceneOrId
      : DEFAULT_BACKGROUND_ID
}
export function getBackground(id?: string): Background {
  return (
    backgroundsById.get(id ?? DEFAULT_BACKGROUND_ID) ?? backgroundsById.get(DEFAULT_BACKGROUND_ID)!
  )
}
export function getBackgroundByScene(scene: number): Background {
  return getBackground(resolveBackgroundId(scene))
}
export function validateSceneCatalogKeys(
  catalog: Record<string, unknown>,
  label: string,
  backgrounds: Background[] = BACKGROUNDS,
): string[] {
  const ids = new Set(backgrounds.map((background) => background.id))
  return [
    ...backgrounds
      .filter((background) => !Object.hasOwn(catalog, background.id))
      .map((background) => `${label}: missing ${background.id}`),
    ...Object.keys(catalog)
      .filter((id) => !ids.has(id))
      .map((id) => `${label}: unexpected ${id}`),
  ]
}
export function validateBackgrounds(backgrounds: Background[] = BACKGROUNDS): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const artwork = new Set<number>()
  for (const background of backgrounds) {
    if (ids.has(background.id)) errors.push(`duplicate background ID: ${background.id}`)
    if (artwork.has(background.scene))
      errors.push(`duplicate artwork selector: ${background.scene}`)
    if (
      !background.id ||
      !BACKGROUND_CATEGORIES.some((category) => category.id === background.category) ||
      !Number.isInteger(background.scene) ||
      background.scene < 0
    )
      errors.push(`invalid background: ${background.id}`)
    ids.add(background.id)
    artwork.add(background.scene)
  }
  if (!ids.has(DEFAULT_BACKGROUND_ID)) errors.push('missing default background')
  return errors
}
