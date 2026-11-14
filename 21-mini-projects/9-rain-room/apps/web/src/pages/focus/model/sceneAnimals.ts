/** 공간별 동물 원본. animals의 숫자 키는 backgrounds.ts의 고정 scene이다.
 * habitat로 실내/실외 레이어를 구분하고 getIndoorCatAnchor를 하품에 공유한다. 동물 이동 시 이곳에서 수정한다. */
import {
  BACKGROUNDS,
  getBackground,
  validateSceneCatalogKeys,
  type Background,
} from './backgrounds.ts'
export type AnimalSpecies =
  | 'cat'
  | 'dog'
  | 'deer'
  | 'fox'
  | 'rabbit'
  | 'squirrel'
  | 'owl'
  | 'heron'
  | 'duck'
  | 'gull'
  | 'songbird'
export type SceneAnimal = {
  species: AnimalSpecies
  habitat: 'indoor' | 'outdoor'
  x: number
  y: number
  scale: number
  coat: string
  marking?: string
  pose?: 'loaf' | 'stretched' | 'curled'
  support?: 'ground' | 'branch' | 'water' | 'post' | 'flight'
}
const cat = (coat: string, marking?: string): SceneAnimal => ({
  species: 'cat',
  habitat: 'indoor',
  x: 94,
  y: 624,
  scale: 0.9,
  coat,
  marking,
})
const dog = (coat: string, marking?: string): SceneAnimal => ({
  species: 'dog',
  habitat: 'indoor',
  x: 640,
  y: 627,
  scale: 0.88,
  coat,
  marking,
})
const wild = (
  species: AnimalSpecies,
  x: number,
  y: number,
  scale: number,
  coat: string,
  support: SceneAnimal['support'] = 'ground',
  marking?: string,
): SceneAnimal => ({ species, habitat: 'outdoor', x, y, scale, coat, support, marking })
// Explicit room casting: wildlife belongs to the landscape, domestic companions to dry indoor furniture.
const animals: Record<string, SceneAnimal[]> = {
  'cafe-rain': [
    { ...cat('#c2ab89', '#8f795d'), x: 116, y: 617 },
    { ...dog('#a88c68', '#6e5945'), x: 650, y: 610 },
  ],
  'cafe-alley': [{ ...cat('#77776e', '#ccc0a6'), pose: 'curled' }],
  'cafe-greenhouse': [cat('#b99976', '#6c5844')],
  'cafe-rooftop': [dog('#6e716b', '#b9ad92')],
  'cafe-seaside': [{ ...cat('#cfbda2', '#7c7567'), pose: 'stretched' }],
  'study-fire': [dog('#98745a', '#d0b698')],
  'study-attic': [],
  'study-library': [{ ...cat('#3d4540', '#b6a58c'), pose: 'curled' }],
  'study-city': [dog('#c6bba3', '#716b60')],
  'study-moon': [cat('#95988a', '#d5c9af')],
  'forest-mist': [wild('deer', 620, 535, 0.7, '#a58c6a', 'ground', '#dbc5a2')],
  'forest-cabin': [wild('fox', 590, 548, 0.65, '#af8056', 'ground', '#ded0af')],
  'forest-fireflies': [wild('owl', 545, 370, 0.65, '#8c8068', 'branch', '#c7b898')],
  'forest-bamboo': [wild('rabbit', 650, 540, 0.7, '#a6a896', 'ground', '#d1c8ae')],
  'forest-autumn': [wild('squirrel', 610, 490, 0.7, '#b38a62', 'branch', '#d5ba94')],
  'water-moon': [wild('gull', 550, 455, 0.7, '#c0c8bb', 'flight', '#60736d')],
  'water-lake': [wild('duck', 530, 505, 0.8, '#a58f69', 'water', '#526c58')],
  'water-stream': [wild('heron', 580, 535, 0.75, '#aeb8a8', 'ground', '#566b64')],
  'water-harbor': [wild('gull', 575, 455, 0.75, '#c9c9b4', 'post', '#6d7c72')],
  'water-falls': [wild('songbird', 580, 365, 0.7, '#73968a', 'branch', '#c1ab76')],
  'travel-train': [cat('#b3a38b', '#6b6659')],
  'travel-tent': [wild('fox', 625, 550, 0.55, '#9e7b58', 'ground', '#cfc5a9')],
  'travel-van': [wild('deer', 570, 525, 0.7, '#9c8767', 'ground', '#cab996')],
  'travel-lodge': [
    dog('#b9b5a6', '#6c7068'),
    wild('deer', 655, 545, 0.5, '#8c7a62', 'ground', '#c7b79d'),
  ],
  'travel-stars': [wild('owl', 540, 365, 0.55, '#7a8276', 'branch', '#b8b89e')],
  'garden-hanok': [wild('songbird', 580, 375, 0.7, '#8b7965', 'branch', '#c6b495')],
  'garden-court': [wild('rabbit', 565, 535, 0.65, '#b9b4a0', 'ground', '#ded0b3')],
  'garden-glass': [wild('songbird', 630, 355, 0.65, '#aa8b64', 'branch', '#d8c7a2')],
  'garden-lotus': [wild('duck', 560, 490, 0.8, '#8e8369', 'water', '#527568')],
  'garden-snow': [wild('songbird', 610, 540, 0.65, '#9a806c', 'ground', '#c6b095')],
  'study-linen': [{ ...cat('#c8b494', '#93866f'), pose: 'stretched' }],
  'forest-pine-fireflies': [
    wild('fox', 655, 550, 0.5, '#b28b61', 'ground', '#d2c2a3'),
    wild('owl', 180, 325, 0.55, '#817665', 'branch', '#beaf92'),
  ],
  'study-granite': [dog('#746b5b', '#b8ab8d')],
  'water-harbor-deep': [wild('gull', 650, 440, 0.7, '#c0c6b3', 'water', '#677b73')],
  'water-velvet-tide': [
    { ...cat('#777e74', '#d1c6aa'), pose: 'curled', x: 135, y: 610, scale: 0.7 },
  ],
  'cafe-barista-long-table': [cat('#b8a181', '#71644f')],
  'cafe-rain-dome': [{ ...dog('#c6b99d', '#89715a'), x: 746, y: 655, scale: 0.6 }],
  'cafe-neon-night': [cat('#6b6358', '#bb9b74')],
}
export function getSceneAnimals(backgroundOrId: Background | string): SceneAnimal[] {
  const room = typeof backgroundOrId === 'string' ? getBackground(backgroundOrId) : backgroundOrId
  return animals[room.id] ?? []
}
export function getIndoorCatAnchor(
  backgroundOrId: Background | string,
): { x: number; y: number; scale: number } | null {
  const cat = getSceneAnimals(backgroundOrId).find(
    (animal) => animal.habitat === 'indoor' && animal.species === 'cat',
  )
  return cat ? { x: cat.x, y: cat.y, scale: cat.scale } : null
}

export function validateSceneAnimals(): string[] {
  return validateSceneCatalogKeys(animals, 'animals')
}
