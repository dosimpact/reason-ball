/** 인물 배치/외형 원본. 안정적인 배경 ID와 좌석 인덱스가 자세·프로필을 연결한다.
 * 배치 변경 시 getSeatGeometry를 사용하는 손/컵/김/비 가림과 특수 카페의 별도 인물도 확인한다. */
import {
  BACKGROUNDS,
  resolveBackgroundId,
  validateSceneCatalogKeys,
  type Background,
} from './backgrounds.ts'
export type Pose = 'reading' | 'laptop' | 'coffee' | 'writing' | 'conversation'
type View = 'front' | 'three-quarter' | 'profile' | 'back'
type Gaze = 'down' | 'forward'
export type Expression =
  | 'focused'
  | 'thoughtful'
  | 'calm'
  | 'sleepy'
  | 'soft-smile'
  | 'relaxed'
  | 'talking'
export type Hair =
  | 'short'
  | 'bob'
  | 'bun'
  | 'wavy'
  | 'curly'
  | 'long'
  | 'braid'
  | 'ponytail'
  | 'shaved'
export type Seat = {
  yOffset?: number
  x: number
  pose: Pose
  view: View
  gaze: Gaze
  expression: Expression
  hair: Hair
  facing?: 1 | -1
  role?: 'speaker' | 'listener'
}
// View and gaze describe real geometry and occlusion, not a flipped copy of one face.
const staging: Record<string, Seat[]> = {
  'cafe-neon-night': [
    {
      x: 265,
      pose: 'reading',
      view: 'three-quarter',
      gaze: 'down',
      expression: 'thoughtful',
      hair: 'ponytail',
    },
    {
      x: 535,
      pose: 'coffee',
      view: 'profile',
      gaze: 'forward',
      expression: 'calm',
      hair: 'curly',
      facing: -1,
    },
  ],
  'cafe-rain': [
    { x: 260, pose: 'reading', view: 'front', gaze: 'down', expression: 'focused', hair: 'bob' },
    {
      x: 535,
      pose: 'coffee',
      view: 'profile',
      gaze: 'forward',
      expression: 'calm',
      hair: 'short',
      facing: -1,
    },
  ],
  'cafe-alley': [
    { x: 200, pose: 'reading', view: 'back', gaze: 'down', expression: 'focused', hair: 'bun' },
    {
      x: 400,
      pose: 'writing',
      view: 'three-quarter',
      gaze: 'down',
      expression: 'calm',
      hair: 'wavy',
    },
    {
      x: 600,
      pose: 'coffee',
      view: 'profile',
      gaze: 'forward',
      expression: 'calm',
      hair: 'bob',
      facing: -1,
    },
  ],
  'cafe-greenhouse': [
    { x: 185, pose: 'laptop', view: 'back', gaze: 'forward', expression: 'calm', hair: 'short' },
    {
      x: 425,
      pose: 'conversation',
      view: 'profile',
      gaze: 'forward',
      expression: 'talking',
      hair: 'wavy',
      role: 'speaker',
    },
    {
      x: 615,
      pose: 'conversation',
      view: 'three-quarter',
      gaze: 'forward',
      expression: 'soft-smile',
      hair: 'bun',
      role: 'listener',
      facing: -1,
    },
  ],
  'cafe-rooftop': [
    {
      x: 195,
      pose: 'laptop',
      view: 'three-quarter',
      gaze: 'down',
      expression: 'calm',
      hair: 'short',
    },
    { x: 400, pose: 'writing', view: 'back', gaze: 'down', expression: 'calm', hair: 'bob' },
    {
      x: 605,
      pose: 'laptop',
      view: 'profile',
      gaze: 'forward',
      expression: 'calm',
      hair: 'wavy',
      facing: -1,
    },
  ],
  'cafe-seaside': [
    {
      x: 270,
      pose: 'conversation',
      view: 'three-quarter',
      gaze: 'forward',
      expression: 'talking',
      hair: 'bun',
      role: 'speaker',
    },
    {
      x: 530,
      pose: 'conversation',
      view: 'profile',
      gaze: 'forward',
      expression: 'soft-smile',
      hair: 'short',
      role: 'listener',
      facing: -1,
    },
  ],
  'study-fire': [
    { x: 270, pose: 'reading', view: 'front', gaze: 'down', expression: 'calm', hair: 'wavy' },
    {
      x: 535,
      pose: 'reading',
      view: 'back',
      gaze: 'down',
      expression: 'focused',
      hair: 'bob',
      facing: -1,
    },
  ],
  'study-library': [
    { x: 190, pose: 'reading', view: 'profile', gaze: 'down', expression: 'focused', hair: 'bun' },
    { x: 405, pose: 'writing', view: 'front', gaze: 'down', expression: 'focused', hair: 'short' },
    {
      x: 610,
      pose: 'reading',
      view: 'back',
      gaze: 'down',
      expression: 'focused',
      hair: 'wavy',
      facing: -1,
    },
  ],
  'study-city': [
    {
      x: 265,
      pose: 'laptop',
      view: 'back',
      gaze: 'forward',
      expression: 'thoughtful',
      hair: 'bun',
    },
    {
      x: 540,
      pose: 'writing',
      view: 'three-quarter',
      gaze: 'down',
      expression: 'focused',
      hair: 'bob',
      facing: -1,
    },
  ],
  'forest-cabin': [
    {
      x: 400,
      pose: 'writing',
      view: 'three-quarter',
      gaze: 'down',
      expression: 'sleepy',
      hair: 'wavy',
    },
  ],
  'travel-train': [
    { x: 265, pose: 'reading', view: 'front', gaze: 'down', expression: 'thoughtful', hair: 'bun' },
    {
      x: 540,
      pose: 'coffee',
      view: 'profile',
      gaze: 'forward',
      expression: 'calm',
      hair: 'wavy',
      facing: -1,
    },
  ],
  'travel-van': [
    { x: 400, pose: 'laptop', view: 'back', gaze: 'forward', expression: 'calm', hair: 'short' },
  ],
  'travel-lodge': [
    {
      x: 265,
      pose: 'coffee',
      view: 'three-quarter',
      gaze: 'forward',
      expression: 'calm',
      hair: 'bob',
    },
    {
      x: 535,
      pose: 'reading',
      view: 'front',
      gaze: 'down',
      expression: 'sleepy',
      hair: 'short',
      facing: -1,
    },
  ],
  'garden-hanok': [
    { x: 265, pose: 'writing', view: 'profile', gaze: 'down', expression: 'calm', hair: 'wavy' },
    {
      x: 535,
      pose: 'writing',
      view: 'back',
      gaze: 'down',
      expression: 'calm',
      hair: 'bun',
      facing: -1,
    },
  ],
  'cafe-barista-long-table': [
    {
      x: 190,
      yOffset: -50,
      pose: 'reading',
      view: 'front',
      gaze: 'down',
      expression: 'calm',
      hair: 'bob',
    },
    {
      x: 610,
      pose: 'coffee',
      view: 'profile',
      gaze: 'forward',
      expression: 'calm',
      hair: 'short',
      facing: -1,
    },
  ],
  'cafe-rain-dome': [
    {
      x: 265,
      yOffset: -50,
      pose: 'reading',
      view: 'three-quarter',
      gaze: 'down',
      expression: 'calm',
      hair: 'bun',
    },
    {
      x: 545,
      pose: 'laptop',
      view: 'back',
      gaze: 'forward',
      expression: 'calm',
      hair: 'wavy',
      facing: -1,
    },
  ],
  'study-linen': [
    { x: 400, pose: 'reading', view: 'front', gaze: 'down', expression: 'focused', hair: 'wavy' },
  ],
  'forest-pine-fireflies': [
    { x: 265, pose: 'laptop', view: 'back', gaze: 'forward', expression: 'calm', hair: 'bun' },
    {
      x: 535,
      pose: 'writing',
      view: 'three-quarter',
      gaze: 'down',
      expression: 'calm',
      hair: 'short',
      facing: -1,
    },
  ],
  'study-granite': [
    {
      x: 400,
      pose: 'writing',
      view: 'profile',
      gaze: 'down',
      expression: 'thoughtful',
      hair: 'short',
    },
  ],
  'water-harbor-deep': [
    {
      x: 265,
      pose: 'laptop',
      view: 'three-quarter',
      gaze: 'forward',
      expression: 'calm',
      hair: 'bob',
    },
    {
      x: 535,
      pose: 'reading',
      view: 'front',
      gaze: 'down',
      expression: 'calm',
      hair: 'bun',
      facing: -1,
    },
  ],
  'garden-glass': [
    {
      x: 265,
      pose: 'laptop',
      view: 'three-quarter',
      gaze: 'forward',
      expression: 'calm',
      hair: 'bob',
    },
    {
      x: 535,
      pose: 'reading',
      view: 'front',
      gaze: 'down',
      expression: 'calm',
      hair: 'bun',
      facing: -1,
    },
  ],
  'study-attic': [],
  'study-moon': [],
  'forest-mist': [],
  'forest-fireflies': [],
  'forest-bamboo': [],
  'forest-autumn': [],
  'water-moon': [],
  'water-lake': [],
  'water-stream': [],
  'water-harbor': [],
  'water-falls': [],
  'travel-tent': [],
  'travel-stars': [],
  'garden-court': [],
  'garden-lotus': [],
  'garden-snow': [],
  'water-velvet-tide': [],
}
export function getSceneSeats(background: Background): Seat[] {
  return (staging[background.id] ?? []).slice(0, background.companions)
}
export function getSeatGeometry(background: Background, seat: Seat, withTable = true) {
  return {
    y: (withTable ? 590 : seat.x < 400 ? 630 : 619) + (seat.yOffset ?? 0),
    scale: background.companions === 3 ? 0.82 : 0.9,
  }
}

export type CharacterAppearance = {
  id: string
  hair: Hair
  hairColor: string
  skin: string
  shirt: string
  outfit: 'cardigan' | 'shirt' | 'scarf' | 'hoodie' | 'vest' | 'striped' | 'apron' | 'turtleneck'
  accessory: 'headphones' | 'earring' | 'none'
  age: 'adult' | 'mature'
}
// Individually authored cast: clothing construction and accessories distinguish people beyond palette.
const castRows: Record<string, string[]> = {
  'cafe-rain': [
    '0-hana|bob|#302821|#c99b79|#607064|cardigan|none|adult',
    '0-jun|short|#66594b|#ab785d|#7b624e|turtleneck|none|mature',
  ],
  'cafe-alley': [
    '1-sora|bun|#413329|#c68a67|#7e705e|scarf|earring|adult',
    '1-do-yun|curly|#282621|#90634e|#64747b|shirt|none|adult',
    '1-mi-ra|long|#777365|#d6b18e|#8a6555|cardigan|none|mature',
  ],
  'cafe-greenhouse': [
    '2-tae|shaved|#302b27|#a97458|#676c54|hoodie|headphones|adult',
    '2-yeon|wavy|#55402e|#d0a17b|#8a7058|vest|none|adult',
    '2-su|braid|#292926|#b78165|#69796f|shirt|earring|adult',
  ],
  'cafe-rooftop': [
    '3-min|short|#242620|#c09172|#526674|hoodie|headphones|adult',
    '3-ji|ponytail|#584437|#d2a27b|#7c735f|striped|none|adult',
    '3-hyun|curly|#827a69|#a9765c|#6a6655|cardigan|none|mature',
  ],
  'cafe-seaside': [
    '4-eun|bun|#43362e|#dab48e|#8a6954|scarf|earring|mature',
    '4-seok|shaved|#726d60|#b78465|#566f6b|vest|none|mature',
  ],
  'study-fire': [
    '5-na-ri|long|#7c7568|#c89c7d|#776853|turtleneck|none|mature',
    '5-yu|bob|#3b3029|#a87459|#756c74|cardigan|none|adult',
  ],
  'study-library': [
    '7-won|bun|#6b5543|#cb9773|#69785b|shirt|none|adult',
    '7-ha-neul|shaved|#40352e|#aa755b|#8a7560|vest|none|adult',
    '7-bo-ra|curly|#312c29|#d4aa85|#636d80|scarf|headphones|adult',
  ],
  'study-city': [
    '8-da-on|ponytail|#2d2c27|#c38f6e|#526e69|hoodie|headphones|adult',
    '8-seo|bob|#8c8172|#cba683|#856c61|shirt|none|mature',
  ],
  'forest-cabin': ['11-i-sol|braid|#4e3c2f|#b88263|#657556|cardigan|none|adult'],
  'travel-train': [
    '20-ho|bun|#5b4b3b|#cc9e7c|#6f6a82|scarf|none|adult',
    '20-a-ra|curly|#332c25|#96664f|#8a7353|striped|earring|adult',
  ],
  'travel-van': ['22-teo|short|#756a55|#d0a37d|#587178|hoodie|headphones|mature'],
  'travel-lodge': [
    '23-so-yeong|bob|#655345|#b9876b|#8a6a69|turtleneck|earring|adult',
    '23-gil|short|#aaa38d|#c9a384|#65705b|cardigan|none|mature',
  ],
  'garden-hanok': [
    '25-seon|wavy|#39352e|#c89c78|#7a7861|vest|none|adult',
    '25-chae|braid|#665043|#b37d60|#746879|shirt|none|adult',
  ],
  'garden-glass': [
    '27-ro|bob|#3f3129|#d4a37f|#607b73|apron|earring|adult',
    '27-dam|ponytail|#8a7660|#ac755b|#7d6659|striped|none|adult',
  ],
  'study-linen': ['30-yeo|long|#7b766b|#c8a489|#747c6e|scarf|none|mature'],
  'forest-pine-fireflies': [
    '31-sol|bun|#292720|#95634c|#786d5e|vest|headphones|adult',
    '31-joo|short|#52463a|#d8ac87|#667887|shirt|none|adult',
  ],
  'study-granite': ['32-hui|shaved|#8b8476|#bd9375|#6b735d|turtleneck|none|mature'],
  'water-harbor-deep': [
    '33-on|bob|#7b5840|#d0a280|#7d6977|cardigan|earring|adult',
    '33-bin|bun|#352e27|#ac755a|#7a7c61|scarf|none|adult',
  ],
  'cafe-barista-long-table': [
    '35-ran|curly|#514136|#d2ad8c|#687f77|shirt|none|mature',
    '35-kang|short|#958774|#af7d61|#89705b|vest|none|mature',
    '35-ino|short|#514537|#ba8868|#7b7055|apron|none|adult',
  ],
  'cafe-rain-dome': [
    '36-mai|braid|#342e28|#bf8c6b|#857364|apron|earring|adult',
    '36-noa|wavy|#6c5946|#d5a681|#5e6e80|hoodie|headphones|adult',
  ],
  'cafe-neon-night': [
    '37-seo-ha|ponytail|#39302b|#cd9b79|#756d83|striped|headphones|adult',
    '37-jin-u|curly|#887865|#b48266|#64796d|scarf|none|mature',
  ],
  'study-attic': [],
  'study-moon': [],
  'forest-mist': [],
  'forest-fireflies': [],
  'forest-bamboo': [],
  'forest-autumn': [],
  'water-moon': [],
  'water-lake': [],
  'water-stream': [],
  'water-harbor': [],
  'water-falls': [],
  'travel-tent': [],
  'travel-stars': [],
  'garden-court': [],
  'garden-lotus': [],
  'garden-snow': [],
  'water-velvet-tide': [],
}
export function getCharacterAppearance(scene: number | string, index: number): CharacterAppearance {
  const row = castRows[resolveBackgroundId(scene)]?.[index] ?? castRows['cafe-rain'][index % 2]
  const [name, hair, hairColor, skin, shirt, outfit, accessory, age] = row.split('|')
  return {
    id: name,
    hair: hair as Hair,
    hairColor,
    skin,
    shirt,
    outfit: outfit as CharacterAppearance['outfit'],
    accessory: accessory as CharacterAppearance['accessory'],
    age: age as CharacterAppearance['age'],
  }
}

export function validateSceneCast(): string[] {
  const errors = [
    ...validateSceneCatalogKeys(staging, 'seats'),
    ...validateSceneCatalogKeys(castRows, 'characters'),
  ]
  for (const room of BACKGROUNDS) {
    const seats = staging[room.id]
    const characters = castRows[room.id]
    if (!seats || !characters) continue
    const seatedCount = room.id === 'cafe-barista-long-table' ? 2 : room.companions
    if (seats.length !== seatedCount || characters.length < room.companions)
      errors.push(`${room.id}: cast coverage`)
  }
  return errors
}
