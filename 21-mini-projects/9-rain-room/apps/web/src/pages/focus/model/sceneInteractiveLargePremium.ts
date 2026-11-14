import type { SceneInteractiveObject, SceneObjectReaction } from './sceneInteractiveTypes.ts'

/** Floor exhibits occupy authored pockets, away from the resident and the central view.
 * Feet remain fixed; only a working component responds to a deliberate click. */
const path = (d: string, fill: string, stroke = '#c3af83', width = 1.5) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`
const ring = (
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  stroke = '#c3af83',
  width = 1.5,
) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`
const feet =
  '<ellipse cx="48" cy="87" rx="25" ry="2" fill="#233b35" opacity=".3"/>' +
  path('M28 85h40v3H28zM33 77v8m30-8v8', '#625c46')
const stand = feet + path('M29 77h38v5H29zM44 54h8v23h-8z', '#786b50')
const cabinet = feet + path('M25 15h46v63H25z', '#71694f') + path('M29 20h38v53H29z', '#344c47')
const tube = (x: number, y: number, c: string) => path(`M${x - 4} ${y - 18}h8v7l5 19h-18l5-19z`, c)
const silhouetteBounds: Record<string, { x: number; y: number; width: number; height: number }> = {
  'carillon-tower': { x: 21, y: 6, width: 54, height: 84 },
  apothecary: { x: 16, y: 2, width: 64, height: 88 },
  'blossom-screen': { x: 21, y: 12, width: 54, height: 78 },
  waterwheel: { x: 21, y: 10, width: 54, height: 80 },
  'resolution-press': { x: 20, y: 8, width: 56, height: 82 },
  'expedition-trunk': { x: 21, y: 8, width: 54, height: 82 },
  'seed-elevator': { x: 23, y: 8, width: 50, height: 82 },
  'tide-recorder': { x: 23, y: 13, width: 50, height: 77 },
  'navigation-lock': { x: 21, y: 16, width: 54, height: 74 },
  'pressure-harp': { x: 22, y: 7, width: 51, height: 83 },
  orrery: { x: 21, y: 10, width: 54, height: 80 },
  'dragon-shrine': { x: 19, y: 8, width: 58, height: 82 },
  terrarium: { x: 23, y: 11, width: 50, height: 79 },
  'lunar-still': { x: 23, y: 12, width: 50, height: 78 },
  'root-lantern': { x: 23, y: 9, width: 50, height: 81 },
  'neon-sculpture': { x: 23, y: 11, width: 50, height: 79 },
  'upright-bass': { x: 23, y: 7, width: 50, height: 83 },
  'kinetic-ribbon': { x: 23, y: 6, width: 50, height: 84 },
  'book-press': { x: 21, y: 11, width: 54, height: 79 },
  'film-rewinder': { x: 20, y: 11, width: 56, height: 79 },
  'rainfall-harp': { x: 20, y: 12, width: 56, height: 78 },
  'specimen-vault': { x: 23, y: 13, width: 50, height: 77 },
  'rain-organ': { x: 21, y: 5, width: 54, height: 85 },
  armillary: { x: 22, y: 8, width: 52, height: 82 },
  'steam-vessel': { x: 22, y: 9, width: 52, height: 81 },
  'stellar-recorder': { x: 23, y: 21, width: 50, height: 69 },
  'rover-instrument': { x: 21, y: 9, width: 54, height: 81 },
  'postal-tube': { x: 23, y: 8, width: 50, height: 82 },
  'cupping-cabinet': { x: 23, y: 13, width: 50, height: 77 },
  'memory-wardrobe': { x: 18, y: 4, width: 60, height: 86 },
  'advent-wheel': { x: 23, y: 13, width: 50, height: 77 },
  'incense-column': { x: 27, y: 6, width: 42, height: 84 },
  'wish-cabinet': { x: 23, y: 13, width: 50, height: 77 },
  'wind-vane': { x: 21, y: 12, width: 54, height: 78 },
  'rune-lectern': { x: 23, y: 28, width: 50, height: 62 },
  'spore-chimes': { x: 22, y: 11, width: 52, height: 79 },
  'color-prism': { x: 23, y: 8, width: 50, height: 82 },
  'sample-auger': { x: 26, y: 12, width: 44, height: 78 },
  'memory-quilt': { x: 23, y: 6, width: 50, height: 84 },
  'comet-globe': { x: 21, y: 9, width: 54, height: 81 },
  'stamp-perforator': { x: 26, y: 8, width: 44, height: 82 },
  'parcel-scale': { x: 23, y: 12, width: 50, height: 78 },
}
const prop = (
  room: string,
  id: string,
  labels: [string, string, string],
  x: number,
  y: number,
  base: string,
  subject: string,
  type: SceneObjectReaction,
  pivot: [number, number],
  scale = 1.8,
): SceneInteractiveObject => ({
  id: `premium-${room}:large-${id}`,
  roomId: `premium-${room}`,
  size: 'large',
  label: { ko: labels[0], en: labels[1], zh: labels[2] },
  position: { x, y },
  scale,
  interactionBounds: silhouetteBounds[id],
  surface: {
    kind: y < 600 ? 'wall' : 'floor',
    note:
      y < 600
        ? `PremiumScene ${room}: narrow solid right wall strip, screw-mounted display at (${x},${y}), beyond the main window opening; fixed lower bracket bears the exhibit.`
        : `PremiumScene Interior ${room}: freestanding exhibit on the original floor at (${x},${y}); integral feet and contact shadow support the fixed base.`,
  },
  art: {
    base:
      y < 600
        ? base.replace(
            feet,
            path('M32 78h32v8H32zM36 85v3m24-3v3', '#7a795d') +
              ring(36, 82, 2, 2, '#d1c298') +
              ring(60, 82, 2, 2, '#d1c298'),
          )
        : base,
    subject,
    pivot: { x: pivot[0], y: pivot[1] },
  },
  reaction: {
    type,
    durationMs: 1800,
    strength: 0.55,
    color: '#d1ba8c',
    description: `${labels[1]}: its working component makes one measured ${type} response and settles on its fixed support.`,
  },
})

export const LARGE_PREMIUM_SCENE_OBJECTS: SceneInteractiveObject[] = [
  prop(
    'christmas-bookcafe',
    'carillon-tower',
    ['겨울 종 오르골 탑', 'Winter carillon tower', '冬日钟音乐塔'],
    735,
    805,
    feet +
      path('M29 78V28h38v50zM24 28 48 9 72 28z', '#8b6250') +
      path('M34 34h28v31H34z', '#354e44') +
      path('M34 70h28v8H34z', '#ae9267'),
    path('M39 41q9-16 18 0v13H39z', '#d4bb81') + path('M48 54v7', 'none'),
    'swing',
    [48, 35],
  ),
  prop(
    'halloween-greenhouse',
    'apothecary',
    ['달호박 약장', 'Moon pumpkin apothecary', '月南瓜药柜'],
    70,
    805,
    cabinet +
      path('M22 16 48 8 74 16z', '#876646') +
      path('M29 42h38M48 20v53', 'none') +
      tube(38, 35, '#97a37b') +
      tube(58, 64, '#bd9865'),
    path('M49 21h17v20H49z', '#686b4d') + ring(58, 31, 3, 5, '#cbad78'),
    'open',
    [49, 31],
  ),
  prop(
    'sakura-teahouse',
    'blossom-screen',
    ['벚꽃 접이 병풍', 'Blossom folding screen', '樱花折屏'],
    140,
    805,
    feet +
      path('M23 14 42 20 56 14 73 21v58l-17-7-14 7-19-7z', '#baa88a') +
      path('M42 20v59m14-65v58', 'none', '#716c50') +
      path('M30 64 36 33l28 12m-28-12 11-9', 'none', '#777b5c', 2),
    ring(35, 39, 6, 4, '#ca9d9c') + ring(53, 42, 6, 4, '#d2acaa') + ring(47, 29, 5, 4, '#b88b91'),
    'flutter',
    [48, 45],
  ),
  prop(
    'autumn-lake',
    'waterwheel',
    ['단풍 물레 조각', 'Maple waterwheel sculpture', '枫叶水轮雕塑'],
    745,
    805,
    stand + path('M25 60h46v7H25zM32 39v22m32-22v22', 'none', '#887850', 3),
    ring(48, 37, 25, 25, '#716947', '#bd9d65', 3) +
      ring(48, 37, 17, 17, '#45645a') +
      path('M48 12v50M23 37h50M30 19l36 36m-36 0 36-36', 'none', '#ba9564', 3),
    'spin',
    [48, 37],
  ),
  prop(
    'newyear-attic',
    'resolution-press',
    ['새해 달력 인쇄기', 'New year calendar press', '新年日历印刷机'],
    70,
    805,
    feet +
      path('M26 76V24h44v52z', '#637568') +
      path('M31 31h34v27H31z', '#c5bd9b') +
      path('M35 36h26m-26 7h26m-26 7h18', 'none', '#81917a') +
      path('M22 68h52v11H22z', '#927b55'),
    path('M48 26V11h19m0 0v8', 'none', '#d0b88a', 4) + ring(68, 20, 5, 4, '#796149'),
    'tick',
    [48, 26],
  ),
  prop(
    'orient-express',
    'expedition-trunk',
    ['여행 기록 트렁크', 'Expedition archive trunk', '旅行档案箱'],
    70,
    800,
    feet +
      path('M23 42h50v36H23z', '#87664c') +
      path('M30 43v34m36-34v34', 'none', '#c4a772', 4) +
      path('M35 52h26v17H35z', '#6b765d') +
      path('M41 58h14m-14 5h8', 'none', '#bfba94'),
    path('M23 41V18h50v23z', '#a0825b') +
      path('M29 23h38v12H29z', '#d0bd90') +
      path('M40 18v-7h16v7', 'none', '#bda57c', 3),
    'open',
    [23, 41],
  ),
  prop(
    'treetop-house',
    'seed-elevator',
    ['씨앗 승강기', 'Seed elevator', '种子升降机'],
    550,
    805,
    feet +
      path('M29 78V11h8v67m24 0V11h7v67M29 12h39M31 76h34', 'none', '#8f8258', 4) +
      path('M38 24h20v4H38z', '#ac9b70'),
    path('M38 53h20v17H38z', '#a38a57') +
      path('M48 26v27', 'none', '#d0bd91', 2) +
      ring(48, 61, 4, 6, '#748759'),
    'bounce',
    [48, 53],
  ),
  prop(
    'storm-lighthouse',
    'tide-recorder',
    ['조석 기록기', 'Tide recording station', '潮汐记录仪'],
    740,
    805,
    feet +
      path('M30 78V15h36v63z', '#6b8177') +
      ring(48, 35, 17, 20, '#c5c3a0') +
      path('M36 61h24v11H36z', '#344e4c') +
      path('M40 63v7m8-7v7m8-7v7', 'none', '#b9b794'),
    path('M48 35 58 22M48 35 42 43', 'none', '#786b4e', 3) + ring(48, 35, 3, 3, '#88734e'),
    'tick',
    [48, 35],
  ),
  prop(
    'canal-houseboat',
    'navigation-lock',
    ['운하 수문 모형', 'Canal lock model', '运河船闸模型'],
    85,
    805,
    feet +
      path('M23 51h50v25H23z', '#647d6b') +
      path('M28 56h40v12H28z', '#83a49c') +
      path('M34 52V19h28v33', 'none', '#a58d60', 4),
    path('M37 28h22v25H37z', '#937956') + path('M40 33h16m-16 7h16m-16 7h16', 'none', '#c6b187', 2),
    'press',
    [48, 52],
  ),
  prop(
    'cloud-airship',
    'pressure-harp',
    ['기압 하프', 'Pressure harp', '气压竖琴'],
    735,
    805,
    stand +
      path('M26 59V12q31-5 43 15v32z', 'none', '#ad9f71', 5) +
      path('M33 17v38m8-37v37m8-34v34m8-30v30m8-25v25', 'none', '#9bb5a2', 1),
    path('M37 37q11-9 22 0t-22 8', 'none', '#d5c493', 3),
    'flutter',
    [48, 38],
  ),
  prop(
    'wizard-library',
    'orrery',
    ['서고 천체의', 'Library orrery', '书库太阳系仪'],
    80,
    805,
    stand +
      ring(48, 36, 25, 21, '#344b4a', '#ad9670', 3) +
      ring(48, 36, 12, 25, 'none', '#8f9880', 2) +
      path('M25 36h46', 'none', '#8f9880', 2),
    ring(48, 36, 8, 8, '#d2b97e') + ring(66, 23, 5, 5, '#a38eaa') + ring(28, 41, 4, 4, '#88a597'),
    'orbit',
    [48, 36],
  ),
  prop(
    'dragon-study',
    'dragon-shrine',
    ['황동 용 제단', 'Brass dragon shrine', '黄铜龙神龛'],
    70,
    805,
    feet +
      path('M25 77V28h46v49zM22 28 48 11 74 28z', '#7a6e4d') +
      path('M31 35h34v35H31z', '#3e5345'),
    path('M34 62q-9-25 12-28l10-14 4 15 11 8-18 4q-17 0-10 12l15 5-6 7z', '#b2a06e') +
      ring(58, 39, 2, 2, '#d7c894'),
    'wobble',
    [48, 60],
  ),
  prop(
    'mushroom-teahouse',
    'terrarium',
    ['버섯 유리 정원', 'Mushroom terrarium', '蘑菇玻璃园'],
    735,
    805,
    feet +
      path('M25 73h46v7H25z', '#8d7958') +
      path('M26 70V38q0-25 22-25t22 25v32z', '#526d60', '#b1b995', 2) +
      path('M30 68q18-10 36 0v5H30z', '#7f8b60'),
    path('M43 65V44h10v21z', '#c3b38b') +
      path('M28 44q20-32 40 0z', '#b28368') +
      ring(42, 35, 3, 2, '#d9c8a2') +
      ring(55, 40, 3, 2, '#d9c8a2'),
    'bloom',
    [48, 65],
  ),
  prop(
    'moon-alchemy',
    'lunar-still',
    ['달 증류 장치', 'Lunar distillation machine', '月光蒸馏机'],
    60,
    805,
    stand +
      tube(38, 53, '#789b93') +
      path('M37 31V15h25v32', 'none', '#c4b68c', 3) +
      tube(62, 59, '#9d93a1') +
      path('M28 67h42', 'none', '#a38e68', 4),
    ring(38, 44, 6, 6, '#d2c895') + path('M55 22q8 3 1 9t3 8', 'none', '#c7d7b8', 2),
    'pour',
    [38, 35],
  ),
  prop(
    'spirit-tree',
    'root-lantern',
    ['정령 뿌리 등', 'Spirit root lantern', '精灵树根灯'],
    740,
    805,
    feet +
      path('M28 78q20-20 20-46V12m0 19 18-13M48 45 31 31', 'none', '#8e8b5e', 5) +
      path('M40 51h23v23H40z', '#68836a', '#b3b88a', 2),
    path('M47 68q-9-14 5-20 12 12 3 20z', '#ccd5a2') + path('M44 73h15', 'none', '#e0cf9d', 2),
    'glow',
    [52, 61],
  ),
  prop(
    'neon-loft',
    'neon-sculpture',
    ['네온 궤도 조각', 'Neon orbit sculpture', '霓虹轨道雕塑'],
    645,
    805,
    stand + path('M26 65V14h44v51z', '#34545b', '#81968c', 3),
    ring(48, 37, 15, 23, 'none', '#b29cab', 3) +
      ring(48, 37, 22, 10, 'none', '#94c2b7', 3) +
      ring(48, 37, 4, 4, '#d8bd9a'),
    'glow',
    [48, 37],
  ),
  prop(
    'midnight-jazz',
    'upright-bass',
    ['심야 콘트라베이스', 'Midnight double bass', '午夜低音提琴'],
    745,
    805,
    feet + path('M35 80h26m-13 0v-9M48 34V9', 'none', '#7b7150', 4),
    path('M40 32q-17 2-10 18-12 25 18 25t18-25q7-16-10-18z', '#9a7952') +
      path('M45 13h6v48h-6z', '#c0a479') +
      path('M48 18v51M37 47q-5 6 0 10m22-10q5 6 0 10', 'none', '#4c5544', 1.5),
    'wobble',
    [48, 74],
  ),
  prop(
    'museum-studio',
    'kinetic-ribbon',
    ['운동 리본 조각', 'Kinetic ribbon sculpture', '动态缎带雕塑'],
    745,
    805,
    feet + path('M29 59h38v21H29z', '#9aa28e') + path('M48 59V40', 'none', '#bcb995', 3),
    path('M30 17q35-17 34 7T35 47q-15-5 10-14t21-18', 'none', '#bdab87', 7) +
      ring(48, 34, 4, 4, '#7b9c92'),
    'spin',
    [48, 34],
  ),
  prop(
    'last-bookstore',
    'book-press',
    ['고서 제본 압착기', 'Antique binding press', '古籍装订压机'],
    70,
    805,
    feet +
      path('M26 23h44v8H26zM30 31v42m36-42v42M24 73h48v7H24z', 'none', '#a38b64', 4) +
      path('M33 62h30v10H33z', '#9a7860') +
      path('M35 65h26m-26 3h26', 'none', '#cbbd95', 1),
    path('M48 13v42m-12 0h24M35 13h26', 'none', '#c2b18b', 4),
    'press',
    [48, 31],
  ),
  prop(
    'rooftop-cinema',
    'film-rewinder',
    ['필름 되감기 스테이션', 'Film rewind station', '胶片倒片台'],
    745,
    705,
    feet +
      path('M26 65h44v13H26zM32 65V36m31 29V36', 'none', '#8c9d83', 4) +
      path('M25 66h46v8H25z', '#526e61'),
    ring(35, 30, 14, 18, '#7d8a72') +
      ring(63, 33, 12, 16, '#7d8a72') +
      ring(35, 30, 5, 7, '#35534e') +
      ring(63, 33, 4, 6, '#35534e') +
      path('M40 14 67 19M40 47l23 2', 'none', '#c3b98e', 2),
    'spin',
    [48, 32],
  ),
  prop(
    'waterfall-study',
    'rainfall-harp',
    ['물결 관측 하프', 'Cascade measuring harp', '瀑布测量竖琴'],
    170,
    805,
    feet +
      path('M28 79V15h40v64M23 16h50', 'none', '#8d9e7e', 4) +
      path('M35 22v47m9-47v47m9-47v47m9-47v47', 'none', '#8fb2a8', 2),
    path('M32 48q8-7 16 0t16 0M32 57q8-7 16 0t16 0', 'none', '#c0d2ad', 3),
    'ripple',
    [48, 50],
  ),
  prop(
    'underwater-library',
    'specimen-vault',
    ['심해 표본 보관함', 'Abyssal specimen vault', '深海标本柜'],
    600,
    805,
    cabinet +
      path('M29 45h38', 'none', '#b6ad83', 2) +
      tube(38, 37, '#86b1a2') +
      tube(58, 65, '#a2ac8c'),
    path('M49 21h17v21H49z', '#5b8b85') +
      ring(58, 31, 5, 7, '#b8b792') +
      path('M55 30h6m-3-3v6', 'none', '#6f8c76'),
    'open',
    [49, 31],
  ),
  prop(
    'rain-garden-dome',
    'rain-organ',
    ['빗방울 파이프 오르간', 'Rain pipe organ', '雨滴管风琴'],
    745,
    805,
    feet +
      path('M25 69h46v9H25zM28 69V30m10 39V16m10 53V9m10 60V22m10 47V38', 'none', '#8ca78c', 5) +
      path('M27 40h42', 'none', '#b7bd95', 2),
    ring(38, 31, 3, 5, '#c2d1ae') + ring(49, 23, 3, 5, '#c2d1ae') + ring(59, 35, 3, 5, '#c2d1ae'),
    'ripple',
    [48, 42],
  ),
  prop(
    'desert-rain',
    'armillary',
    ['사막 황동 혼천의', 'Desert brass armillary', '沙漠黄铜浑天仪'],
    260,
    805,
    stand + ring(48, 35, 24, 25, 'none', '#b69c6e', 3) + path('M48 60V11', 'none', '#bdac7c', 2),
    ring(48, 35, 24, 10, 'none', '#d4bd83', 3) +
      ring(48, 35, 10, 24, 'none', '#9ca986', 2) +
      ring(48, 35, 6, 6, '#c6a675'),
    'orbit',
    [48, 35],
  ),
  prop(
    'onsen-veranda',
    'steam-vessel',
    ['온천 증기 향로', 'Onsen steam vessel', '温泉蒸汽香炉'],
    285,
    812,
    feet +
      path('M29 57q19-11 38 0v18q-19 9-38 0z', '#8c8767') +
      path('M24 58h48M33 47v8m30-8v8', 'none', '#b9b38d', 3) +
      ring(48, 49, 20, 7, '#a7a381'),
    path('M36 40q-8-10 0-17m12 17q-8-17 0-29m12 29q-8-10 0-17', 'none', '#c9d4b7', 3),
    'steam',
    [48, 40],
  ),
  prop(
    'observatory',
    'stellar-recorder',
    ['별빛 기록 장치', 'Stellar chart recorder', '星光记录仪'],
    175,
    805,
    feet +
      path('M27 23h42v53H27z', '#6c8b85') +
      path('M32 29h32v32H32z', '#304f57') +
      path('M34 67h28v7H34z', '#b0b69a') +
      ring(48, 45, 12, 12, 'none', '#7da49c', 1),
    path('M48 33v24m-12-12h24M40 38l16 14', 'none', '#d1cfaa', 2) + ring(48, 45, 3, 3, '#d5bb85'),
    'tick',
    [48, 45],
  ),
  prop(
    'moon-base',
    'rover-instrument',
    ['달 탐사 계측차', 'Lunar instrument rover', '月球测量车'],
    515,
    805,
    feet +
      path('M24 55h48v18H24z', '#8da99d') +
      ring(30, 76, 8, 8, '#3c6061') +
      ring(66, 76, 8, 8, '#3c6061') +
      path('M48 54V17l15-6', 'none', '#b0c0a7', 3) +
      path('M30 58h32v7H30z', '#466f70'),
    path('M27 24q21 25 42 0z', '#b8c7ad') +
      path('M48 35v-15', 'none', '#d0cda3', 2) +
      ring(48, 18, 4, 4, '#b9ab83'),
    'tick',
    [48, 35],
  ),
  prop(
    'cloud-post',
    'postal-tube',
    ['구름 우편 송신기', 'Cloud postal transmitter', '云端邮件发送机'],
    70,
    805,
    feet +
      path('M29 78V17h38v61z', '#88977c') +
      path('M35 22h26v42H35z', '#476c65') +
      path('M31 69h34v7H31z', '#ad9b70') +
      path('M38 10h20v8H38z', '#c1b186'),
    path('M38 37h20v14H38z', '#d0c29c') + path('M38 37l10 8 10-8', 'none', '#8b916c', 1.5),
    'press',
    [48, 44],
  ),
  prop(
    'personal-roastery',
    'cupping-cabinet',
    ['커핑 향 보관함', 'Cupping aroma cabinet', '杯测香气柜'],
    745,
    560,
    cabinet +
      path('M28 40h40m-40 20h40', 'none', '#b2a27b', 2) +
      tube(37, 36, '#b79a75') +
      tube(58, 57, '#a2ad8b') +
      path('M31 66h31v5H31z', '#b5a079'),
    path('M50 21h16v17H50z', '#9e8762') + path('M55 25h6v10h-6z', '#c5b68c'),
    'open',
    [50, 29],
  ),
  prop(
    'memory-house',
    'memory-wardrobe',
    ['추억의 작은 장롱', 'Memory wardrobe', '回忆衣橱'],
    70,
    805,
    cabinet +
      path('M22 15q26-14 52 0z', '#a79069') +
      path('M29 21h38v52H29z', '#b3a183') +
      path('M48 21v52', 'none', '#837653', 2),
    path('M50 24h14v44H50z', '#998b6c') +
      ring(54, 46, 2, 2, '#ddc496') +
      path('M54 31h6v9h-6z', '#c6bca0'),
    'open',
    [50, 45],
  ),
  prop(
    'christmas-bookcafe',
    'advent-wheel',
    ['강림절 별바퀴', 'Advent star wheel', '降临节星轮'],
    95,
    805,
    stand + path('M30 58V22h36v36z', '#5c7153'),
    ring(48, 36, 21, 21, '#a38b58') + path('m48 16 5 13 14 7-14 5-5 15-5-15-14-5 14-7z', '#d2bb85'),
    'spin',
    [48, 36],
  ),
  prop(
    'sakura-teahouse',
    'incense-column',
    ['봄 향 기둥', 'Spring incense column', '春香柱'],
    745,
    540,
    feet +
      path('M35 77V23h26v54zM30 23 48 9 66 23z', '#85795b') +
      path('M40 31h16v25H40z', '#3d5b4d'),
    path('M44 53q-8-8 2-16t0-15m8 30q-6-7 1-13', 'none', '#d0c6a0', 2),
    'steam',
    [48, 53],
  ),
  prop(
    'newyear-attic',
    'wish-cabinet',
    ['소망 보관함', 'Wish archive cabinet', '心愿收藏柜'],
    735,
    560,
    cabinet +
      path('M31 24h13v42H31z', '#ad9d77') +
      path('M32 31h10m-10 7h10m-10 7h10', 'none', '#d1c39c'),
    path('M49 23h15v44H49z', '#a39068') +
      path('M52 31h8v12h-8z', '#c9c4a3') +
      ring(52, 53, 2, 2, '#d5ba83'),
    'open',
    [49, 45],
  ),
  prop(
    'cloud-airship',
    'wind-vane',
    ['비행선 풍향 조각', 'Airship wind vane', '飞艇风向雕塑'],
    70,
    805,
    feet + path('M48 79V14m-16 60h32', 'none', '#a2aa8b', 4),
    path('M24 30h48l-13-12v24l13-12M32 30 24 18v24z', '#bdac77') + ring(48, 30, 4, 4, '#d5c9a0'),
    'tick',
    [48, 30],
  ),
  prop(
    'wizard-library',
    'rune-lectern',
    ['룬 독서대', 'Rune lectern', '符文书台'],
    600,
    805,
    stand +
      path('M25 38 48 30 71 38v21l-23-8-23 8z', '#8b7860') +
      path('M48 30v21', 'none', '#d0b88c'),
    path('m31 42 6-4 6 4-6 6zM54 39l10 9m-10 0 10-9', 'none', '#c7c198', 2),
    'glow',
    [48, 44],
    2.2,
  ),
  prop(
    'mushroom-teahouse',
    'spore-chimes',
    ['포자 종탑', 'Spore chime tower', '孢子风铃塔'],
    75,
    805,
    feet + path('M48 78V13m-22 9q22-18 44 0M30 22v22m18-26v22m18-18v27', 'none', '#a8986c', 3),
    path('M24 44h12v17H24zM42 40h12v16H42zM60 49h12v17H60z', '#c0ab81') +
      ring(48, 66, 4, 5, '#a18f64'),
    'swing',
    [48, 22],
  ),
  prop(
    'museum-studio',
    'color-prism',
    ['색채 프리즘', 'Color prism exhibit', '色彩棱镜展品'],
    65,
    805,
    stand + path('M28 59 48 12 68 59z', '#71958c') + path('M48 12v47H28z', '#a79b85'),
    path('M48 21 62 55H48z', '#c5b598') + path('M33 52 45 28v24z', '#8d9bb3'),
    'glow',
    [48, 40],
  ),
  prop(
    'moon-base',
    'sample-auger',
    ['달 토양 시추기', 'Lunar sample auger', '月壤取样钻'],
    740,
    540,
    feet +
      path('M29 78V15h8v63m22 0V15h8v63M29 16h38', 'none', '#a9bc9f', 4) +
      path('M33 68h30v8H33z', '#5c8a80'),
    path('M48 19v43m-7-36 14 6-14 6 14 6-14 6 14 6', 'none', '#c7c9a2', 3),
    'spin',
    [48, 40],
  ),
  prop(
    'memory-house',
    'memory-quilt',
    ['추억 퀼트 액자', 'Memory quilt frame', '回忆拼布框'],
    635,
    805,
    feet + path('M26 79V15h44v64M32 15V9m32 6V9', 'none', '#9a8963', 4),
    path('M31 22h34v47H31z', '#b5a080') +
      path('M31 22h17v23H31zM48 45h17v24H48z', '#779785') +
      path('m36 33 7-6v13zM53 56l7-6v13z', '#d7bfa0'),
    'flutter',
    [48, 22],
  ),
  prop(
    'observatory',
    'comet-globe',
    ['혜성 궤도 구', 'Comet trajectory globe', '彗星轨道球'],
    735,
    805,
    stand +
      ring(48, 36, 25, 25, '#375962', '#a8bda6', 3) +
      ring(48, 36, 20, 10, 'none', '#729e97', 1),
    path('M31 46q26-40 34-14', 'none', '#d2c69f', 2) + ring(60, 27, 5, 4, '#d5c69b'),
    'orbit',
    [48, 36],
  ),
  prop(
    'cloud-post',
    'stamp-perforator',
    ['우표 천공기', 'Stamp perforating machine', '邮票打孔机'],
    735,
    560,
    feet +
      path('M28 78V25h40v53z', '#84906d') +
      path('M33 34h30v29H33z', '#d3c29b') +
      path('M37 41h8v12h-8zM51 41h8v12h-8z', '#8fa49a'),
    path('M32 24h32v7H32zM48 24V11h18', 'none', '#c3ab79', 4),
    'press',
    [48, 24],
  ),
  prop(
    'cloud-post',
    'parcel-scale',
    ['소포 저울', 'Parcel weighing station', '包裹称重站'],
    250,
    805,
    feet +
      path('M34 77V41h28v36z', '#9e9270') +
      ring(48, 57, 12, 12, '#d0c8a3') +
      path('M26 36h44v8H26z', '#b9af8c'),
    path('M48 57 55 49', 'none', '#576f60', 2) +
      path('M34 14h28v20H34z', '#c5ae81') +
      path('M48 14v20M34 19h28', 'none', '#8b805e', 2),
    'tick',
    [48, 57],
  ),
]
