import type { BackgroundCategory } from './backgrounds.ts'

/** 가을 연출 원본. 기존 공간의 ID·카테고리·인물·동물 동선은 유지한다.
 * 장소 6개 그룹마다 1~2개 공간에만 적용한다. 원본 그림과 PC/모바일 확장부가
 * 같은 팔레트를 읽으며, 나머지 공간에는 계절 효과를 자동 적용하지 않는다. */
export type AutumnMotif =
  | 'ginkgo-alley'
  | 'persimmon-linen'
  | 'maple-forest'
  | 'maple-lake'
  | 'birch-train'
  | 'oak-camper'
  | 'maple-hanok'
  | 'ginkgo-courtyard'

export interface AutumnSpaceConfig {
  id: string
  scene: number
  category: BackgroundCategory
  season: 'autumn'
  motif: AutumnMotif
  palette: {
    sky: string
    horizon: string
    distant: string
    foliage: readonly [string, string, string, string]
    bark: string
    ground: string
    water: string
  }
}

export const AUTUMN_SPACES: readonly AutumnSpaceConfig[] = [
  {
    id: 'cafe-alley',
    scene: 1,
    category: 'cafe',
    season: 'autumn',
    motif: 'ginkgo-alley',
    palette: {
      sky: '#243137',
      horizon: '#645c48',
      distant: '#4c4938',
      foliage: ['#bc9a49', '#a2843d', '#7c693b', '#cfb16a'],
      bark: '#574a3a',
      ground: '#4b4637',
      water: '#5e665c',
    },
  },
  {
    id: 'study-linen',
    scene: 30,
    category: 'study',
    season: 'autumn',
    motif: 'persimmon-linen',
    palette: {
      sky: '#293236',
      horizon: '#756b55',
      distant: '#5b5846',
      foliage: ['#b77545', '#905f3e', '#73623f', '#c19459'],
      bark: '#5c4938',
      ground: '#4f4838',
      water: '#676c5c',
    },
  },
  {
    id: 'forest-autumn',
    scene: 14,
    category: 'forest',
    season: 'autumn',
    motif: 'maple-forest',
    palette: {
      sky: '#253239',
      horizon: '#675742',
      distant: '#59503d',
      foliage: ['#a35b3e', '#bd8450', '#80513c', '#c29c59'],
      bark: '#514033',
      ground: '#584833',
      water: '#66665a',
    },
  },
  {
    id: 'premium-autumn-lake',
    scene: 41,
    category: 'water',
    season: 'autumn',
    motif: 'maple-lake',
    palette: {
      sky: '#26363d',
      horizon: '#7b7056',
      distant: '#655841',
      foliage: ['#ba7544', '#a14d39', '#ce9c53', '#79503e'],
      bark: '#594531',
      ground: '#685438',
      water: '#435b5c',
    },
  },
  {
    id: 'travel-train',
    scene: 20,
    category: 'travel',
    season: 'autumn',
    motif: 'birch-train',
    palette: {
      sky: '#26353d',
      horizon: '#79715a',
      distant: '#615c49',
      foliage: ['#bea254', '#9f8844', '#7d7040', '#d0b96d'],
      bark: '#a39c7e',
      ground: '#60533e',
      water: '#4e6665',
    },
  },
  {
    id: 'travel-van',
    scene: 22,
    category: 'travel',
    season: 'autumn',
    motif: 'oak-camper',
    palette: {
      sky: '#253139',
      horizon: '#6e6148',
      distant: '#514e3b',
      foliage: ['#ad7944', '#8f5938', '#8c8548', '#c2a063'],
      bark: '#554532',
      ground: '#5d5038',
      water: '#606b5b',
    },
  },
  {
    id: 'garden-hanok',
    scene: 25,
    category: 'garden',
    season: 'autumn',
    motif: 'maple-hanok',
    palette: {
      sky: '#29363a',
      horizon: '#74614c',
      distant: '#61533f',
      foliage: ['#aa5b43', '#c3854e', '#80513e', '#b79a5c'],
      bark: '#5c4435',
      ground: '#65563d',
      water: '#647264',
    },
  },
  {
    id: 'garden-court',
    scene: 26,
    category: 'garden',
    season: 'autumn',
    motif: 'ginkgo-courtyard',
    palette: {
      sky: '#2c3738',
      horizon: '#79745a',
      distant: '#625e47',
      foliage: ['#c0a252', '#a38b45', '#7d733f', '#d2b973'],
      bark: '#62513a',
      ground: '#6a6045',
      water: '#697262',
    },
  },
]

export function getAutumnSpace(idOrScene: string | number): AutumnSpaceConfig | undefined {
  return AUTUMN_SPACES.find((space) =>
    typeof idOrScene === 'number' ? space.scene === idOrScene : space.id === idOrScene,
  )
}
