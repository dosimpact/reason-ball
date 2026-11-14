import type { SceneInteractiveObject, SceneObjectReaction } from './sceneInteractiveTypes'

type Labels = [string, string, string]
type Form =
  | 'roaster'
  | 'cabinet'
  | 'clock'
  | 'radio'
  | 'gramophone'
  | 'screen'
  | 'lantern'
  | 'bonsai'
  | 'orrery'
  | 'wheel'
  | 'telescope'
  | 'loom'
  | 'press'
  | 'barometer'
  | 'fan'
  | 'bell'
type Art = {
  base: string
  subject: string
  pivot: { x: number; y: number }
  type: SceneObjectReaction
}
const path = (d: string, fill: string, stroke?: string, width = 2) =>
  `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${width}"` : ''}/>`
const circle = (x: number, y: number, r: number, fill: string, stroke?: string) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="2"` : ''}/>`
/** Load-bearing casework stays fixed. Only the named leaf, rotor, lever or needle reacts. */
function fixture(form: Form, wood: string, metal: string, motif: string): Art {
  const dark = '#30433d',
    cream = '#cec5a3'
  const floorForms: Form[] = [
    'roaster',
    'cabinet',
    'radio',
    'gramophone',
    'screen',
    'bonsai',
    'orrery',
    'wheel',
    'telescope',
    'loom',
    'press',
  ]
  const feet =
    path('M28 82v6m40-6v6M26 88h6m32 0h6', 'none', wood, 3) +
    '<ellipse cx="48" cy="89" rx="27" ry="2" fill="#152922" opacity=".24"/>'
  let base = floorForms.includes(form) ? feet : '',
    subject = '',
    pivot = { x: 48, y: 45 },
    type: SceneObjectReaction = 'tick'
  switch (form) {
    case 'roaster':
      base +=
        path('M23 75V43q0-16 25-16t25 16v32zM33 27l-6-13h42l-6 13z', metal, dark) +
        circle(48, 52, 21, wood, cream) +
        path('M24 75h48v7H24zM31 68h34v7H31z', dark)
      subject =
        circle(48, 52, 14, dark, metal) +
        path('M48 40v24m-12-12h24m-20-8 16 16m0-16-16 16', 'none', metal)
      pivot = { x: 48, y: 52 }
      type = 'spin'
      break
    case 'cabinet':
      base +=
        path('M22 17h52v65H22z', wood, dark) +
        path('M28 24h40v51H28z', dark) +
        path('M28 44h40M28 62h40', 'none', metal) +
        path('M31 40v-9h9v9m12 18V48h10v10', cream)
      subject =
        path('M25 21h21v57H25zM50 21h21v57H50z', metal, wood) +
        path('M29 26h13v24H29zM54 26h13v24H54z', dark, cream) +
        circle(42, 59, 2, cream) +
        circle(54, 59, 2, cream)
      pivot = { x: 24, y: 48 }
      type = 'open'
      break
    case 'clock':
      base +=
        path('M28 80V31q0-22 20-22t20 22v49z', wood, metal) +
        circle(48, 34, 17, cream, dark) +
        path('M37 55h22v22H37z', dark, metal) +
        circle(48, 70, 7, metal)
      subject = path('M48 22v12l10 6', 'none', dark, 3) + circle(48, 34, 3, wood)
      pivot = { x: 48, y: 34 }
      break
    case 'radio':
      base +=
        path('M20 81V27q28-25 56 0v54z', wood, metal) +
        path('M27 34h42v14H27z', cream) +
        path('M27 55h42v20H27z', dark) +
        path('M31 57v15m7-15v15m7-15v15m7-15v15m7-15v15m7-15v15', 'none', metal)
      subject = circle(48, 41, 8, metal, dark) + path('M48 41l5-4', 'none', dark, 2)
      pivot = { x: 48, y: 41 }
      type = 'spin'
      break
    case 'gramophone':
      base += path('M27 81h42v7H27z', wood, metal)
      base +=
        path('M25 66h46v16H25zM33 64v-9h30v9z', wood, metal) +
        path('M49 57V36q-1-15 12-18', 'none', metal, 6)
      subject =
        path('M59 18 25 11q-18 17 3 33l31-17z', metal, wood) +
        '<ellipse cx="27" cy="27" rx="10" ry="16" fill="#30433d" stroke="#cec5a3" stroke-width="2"/>'
      pivot = { x: 59, y: 24 }
      type = 'swing'
      break
    case 'screen':
      base += path('M21 83V16h54v67M48 17v65', 'none', wood, 6)
      subject =
        path('M25 21h19v56H25zM52 21h19v56H52z', cream, metal) +
        path('M28 28l13 14-13 14 13 14m14-42 13 14-13 14 13 14', 'none', wood, 2)
      pivot = { x: 48, y: 21 }
      type = 'flutter'
      break
    case 'lantern':
      base += path('M48 4v17m-5-14h10', 'none', wood, 2)
      base +=
        path('M48 9v12M29 24h38l9 10H20zM26 72h44l-6 10H32z', wood, metal) +
        path('M26 33h44v39H26z', dark, metal)
      subject =
        path('M30 36h36v32H30z', cream, metal) +
        path('M39 36v32m18-32v32', 'none', wood, 2) +
        circle(48, 53, 7, metal)
      pivot = { x: 48, y: 52 }
      type = 'glow'
      break
    case 'bonsai':
      base +=
        path('M22 67h52l-7 15H29z', wood, metal) +
        path('M48 68 43 44l13-17m-12 22L30 32', 'none', wood, 5)
      subject =
        path('M18 32q0-13 16-12 9-18 22-4 22-1 20 15-12 10-24 3-18 10-34-2z', metal, dark) +
        path('M30 28q10-9 19-3m6-5 10 5', 'none', cream)
      pivot = { x: 43, y: 44 }
      type = 'wobble'
      break
    case 'orrery':
      base +=
        path('M48 79V20M28 80h40', 'none', wood, 5) +
        '<ellipse cx="48" cy="44" rx="28" ry="19" fill="none" stroke="' +
        metal +
        '" stroke-width="3"/>' +
        circle(48, 44, 12, cream, wood)
      subject =
        path('M48 44 24 30m24 14 20 17', 'none', metal, 2) +
        circle(24, 30, 6, metal, dark) +
        circle(68, 61, 7, wood, cream)
      pivot = { x: 48, y: 44 }
      type = 'spin'
      break
    case 'wheel':
      base += path('M34 80V46h28v34', wood, metal) + circle(48, 44, 29, dark, metal)
      subject =
        circle(48, 44, 22, 'none', wood) +
        path('M48 13v62M17 44h62M26 22l44 44m0-44L26 66', 'none', metal, 4) +
        circle(48, 44, 7, wood, cream)
      pivot = { x: 48, y: 44 }
      type = 'spin'
      break
    case 'telescope':
      base += path('M48 49V73M48 69 25 82m23-13 23 13', 'none', wood, 5)
      subject =
        path('m20 43 46-27 10 18-46 27z', metal, dark) +
        path('m19 41 8 20-7 4-9-20zm45-27 7-4 13 23-8 4z', wood, cream)
      pivot = { x: 48, y: 49 }
      type = 'orbit'
      break
    case 'loom':
      base +=
        path('M22 80V15h52v65M25 20h46M25 74h46', 'none', wood, 5) +
        path('M30 22v50m6-50v50m6-50v50m6-50v50m6-50v50m6-50v50m6-50v50', 'none', cream) +
        path('M28 50h40v21H28z', metal, wood)
      subject = path('M27 37h42v7H27zM32 31v19m32-19v19', wood, cream)
      pivot = { x: 48, y: 40 }
      type = 'press'
      break
    case 'press':
      base +=
        path('M24 82V24h48v58M23 22h50M32 72h32', 'none', wood, 6) +
        path('M29 73h38v9H29zM45 23h6v37h-6z', metal, dark)
      subject =
        path('M30 58h36v8H30zM48 27 24 13m24 14 23-13', 'none', metal, 5) +
        circle(24, 13, 4, wood) +
        circle(71, 14, 4, wood)
      pivot = { x: 48, y: 27 }
      type = 'press'
      break
    case 'barometer':
      base +=
        path('M32 81V18q16-16 32 0v63z', wood, metal) +
        circle(48, 34, 21, cream, dark) +
        path('M43 59h10v17H43z', cream, metal)
      subject = path('M48 34 36 25', 'none', dark, 3) + circle(48, 34, 3, metal)
      pivot = { x: 48, y: 34 }
      break
    case 'fan':
      base += circle(48, 40, 29, 'none', metal) + circle(48, 40, 25, dark, wood)
      subject =
        path(
          'M48 40q-25-29-25-9 1 14 25 9m0 0q35-6 22 10-10 10-22-10m0 0q-13 33-18 15-3-14 18-15',
          metal,
        ) + circle(48, 40, 5, cream)
      pivot = { x: 48, y: 40 }
      type = 'spin'
      break
    case 'bell':
      base += path('M48 4v14M27 18h42m-37 0v8m32-8v8', 'none', wood, 4)
      subject =
        path('M48 22v9M28 64q7-8 7-22 13-16 26 0 0 14 7 22z', metal, dark) +
        '<ellipse cx="48" cy="65" rx="21" ry="5" fill="' +
        wood +
        '"/>' +
        circle(48, 70, 4, cream)
      pivot = { x: 48, y: 22 }
      type = 'swing'
      break
  }
  // A real carved thematic inlay, rather than invisible per-room art differentiation.
  base += floorForms.includes(form)
    ? path(motif.replaceAll('85', '80'), 'none', cream, 1.4)
    : `<g transform="translate(0 -25)">${path(motif, 'none', cream, 1.4)}</g>`
  return { base, subject, pivot, type }
}
const silhouetteBounds: Record<Form, { x: number; y: number; width: number; height: number }> = {
  roaster: { x: 21, y: 12, width: 54, height: 79 },
  bell: { x: 13, y: 2, width: 58, height: 87 },
  cabinet: { x: 12, y: 15, width: 64, height: 76 },
  clock: { x: 26, y: 7, width: 44, height: 82 },
  fan: { x: 18, y: 10, width: 60, height: 79 },
  barometer: { x: 26, y: 8, width: 44, height: 82 },
  wheel: { x: 15, y: 11, width: 66, height: 80 },
  gramophone: { x: 15, y: 9, width: 60, height: 82 },
  loom: { x: 18, y: 11, width: 60, height: 80 },
  press: { x: 18, y: 9, width: 60, height: 82 },
  radio: { x: 18, y: 13, width: 60, height: 78 },
  orrery: { x: 17, y: 17, width: 61, height: 74 },
  telescope: { x: 9, y: 8, width: 77, height: 83 },
  lantern: { x: 17, y: 3, width: 62, height: 87 },
  screen: { x: 16, y: 11, width: 64, height: 80 },
  bonsai: { x: 16, y: 8, width: 62, height: 83 },
}
function large(
  roomId: string,
  key: string,
  labels: Labels,
  form: Form,
  x: number,
  y: number,
  wood: string,
  metal: string,
  motif: string,
  note: string,
  scale = 2,
  bounds = { x: 16, y: 8, width: 64, height: 82 },
): SceneInteractiveObject {
  const art = fixture(form, wood, metal, motif)
  // Visible functional badges distinguish the contents of otherwise related casework.
  if (form === 'cabinet') {
    const badge = roomId.includes('granite')
      ? 'm34 65 4-5 5 5-4 7zM54 65l4-5 5 5-4 7z'
      : roomId.includes('van')
        ? 'M31 64h12v7H31zM53 64h12v7H53zM34 61h6m16 0h6'
        : roomId.includes('library')
          ? 'M31 60h4v12h-4zm6 2h5v10h-5zm17-2h4v12h-4zm6 2h5v10h-5z'
          : roomId.includes('train')
            ? 'M30 63h14v9H30zM53 63h14v9H53zM34 61h6m17 0h6'
            : roomId.startsWith('forest') ||
                roomId.includes('greenhouse') ||
                roomId.includes('glass')
              ? 'M37 72v-9m0 3q-9-7-6-7 7 0 6 7m0 0q9-7 6-7-7 0-6 7M59 72v-9m0 3q-9-7-6-7 7 0 6 7m0 0q9-7 6-7-7 0-6 7'
              : roomId.includes('barista')
                ? 'M33 62q-6 3-2 9 6 3 9-3 1-6-7-6m1 1 3 7M57 62q-6 3-2 9 6 3 9-3 1-6-7-6m1 1 3 7'
                : 'M30 62h13v10H30zM30 62l6 5 7-5M53 62h13v10H53zM53 62l6 5 7-5'
    art.subject += path(badge, 'none', '#cec5a3', 1.2)
  }
  if (form === 'screen' && roomId === 'garden-lotus')
    art.subject += path(
      'M29 48q-5-12 5-7 10-5 5 7-5 7-10 0M57 48q-5-12 5-7 10-5 5 7-5 7-10 0',
      metal,
      wood,
    )
  if (form === 'clock' && roomId === 'travel-lodge')
    art.base += path('M43 62l5-5 5 5-2 10h-6zM43 65h10m-9 3h8', metal, wood)
  const floor = [
    'roaster',
    'cabinet',
    'radio',
    'gramophone',
    'screen',
    'bonsai',
    'orrery',
    'wheel',
    'telescope',
    'loom',
    'press',
  ].includes(form)
  const wallKind = form === 'bell' || form === 'lantern' ? 'ceiling' : 'wall'
  const floorPosition: Record<string, [number, number]> = {
    'cafe-rain': [72, 807],
    'cafe-barista-long-table': [72, 807],
    'study-attic': [98, 807],
    'forest-bamboo': [145, 807],
    'garden-hanok': [145, 807],
    'garden-lotus': [95, 807],
    'garden-court': [110, 807],
    'forest-pine-fireflies': [115, 807],
    'water-velvet-tide': [705, 807],
  }
  const contact = floor
    ? floorPosition[roomId] && x < 400
      ? floorPosition[roomId]!
      : [x < 400 ? 95 : 705, 807]
    : [x, y]
  const actualScale = floor ? 1.75 : scale
  void bounds
  return {
    id: `${roomId}:large-${key}`,
    roomId,
    size: 'large',
    label: { ko: labels[0], en: labels[1], zh: labels[2] },
    position: { x: contact[0], y: contact[1] },
    scale: actualScale,
    interactionBounds: silhouetteBounds[form],
    surface: {
      kind: floor ? 'floor' : wallKind,
      note: floor
        ? `Original scene foreground floor: authored pocket (${contact[0]},${contact[1]}), clear of elevated animal perches and seated heads; integral feet carry the furniture.`
        : `${note} ${wallKind === 'ceiling' ? 'A visible suspension descends from the room header.' : 'The instrument case attaches flush to the solid side frame with its own housing.'}`,
    },
    art: { base: art.base, subject: art.subject, pivot: art.pivot },
    reaction: {
      type: art.type,
      durationMs: art.type === 'spin' ? 2400 : 1800,
      color: metal,
      description: `The ${labels[1].toLowerCase()} ${form === 'clock' || form === 'barometer' ? 'needle ticks' : 'moving detail responds'} once; its structural housing and support remain fixed.`,
    },
  }
}
const west =
  'Upper-left room framing: the fixture attaches directly to the structural side frame at y100..120; its narrow case stays at the edge of the view, above people and animal routes.'
const east =
  'Upper-right framing: the fixture attaches directly below the structural header. The body stays above all seated heads and habitat routes, leaving the middle of the view clear.'
const head =
  'Upper room header: the fixture suspension or housing attaches to the solid ceiling/header band, well above the table and people.'
export const LARGE_STANDARD_SCENE_OBJECTS: SceneInteractiveObject[] = [
  large(
    'cafe-rain',
    'roaster',
    ['작은 바닥 로스터', 'Compact floor roaster', '小型落地烘焙机'],
    'roaster',
    83,
    260,
    '#6e5039',
    '#b99b68',
    'M28 85q6-3 12 0t12 0m1-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'cafe-rain',
    'bell',
    ['로스터 호출종', 'Roastery bell', '烘焙工坊钟'],
    'bell',
    717,
    260,
    '#6e5039',
    '#b99b68',
    'M28 85q6-3 12 0t12 0m1-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'cafe-alley',
    'cabinet',
    ['골목 편지 수납장', 'Alley letter cabinet', '小巷信件柜'],
    'cabinet',
    83,
    260,
    '#655944',
    '#9d9274',
    'M29 85q6-4 12 0t12 0m2-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'cafe-alley',
    'clock',
    ['골목 추 시계', 'Alley pendulum clock', '小巷摆钟'],
    'clock',
    717,
    260,
    '#655944',
    '#9d9274',
    'M29 85q6-4 12 0t12 0m2-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 7, width: 64, height: 83 },
  ),
  large(
    'cafe-greenhouse',
    'cabinet',
    ['온실 종자 수납장', 'Greenhouse seed cabinet', '温室种子柜'],
    'cabinet',
    83,
    260,
    '#50694e',
    '#9fb18b',
    'M30 85q6-5 12 0t12 0m3-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'cafe-greenhouse',
    'fan',
    ['온실 환기 팬', 'Greenhouse ventilation fan', '温室通风扇'],
    'fan',
    717,
    260,
    '#50694e',
    '#9fb18b',
    'M30 85q6-5 12 0t12 0m3-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'cafe-greenhouse',
    'header-barometer',
    ['온실 기압계', 'Greenhouse barometer', '温室气压计'],
    'barometer',
    300,
    168,
    '#50694e',
    '#9fb18b',
    'M30 85q6-5 12 0t12 0m3-3h5m-8-2h8',
    head,
    1.8,
    { x: 16, y: 8, width: 64, height: 82 },
  ),
  large(
    'cafe-rooftop',
    'fan',
    ['옥상 환기 팬', 'Rooftop ventilation fan', '屋顶通风扇'],
    'fan',
    83,
    260,
    '#4d665f',
    '#9faf9d',
    'M31 85q6-6 12 0t12 0m4-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'cafe-seaside',
    'barometer',
    ['해안 기압계', 'Coastal barometer', '海岸气压计'],
    'barometer',
    83,
    260,
    '#596f68',
    '#b8bfa4',
    'M28 85q6-7 12 0t12 0m1-3h5',
    west,
    2,
    { x: 16, y: 8, width: 64, height: 82 },
  ),
  large(
    'cafe-seaside',
    'wheel',
    ['해안 조타륜', 'Coastal helm wheel', '海岸舵轮'],
    'wheel',
    717,
    260,
    '#596f68',
    '#b8bfa4',
    'M28 85q6-7 12 0t12 0m1-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 15, y: 9, width: 66, height: 81 },
  ),
  large(
    'study-fire',
    'clock',
    ['떡갈나무 추 시계', 'Oak pendulum clock', '橡木摆钟'],
    'clock',
    83,
    260,
    '#77553d',
    '#b39161',
    'M29 85q6-3 12 0t12 0m2-3h5',
    west,
    2,
    { x: 16, y: 7, width: 64, height: 83 },
  ),
  large(
    'study-fire',
    'gramophone',
    ['황동 축음기', 'Brass gramophone', '黄铜留声机'],
    'gramophone',
    717,
    260,
    '#77553d',
    '#b39161',
    'M29 85q6-3 12 0t12 0m2-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 15, y: 9, width: 65, height: 81 },
  ),
  large(
    'study-attic',
    'loom',
    ['다락 직조틀', 'Attic weaving loom', '阁楼织布机'],
    'loom',
    83,
    260,
    '#74624d',
    '#b5a283',
    'M30 85q6-4 12 0t12 0m3-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'study-library',
    'cabinet',
    ['희귀본 보관장', 'Rare book cabinet', '珍本书柜'],
    'cabinet',
    83,
    260,
    '#545841',
    '#a5a88a',
    'M31 85q6-5 12 0t12 0m4-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'study-library',
    'press',
    ['도서관 제본 프레스', 'Library binding press', '图书馆装订压机'],
    'press',
    717,
    260,
    '#545841',
    '#a5a88a',
    'M31 85q6-5 12 0t12 0m4-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'study-library',
    'header-bell',
    ['서고 알림 종', 'Library call bell', '书库提示钟'],
    'bell',
    300,
    168,
    '#545841',
    '#a5a88a',
    'M31 85q6-5 12 0t12 0m4-3h5m-8-2h8',
    head,
    1.8,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'study-city',
    'radio',
    ['도시 단파 라디오', 'City shortwave radio', '城市短波收音机'],
    'radio',
    83,
    260,
    '#6e5039',
    '#b99b68',
    'M28 85q6-6 12 0t12 0m1-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'study-moon',
    'orrery',
    ['달 궤도 모형', 'Lunar orrery', '月轨仪'],
    'orrery',
    83,
    260,
    '#655944',
    '#9d9274',
    'M29 85q6-7 12 0t12 0m2-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'study-moon',
    'telescope',
    ['달빛 망원경', 'Moonlight telescope', '月光望远镜'],
    'telescope',
    717,
    260,
    '#655944',
    '#9d9274',
    'M29 85q6-7 12 0t12 0m2-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 9, y: 8, width: 77, height: 82 },
  ),
  large(
    'forest-mist',
    'barometer',
    ['안개 관측 기압계', 'Mist observation barometer', '雾气观测气压计'],
    'barometer',
    83,
    260,
    '#50694e',
    '#9fb18b',
    'M29 85q10-8 20 0m-10-5v7',
    west,
    2,
    { x: 16, y: 8, width: 64, height: 82 },
  ),
  large(
    'forest-cabin',
    'radio',
    ['오두막 진공관 라디오', 'Cabin valve radio', '木屋电子管收音机'],
    'radio',
    83,
    260,
    '#4d665f',
    '#9faf9d',
    'M30 85q11-8 21 0m-11-5v7',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'forest-cabin',
    'cabinet',
    ['숲 도구 보관장', 'Forest tool cabinet', '森林工具柜'],
    'cabinet',
    717,
    260,
    '#4d665f',
    '#9faf9d',
    'M30 85q11-8 21 0m-11-5v7m-26-3 4-3 4 3',
    east,
    2,
    { x: 13, y: 9, width: 67, height: 81 },
  ),
  large(
    'forest-fireflies',
    'lantern',
    ['반딧불 유리등', 'Firefly glass lantern', '萤火玻璃灯'],
    'lantern',
    83,
    260,
    '#596f68',
    '#b8bfa4',
    'M31 85q8-8 22 0m-9-5v7',
    west,
    2,
    { x: 16, y: 6, width: 64, height: 84 },
  ),
  large(
    'forest-bamboo',
    'screen',
    ['대나무 문양 가리개', 'Bamboo lattice screen', '竹纹屏风'],
    'screen',
    83,
    260,
    '#77553d',
    '#b39161',
    'M32 85q9-8 23 0m-10-5v7',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'forest-bamboo',
    'bell',
    ['대숲 사찰 종', 'Bamboo grove temple bell', '竹林寺钟'],
    'bell',
    717,
    260,
    '#77553d',
    '#b39161',
    'M32 85q9-8 23 0m-10-5v7m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'forest-autumn',
    'press',
    ['단풍 압화 프레스', 'Maple flower press', '枫叶压花机'],
    'press',
    83,
    260,
    '#74624d',
    '#b5a283',
    'M33 85q10-8 17 0m-11-5v7',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'forest-autumn',
    'cabinet',
    ['가을 표본 보관장', 'Autumn specimen cabinet', '秋日标本柜'],
    'cabinet',
    717,
    260,
    '#74624d',
    '#b5a283',
    'M33 85q10-8 17 0m-11-5v7m-26-3 4-3 4 3',
    east,
    2,
    { x: 12, y: 9, width: 68, height: 81 },
  ),
  large(
    'water-moon',
    'telescope',
    ['바다 달 관측경', 'Sea moon telescope', '海月望远镜'],
    'telescope',
    83,
    260,
    '#545841',
    '#a5a88a',
    'M31 85q6-3 12 0t12 0m4-3h5',
    west,
    2,
    { x: 9, y: 8, width: 77, height: 82 },
  ),
  large(
    'water-lake',
    'bell',
    ['호숫가 선착장 종', 'Lakeside landing bell', '湖岸码头钟'],
    'bell',
    83,
    260,
    '#6e5039',
    '#b99b68',
    'M28 85q6-4 12 0t12 0m1-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'water-lake',
    'radio',
    ['호수 기상 라디오', 'Lake weather radio', '湖泊气象收音机'],
    'radio',
    717,
    260,
    '#6e5039',
    '#b99b68',
    'M28 85q6-4 12 0t12 0m1-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'water-stream',
    'wheel',
    ['물레방아 모형', 'Watermill wheel model', '水磨轮模型'],
    'wheel',
    83,
    260,
    '#655944',
    '#9d9274',
    'M29 85q6-5 12 0t12 0m2-3h5',
    west,
    2,
    { x: 15, y: 9, width: 66, height: 81 },
  ),
  large(
    'water-harbor',
    'wheel',
    ['항구 조타륜', 'Harbor helm wheel', '港口舵轮'],
    'wheel',
    83,
    260,
    '#50694e',
    '#9fb18b',
    'M30 85q6-6 12 0t12 0m3-3h5',
    west,
    2,
    { x: 15, y: 9, width: 66, height: 81 },
  ),
  large(
    'water-harbor',
    'barometer',
    ['선장 기압계', 'Captain barometer', '船长气压计'],
    'barometer',
    717,
    260,
    '#50694e',
    '#9fb18b',
    'M30 85q6-6 12 0t12 0m3-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 8, width: 64, height: 82 },
  ),
  large(
    'water-falls',
    'lantern',
    ['폭포 창가 등롱', 'Waterfall hanging lantern', '瀑布悬挂灯笼'],
    'lantern',
    83,
    260,
    '#4d665f',
    '#9faf9d',
    'M31 85q6-7 12 0t12 0m4-3h5',
    west,
    2,
    { x: 16, y: 6, width: 64, height: 84 },
  ),
  large(
    'travel-train',
    'cabinet',
    ['열차 수하물 보관장', 'Train luggage cabinet', '列车行李柜'],
    'cabinet',
    83,
    260,
    '#596f68',
    '#b8bfa4',
    'M28 85q6-3 12 0t12 0m1-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'travel-train',
    'clock',
    ['철도 역 시계', 'Railway station clock', '铁路车站钟'],
    'clock',
    717,
    260,
    '#596f68',
    '#b8bfa4',
    'M28 85q6-3 12 0t12 0m1-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 7, width: 64, height: 83 },
  ),
  large(
    'travel-train',
    'header-bell',
    ['열차 출발 종', 'Railway departure bell', '列车出发钟'],
    'bell',
    400,
    168,
    '#596f68',
    '#b8bfa4',
    'M28 85q6-3 12 0t12 0m1-3h5m-8-2h8',
    head,
    1.8,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'travel-tent',
    'lantern',
    ['캠핑 폭풍 랜턴', 'Camping storm lantern', '露营防风灯'],
    'lantern',
    83,
    260,
    '#77553d',
    '#b39161',
    'M29 85q6-4 12 0t12 0m2-3h5',
    west,
    2,
    { x: 16, y: 6, width: 64, height: 84 },
  ),
  large(
    'travel-van',
    'cabinet',
    ['캠핑카 주방 수납장', 'Camper kitchen cabinet', '露营车厨房柜'],
    'cabinet',
    83,
    260,
    '#74624d',
    '#b5a283',
    'M30 85q6-5 12 0t12 0m3-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'travel-lodge',
    'clock',
    ['산장 솔방울 추 시계', 'Lodge pinecone clock', '山庄松果钟'],
    'clock',
    83,
    260,
    '#545841',
    '#a5a88a',
    'M31 85q6-6 12 0t12 0m4-3h5',
    west,
    2,
    { x: 16, y: 7, width: 64, height: 83 },
  ),
  large(
    'travel-lodge',
    'bell',
    ['산장 만찬 종', 'Lodge supper bell', '山庄晚餐钟'],
    'bell',
    717,
    260,
    '#545841',
    '#a5a88a',
    'M31 85q6-6 12 0t12 0m4-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'travel-lodge',
    'header-barometer',
    ['산장 기압계', 'Lodge weather barometer', '山庄气压计'],
    'barometer',
    270,
    168,
    '#545841',
    '#a5a88a',
    'M31 85q6-6 12 0t12 0m4-3h5m-8-2h8',
    head,
    1.8,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'travel-stars',
    'orrery',
    ['별빛 천체 모형', 'Starlight orrery', '星光天体仪'],
    'orrery',
    83,
    260,
    '#6e5039',
    '#b99b68',
    'M28 85q6-7 12 0t12 0m1-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'travel-stars',
    'telescope',
    ['별자리 관측경', 'Constellation telescope', '星座望远镜'],
    'telescope',
    717,
    260,
    '#6e5039',
    '#b99b68',
    'M28 85q6-7 12 0t12 0m1-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 9, y: 8, width: 77, height: 82 },
  ),
  large(
    'garden-hanok',
    'screen',
    ['한옥 조각 가리개', 'Hanok carved screen', '韩屋雕花屏风'],
    'screen',
    83,
    260,
    '#655944',
    '#9d9274',
    'M29 85q9-8 21 0m-10-5v7',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'garden-hanok',
    'bell',
    ['마루 풍경 종', 'Veranda bronze bell', '廊台铜钟'],
    'bell',
    717,
    260,
    '#655944',
    '#9d9274',
    'M29 85q9-8 21 0m-10-5v7m-26-3 4-3 4 3',
    east,
    2,
    { x: 13, y: 9, width: 67, height: 81 },
  ),
  large(
    'garden-court',
    'bonsai',
    ['은행나무 분재', 'Ginkgo bonsai', '银杏盆景'],
    'bonsai',
    83,
    260,
    '#50694e',
    '#9fb18b',
    'M30 85q10-8 22 0m-11-5v7',
    west,
    2,
    { x: 16, y: 8, width: 64, height: 82 },
  ),
  large(
    'garden-glass',
    'cabinet',
    ['유리 온실 화초장', 'Glasshouse plant cabinet', '玻璃温室花柜'],
    'cabinet',
    83,
    260,
    '#4d665f',
    '#9faf9d',
    'M31 85q11-8 23 0m-9-5v7',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'garden-glass',
    'fan',
    ['온실 순환 팬', 'Glasshouse circulation fan', '玻璃温室循环扇'],
    'fan',
    717,
    260,
    '#4d665f',
    '#9faf9d',
    'M31 85q11-8 23 0m-9-5v7m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'garden-lotus',
    'screen',
    ['연꽃 투각 가리개', 'Lotus fretwork screen', '莲花镂空屏风'],
    'screen',
    83,
    260,
    '#596f68',
    '#b8bfa4',
    'M32 85q8-8 17 0m-10-5v7',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'garden-snow',
    'lantern',
    ['설원 정원 등롱', 'Snow garden hanging lantern', '雪园悬挂灯笼'],
    'lantern',
    83,
    260,
    '#77553d',
    '#b39161',
    'M33 85q9-8 18 0m-11-5v7',
    west,
    2,
    { x: 16, y: 6, width: 64, height: 84 },
  ),
  large(
    'study-linen',
    'loom',
    ['린넨 직조틀', 'Linen floor loom', '亚麻落地织布机'],
    'loom',
    83,
    260,
    '#74624d',
    '#b5a283',
    'M30 85q6-3 12 0t12 0m3-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'study-linen',
    'press',
    ['직물 압착 프레스', 'Textile finishing press', '织物压整机'],
    'press',
    717,
    260,
    '#74624d',
    '#b5a283',
    'M30 85q6-3 12 0t12 0m3-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'forest-pine-fireflies',
    'bonsai',
    ['소나무 가지 분재', 'Pine branch bonsai', '松枝盆景'],
    'bonsai',
    83,
    260,
    '#545841',
    '#a5a88a',
    'M30 85q11-8 20 0m-10-5v7',
    west,
    2,
    { x: 16, y: 8, width: 64, height: 82 },
  ),
  large(
    'study-granite',
    'cabinet',
    ['화강암 광물 보관장', 'Granite mineral cabinet', '花岗岩矿石柜'],
    'cabinet',
    83,
    260,
    '#6e5039',
    '#b99b68',
    'M28 85q6-5 12 0t12 0m1-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'study-granite',
    'press',
    ['광물 표본 프레스', 'Mineral specimen press', '矿物标本压机'],
    'press',
    717,
    260,
    '#6e5039',
    '#b99b68',
    'M28 85q6-5 12 0t12 0m1-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'water-harbor-deep',
    'radio',
    ['항구 선박 무전기', 'Harbor ship radio', '港口船用无线电'],
    'radio',
    83,
    260,
    '#655944',
    '#9d9274',
    'M29 85q6-6 12 0t12 0m2-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'water-harbor-deep',
    'wheel',
    ['깊은 항구 조타륜', 'Deep harbor helm', '深港舵轮'],
    'wheel',
    717,
    260,
    '#655944',
    '#9d9274',
    'M29 85q6-6 12 0t12 0m2-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 15, y: 9, width: 66, height: 81 },
  ),
  large(
    'water-velvet-tide',
    'gramophone',
    ['해안 포치 축음기', 'Coastal porch gramophone', '海岸门廊留声机'],
    'gramophone',
    83,
    260,
    '#50694e',
    '#9fb18b',
    'M30 85q6-7 12 0t12 0m3-3h5',
    west,
    2,
    { x: 15, y: 9, width: 65, height: 81 },
  ),
  large(
    'cafe-barista-long-table',
    'roaster',
    ['바리스타 원통 로스터', 'Barista drum roaster', '咖啡师滚筒烘焙机'],
    'roaster',
    83,
    260,
    '#4d665f',
    '#9faf9d',
    'M31 85q6-3 12 0t12 0m4-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'cafe-barista-long-table',
    'cabinet',
    ['바리스타 원두 수납장', 'Barista bean cabinet', '咖啡师豆柜'],
    'cabinet',
    717,
    260,
    '#4d665f',
    '#9faf9d',
    'M31 85q6-3 12 0t12 0m4-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'cafe-rain-dome',
    'lantern',
    ['돔 카페 구리등', 'Dome cafe copper lantern', '穹顶咖啡馆铜灯'],
    'lantern',
    83,
    260,
    '#596f68',
    '#b8bfa4',
    'M28 85q6-4 12 0t12 0m1-3h5',
    west,
    2,
    { x: 16, y: 6, width: 64, height: 84 },
  ),
  large(
    'cafe-neon-night',
    'radio',
    ['심야 아치 라디오', 'Midnight arch radio', '午夜拱形收音机'],
    'radio',
    83,
    260,
    '#77553d',
    '#b39161',
    'M29 85q6-5 12 0t12 0m2-3h5',
    west,
    2,
    { x: 16, y: 9, width: 64, height: 81 },
  ),
  large(
    'cafe-neon-night',
    'gramophone',
    ['심야 음반 축음기', 'Midnight record gramophone', '午夜唱片留声机'],
    'gramophone',
    717,
    260,
    '#77553d',
    '#b39161',
    'M29 85q6-5 12 0t12 0m2-3h5m-26-3 4-3 4 3',
    east,
    2,
    { x: 15, y: 9, width: 65, height: 81 },
  ),
]
