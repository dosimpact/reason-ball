// Artwork-owned geometry: matching apertures are shared by the rear scene and CSS rain layer.
export type PremiumGeometry = {
  opening: string
  frames: string
  kind: string
  wall: string
  floor: string
  trim: string
  light: [number, number][]
}
const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}H${x}Z`
const arch = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y + h}V${y + w / 2}Q${x} ${y} ${x + w / 2} ${y}T${x + w} ${y + w / 2}V${y + h}Z`
const oval = (x: number, y: number, rx: number, ry: number) =>
  `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`
const room = (
  kind: string,
  opening: string,
  frames: string,
  wall: string,
  floor: string,
  trim: string,
  light: [number, number][],
): PremiumGeometry => ({ kind, opening, frames, wall, floor, trim, light })
export const PREMIUM_GEOMETRY: Record<string, PremiumGeometry> = {
  'premium-christmas-bookcafe': room(
    'holiday-arches',
    arch(80, 105, 290, 445) + ' ' + arch(420, 105, 290, 445),
    'M225 105V550M565 105V550',
    '#282923',
    '#665039',
    '#8f7855',
    [
      [130, 160],
      [670, 160],
    ],
  ),
  'premium-halloween-greenhouse': room(
    'pointed-glass',
    'M70 560V220L240 70 400 15 560 70 730 220V560Z',
    'M70 320H730M240 70V560M400 15V560M560 70V560',
    '#262b28',
    '#554b39',
    '#66715c',
    [[400, 190]],
  ),
  'premium-sakura-teahouse': room(
    'shoji',
    rect(140, 110, 520, 430),
    'M270 110V540M400 110V540M530 110V540M140 255H660M140 400H660',
    '#36382d',
    '#8a7657',
    '#9d9479',
    [
      [100, 230],
      [700, 230],
    ],
  ),
  'premium-autumn-lake': room(
    'lake-panorama',
    'M55 555V245Q400-30 745 245V555Z',
    'M290 100V555M520 100V555',
    '#332d26',
    '#69513b',
    '#897453',
    [[620, 170]],
  ),
  'premium-newyear-attic': room(
    'attic',
    'M130 440 215 90 570 90 705 440Z',
    'M392 90V440M170 290H650',
    '#302e2a',
    '#6c5741',
    '#9e855a',
    [
      [165, 465],
      [650, 480],
    ],
  ),
  'premium-orient-express': room(
    'train-cabins',
    arch(55, 150, 205, 350) + ' ' + arch(300, 150, 205, 350) + ' ' + arch(545, 150, 205, 350),
    'M55 340H750',
    '#292a28',
    '#5b4434',
    '#a38d5e',
    [
      [280, 150],
      [525, 150],
    ],
  ),
  'premium-treetop-house': room(
    'tree-hexagon',
    'M130 235 400 70 670 235 670 525 130 525Z',
    'M400 70V525M130 350H670',
    '#2c3526',
    '#776044',
    '#827251',
    [
      [105, 295],
      [695, 295],
    ],
  ),
  'premium-storm-lighthouse': room(
    'lighthouse-panorama',
    arch(105, 55, 590, 530),
    'M400 55V585M105 350H695',
    '#343d3a',
    '#6a6856',
    '#9b9f88',
    [
      [55, 270],
      [745, 270],
    ],
  ),
  'premium-canal-houseboat': room(
    'boat-wide',
    'M50 170Q400 75 750 170V505H50Z',
    'M260 135V505M535 135V505',
    '#3c3a2b',
    '#6b563d',
    '#a39163',
    [
      [160, 180],
      [640, 180],
    ],
  ),
  'premium-cloud-airship': room(
    'airship-oval',
    oval(400, 310, 338, 235),
    'M400 75V545M65 310H735',
    '#303d3b',
    '#6c7163',
    '#a4ac96',
    [
      [105, 220],
      [695, 220],
    ],
  ),
  'premium-wizard-library': room(
    'gothic',
    'M95 550V250Q95 125 220 70 345 125 345 250V550Z M455 550V250Q455 125 580 70 705 125 705 250V550Z',
    'M220 70V550M580 70V550',
    '#2b2931',
    '#675443',
    '#8b7c60',
    [[400, 200]],
  ),
  'premium-dragon-study': room(
    'cavern',
    'M110 550 85 405 155 230 260 130 420 90 595 190 710 360 675 550Z',
    'M400 100V550',
    '#332f2a',
    '#756247',
    '#9a8764',
    [
      [110, 330],
      [690, 330],
    ],
  ),
  'premium-mushroom-teahouse': room(
    'mushroom-round',
    oval(400, 300, 270, 225),
    'M130 300H670M400 75V525',
    '#383a2c',
    '#817255',
    '#a3a485',
    [
      [105, 280],
      [695, 280],
    ],
  ),
  'premium-moon-alchemy': room(
    'alchemy-arch',
    arch(190, 75, 420, 480),
    'M400 75V555M190 320H610',
    '#292e39',
    '#5d5e5a',
    '#939c92',
    [
      [95, 260],
      [705, 260],
    ],
  ),
  'premium-spirit-tree': room(
    'tree-hollow',
    'M140 565Q45 440 140 250L235 105 390 65 550 105 670 300Q745 445 660 565Z',
    'M397 70V565',
    '#26382e',
    '#6c6247',
    '#819976',
    [
      [115, 355],
      [685, 355],
    ],
  ),
  'premium-neon-loft': room(
    'loft-corner',
    'M35 100 475 65 475 545 35 580Z M500 65 765 145 765 580 500 545Z',
    'M180 90V570M330 78V555M620 100V563M35 320 765 345',
    '#252c35',
    '#555455',
    '#6b8190',
    [
      [140, 155],
      [655, 180],
    ],
  ),
  'premium-midnight-jazz': room(
    'jazz-arches',
    arch(70, 125, 180, 390) + ' ' + arch(310, 125, 180, 390) + ' ' + arch(550, 125, 180, 390),
    '',
    '#2b2730',
    '#71543e',
    '#967d56',
    [
      [130, 170],
      [670, 170],
    ],
  ),
  'premium-museum-studio': room(
    'clerestory',
    'M65 150 400 55 735 150V420H65Z',
    'M200 110V420M400 55V420M600 110V420M65 280H735',
    '#3e4039',
    '#8c8269',
    '#afb19c',
    [
      [125, 300],
      [715, 280],
    ],
  ),
  'premium-last-bookstore': room(
    'storefront',
    'M60 155H285V545H60Z M320 105H480V570H320Z M515 155H740V545H515Z',
    'M60 315H285M515 315H740M320 325H480',
    '#322c25',
    '#72573d',
    '#937b56',
    [[400, 175]],
  ),
  'premium-rooftop-cinema': room(
    'roof-pergola',
    'M0 160H800V565H0Z',
    'M70 160V565M730 160V565',
    '#242c31',
    '#645b45',
    '#7f8e7e',
    [
      [145, 185],
      [665, 185],
    ],
  ),
  'premium-waterfall-study': room(
    'waterfall-corner',
    'M55 100H490V555H55Z M520 160 745 95V555H520Z',
    'M275 100V555M55 320H490M630 125V555',
    '#2e3c37',
    '#67745d',
    '#91a28c',
    [[110, 210]],
  ),
  'premium-underwater-library': room(
    'pressure-window',
    oval(425, 290, 325, 205),
    'M425 85V495',
    '#20373b',
    '#536b66',
    '#92b3a5',
    [
      [90, 320],
      [710, 320],
    ],
  ),
  'premium-rain-garden-dome': room(
    'botanical-dome',
    'M65 590V350Q65 45 400 45T735 350V590Z',
    'M400 45V590M155 590Q95 255 400 45M645 590Q705 255 400 45M78 330H722',
    '#263a2e',
    '#6a7056',
    '#8fa78b',
    [[400, 200]],
  ),
  'premium-desert-rain': room(
    'horseshoe',
    'M145 560V315Q70 220 210 125L400 55 590 125Q730 220 655 315V560Z',
    'M400 55V560',
    '#494132',
    '#9b815c',
    '#c0af86',
    [
      [105, 360],
      [695, 360],
    ],
  ),
  'premium-onsen-veranda': room(
    'onsen-open',
    rect(0, 155, 800, 385),
    'M75 155V550M725 155V550',
    '#31372c',
    '#7c6b4e',
    '#a7a582',
    [
      [150, 170],
      [650, 170],
    ],
  ),
  'premium-observatory': room(
    'observatory-round',
    oval(400, 290, 277, 240),
    'M400 50V530M123 290H677',
    '#2d303d',
    '#666777',
    '#a4a5b2',
    [
      [85, 350],
      [715, 350],
    ],
  ),
  'premium-moon-base': room(
    'lunar-viewport',
    'M135 110H665L750 235V470L655 545H145L50 470V235Z',
    'M400 110V545M50 330H750',
    '#293d43',
    '#627b7b',
    '#a8c2b7',
    [
      [145, 150],
      [650, 150],
    ],
  ),
  'premium-cloud-post': room(
    'post-tower',
    arch(105, 90, 245, 440) + ' ' + arch(450, 90, 245, 440),
    'M227 90V530M572 90V530',
    '#353a33',
    '#827155',
    '#a9a182',
    [[400, 180]],
  ),
  'premium-personal-roastery': room(
    'roastery-industrial',
    rect(45, 105, 710, 410),
    'M225 105V515M405 105V515M585 105V515M45 275H755',
    '#302c29',
    '#71604b',
    '#9c8a6d',
    [
      [145, 155],
      [665, 155],
    ],
  ),
  'premium-memory-house': room(
    'domestic-bay',
    'M105 150 305 100H495L695 150V525H105Z',
    'M305 100V525M495 100V525M105 325H695',
    '#3b3931',
    '#897353',
    '#ad9c7a',
    [[650, 435]],
  ),
}
export function premiumGeometry(id: string) {
  return PREMIUM_GEOMETRY[id] ?? PREMIUM_GEOMETRY['premium-christmas-bookcafe']
}
