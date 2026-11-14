/** Dominant actual compiled BODYLESS core edge materials. CPU sampled; no world joinery or image padding. Sky is an aperture-region palette, used only by open envelopes. Lower bands are statistical candidates, not semantic legs. */
export type SceneEdgeBand = { x: number; width: number; color: string }
export type SceneEdgeMaterials = {
  upper: string
  lower: string
  left: string
  right: string
  sky?: string
  upperFrames?: SceneEdgeBand[]
  lowerSupports?: SceneEdgeBand[]
}
export const SCENE_EDGE_MATERIALS: Record<string, SceneEdgeMaterials> = {
  'cafe-rain': {
    upper: '#162b33',
    lower: '#20221b',
    left: '#232923',
    right: '#1e2921',
    sky: '#1a2d32',
    upperFrames: [
      {
        x: 38,
        width: 21,
        color: '#313b34',
      },
      {
        x: 354,
        width: 20,
        color: '#303a34',
      },
      {
        x: 690,
        width: 19,
        color: '#3a4035',
      },
    ],
  },
  'cafe-alley': {
    upper: '#272221',
    lower: '#47382f',
    left: '#272221',
    right: '#2a2523',
    sky: '#162421',
    upperFrames: [
      {
        x: 399,
        width: 3,
        color: '#434336',
      },
    ],
  },
  'cafe-greenhouse': {
    upper: '#223028',
    lower: '#554a3b',
    left: '#223028',
    right: '#233129',
    sky: '#2a4639',
    lowerSupports: [
      {
        x: 146,
        width: 18,
        color: '#223028',
      },
      {
        x: 636,
        width: 18,
        color: '#243229',
      },
    ],
    upperFrames: [
      {
        x: 404,
        width: 3,
        color: '#434336',
      },
    ],
  },
  'cafe-rooftop': {
    upper: '#1e272c',
    lower: '#434642',
    left: '#1e272c',
    right: '#1e272c',
    sky: '#233334',
    lowerSupports: [
      {
        x: 132,
        width: 9,
        color: '#1e272c',
      },
      {
        x: 204,
        width: 9,
        color: '#1e272c',
      },
      {
        x: 587,
        width: 9,
        color: '#21292d',
      },
      {
        x: 659,
        width: 9,
        color: '#1e272c',
      },
    ],
  },
  'cafe-seaside': {
    upper: '#222f31',
    lower: '#524a3e',
    left: '#222f31',
    right: '#222f31',
    sky: '#2d3c39',
    lowerSupports: [
      {
        x: 146,
        width: 18,
        color: '#222f31',
      },
      {
        x: 636,
        width: 18,
        color: '#243032',
      },
    ],
    upperFrames: [
      {
        x: 62,
        width: 4,
        color: '#344142',
      },
      {
        x: 126,
        width: 4,
        color: '#344142',
      },
      {
        x: 143,
        width: 5,
        color: '#827760',
      },
      {
        x: 190,
        width: 4,
        color: '#344142',
      },
      {
        x: 254,
        width: 4,
        color: '#344142',
      },
      {
        x: 318,
        width: 4,
        color: '#344142',
      },
      {
        x: 382,
        width: 4,
        color: '#344142',
      },
      {
        x: 653,
        width: 5,
        color: '#827760',
      },
    ],
  },
  'study-fire': {
    upper: '#28221e',
    lower: '#4a392a',
    left: '#28221e',
    right: '#29231e',
    sky: '#233335',
    lowerSupports: [
      {
        x: 146,
        width: 18,
        color: '#28221e',
      },
      {
        x: 636,
        width: 18,
        color: '#2a241e',
      },
    ],
  },
  'study-attic': {
    upper: '#2b2f27',
    lower: '#554937',
    left: '#2b2f27',
    right: '#2b2f27',
    sky: '#2b3c3a',
  },
  'study-library': {
    upper: '#222724',
    lower: '#4a3d2c',
    left: '#222724',
    right: '#222724',
    sky: '#333529',
    lowerSupports: [
      {
        x: 132,
        width: 9,
        color: '#222724',
      },
      {
        x: 204,
        width: 9,
        color: '#232724',
      },
      {
        x: 587,
        width: 9,
        color: '#252925',
      },
      {
        x: 659,
        width: 9,
        color: '#232724',
      },
    ],
    upperFrames: [
      {
        x: 399,
        width: 3,
        color: '#434336',
      },
    ],
  },
  'study-city': {
    upper: '#232d31',
    lower: '#44463c',
    left: '#232d31',
    right: '#242e31',
    sky: '#233334',
    lowerSupports: [
      {
        x: 146,
        width: 18,
        color: '#232d31',
      },
      {
        x: 636,
        width: 18,
        color: '#242e32',
      },
    ],
  },
  'study-moon': {
    upper: '#24282e',
    lower: '#433e3a',
    left: '#24282e',
    right: '#25292e',
    sky: '#344a4b',
  },
  'forest-mist': {
    upper: '#1f2f27',
    lower: '#5c4a35',
    left: '#1f2f27',
    right: '#223229',
    sky: '#223532',
    lowerSupports: [
      {
        x: 236,
        width: 18,
        color: '#223128',
      },
      {
        x: 546,
        width: 18,
        color: '#233329',
      },
    ],
    upperFrames: [
      {
        x: 62,
        width: 4,
        color: '#2d3f35',
      },
      {
        x: 126,
        width: 4,
        color: '#2d3f35',
      },
      {
        x: 190,
        width: 4,
        color: '#2d3f35',
      },
      {
        x: 254,
        width: 4,
        color: '#2d3f35',
      },
      {
        x: 318,
        width: 4,
        color: '#2d3f35',
      },
      {
        x: 382,
        width: 4,
        color: '#2d3f35',
      },
      {
        x: 446,
        width: 4,
        color: '#2d3f35',
      },
      {
        x: 510,
        width: 4,
        color: '#2d3f35',
      },
    ],
  },
  'forest-cabin': {
    upper: '#2b2720',
    lower: '#564531',
    left: '#2b2720',
    right: '#2d2a21',
    sky: '#1a2e29',
    lowerSupports: [
      {
        x: 132,
        width: 9,
        color: '#2b2820',
      },
      {
        x: 204,
        width: 9,
        color: '#2c2920',
      },
      {
        x: 587,
        width: 9,
        color: '#2e2a21',
      },
      {
        x: 659,
        width: 9,
        color: '#2c2921',
      },
    ],
    upperFrames: [
      {
        x: 658,
        width: 4,
        color: '#434337',
      },
    ],
  },
  'forest-fireflies': {
    upper: '#1b2724',
    lower: '#3a4134',
    left: '#1b2724',
    right: '#1b2724',
    sky: '#1a2d29',
  },
  'forest-bamboo': {
    upper: '#253127',
    lower: '#5b5236',
    left: '#253127',
    right: '#253127',
    sky: '#233a32',
    lowerSupports: [
      {
        x: 236,
        width: 18,
        color: '#273328',
      },
      {
        x: 546,
        width: 18,
        color: '#293428',
      },
    ],
    upperFrames: [
      {
        x: 599,
        width: 3,
        color: '#434337',
      },
    ],
  },
  'forest-autumn': {
    upper: '#342c22',
    lower: '#654b35',
    left: '#342c22',
    right: '#352d23',
    sky: '#6c4c34',
    lowerSupports: [
      {
        x: 241,
        width: 9,
        color: '#362d24',
      },
      {
        x: 313,
        width: 8,
        color: '#382f24',
      },
      {
        x: 479,
        width: 8,
        color: '#383024',
      },
      {
        x: 550,
        width: 8,
        color: '#382f24',
      },
    ],
    upperFrames: [
      {
        x: 62,
        width: 4,
        color: '#473d2e',
      },
      {
        x: 126,
        width: 4,
        color: '#473d2e',
      },
      {
        x: 190,
        width: 4,
        color: '#473d2e',
      },
      {
        x: 254,
        width: 4,
        color: '#473d2e',
      },
      {
        x: 318,
        width: 4,
        color: '#473d2e',
      },
      {
        x: 382,
        width: 4,
        color: '#473d2e',
      },
      {
        x: 446,
        width: 4,
        color: '#473d2e',
      },
      {
        x: 510,
        width: 4,
        color: '#473d2e',
      },
    ],
  },
  'water-moon': {
    upper: '#3a423d',
    lower: '#645e50',
    left: '#254147',
    right: '#284448',
    sky: '#34423c',
    lowerSupports: [
      {
        x: 249,
        width: 6,
        color: '#3c433d',
      },
      {
        x: 258,
        width: 26,
        color: '#3d443e',
      },
      {
        x: 516,
        width: 4,
        color: '#3e453e',
      },
      {
        x: 523,
        width: 28,
        color: '#3e453e',
      },
    ],
  },
  'water-lake': {
    upper: '#35423d',
    lower: '#61614b',
    left: '#354d4b',
    right: '#60604b',
    sky: '#2b3c3a',
    upperFrames: [
      {
        x: 62,
        width: 4,
        color: '#48544b',
      },
      {
        x: 126,
        width: 4,
        color: '#48544b',
      },
      {
        x: 190,
        width: 4,
        color: '#48544b',
      },
      {
        x: 254,
        width: 4,
        color: '#48544b',
      },
      {
        x: 318,
        width: 4,
        color: '#48544b',
      },
      {
        x: 382,
        width: 4,
        color: '#48544b',
      },
      {
        x: 446,
        width: 4,
        color: '#48544b',
      },
      {
        x: 510,
        width: 4,
        color: '#48544b',
      },
    ],
  },
  'water-stream': {
    upper: '#273834',
    lower: '#4e5442',
    left: '#273834',
    right: '#2b3b35',
    sky: '#1a2d29',
    lowerSupports: [
      {
        x: 249,
        width: 6,
        color: '#2a3a34',
      },
      {
        x: 258,
        width: 26,
        color: '#2a3a35',
      },
      {
        x: 516,
        width: 4,
        color: '#2c3b35',
      },
      {
        x: 523,
        width: 28,
        color: '#2c3b35',
      },
    ],
  },
  'water-harbor': {
    upper: '#232f35',
    lower: '#444944',
    left: '#232f35',
    right: '#253236',
    sky: '#2d3c39',
    lowerSupports: [
      {
        x: 241,
        width: 9,
        color: '#253135',
      },
      {
        x: 313,
        width: 8,
        color: '#273336',
      },
      {
        x: 479,
        width: 8,
        color: '#283336',
      },
      {
        x: 550,
        width: 9,
        color: '#273336',
      },
    ],
    upperFrames: [
      {
        x: 619,
        width: 5,
        color: '#3d423c',
      },
    ],
  },
  'water-falls': {
    upper: '#2e3e37',
    lower: '#5d5e4a',
    left: '#2e3e37',
    right: '#5c5d4a',
    sky: '#344438',
    lowerSupports: [
      {
        x: 236,
        width: 18,
        color: '#313f38',
      },
      {
        x: 546,
        width: 18,
        color: '#324139',
      },
    ],
  },
  'travel-train': {
    upper: '#2b2e2d',
    lower: '#574e3e',
    left: '#2b2e2d',
    right: '#2b2e2d',
    sky: '#2b3c3a',
  },
  'travel-tent': {
    upper: '#2f3428',
    lower: '#645338',
    left: '#2f3428',
    right: '#32362a',
    sky: '#2b3c3a',
    lowerSupports: [
      {
        x: 241,
        width: 9,
        color: '#323529',
      },
      {
        x: 313,
        width: 8,
        color: '#33372a',
      },
      {
        x: 479,
        width: 8,
        color: '#34372b',
      },
      {
        x: 550,
        width: 9,
        color: '#33372a',
      },
    ],
    upperFrames: [
      {
        x: 398,
        width: 4,
        color: '#434337',
      },
    ],
  },
  'travel-van': {
    upper: '#2b342f',
    lower: '#52594a',
    left: '#2b342f',
    right: '#2e3631',
    sky: '#1a2d28',
  },
  'travel-lodge': {
    upper: '#2d2720',
    lower: '#59422c',
    left: '#2d2720',
    right: '#56402b',
    sky: '#aeb09c',
    lowerSupports: [
      {
        x: 132,
        width: 9,
        color: '#2d2720',
      },
      {
        x: 204,
        width: 9,
        color: '#2e2720',
      },
      {
        x: 587,
        width: 9,
        color: '#312921',
      },
      {
        x: 659,
        width: 9,
        color: '#2e2720',
      },
    ],
    upperFrames: [
      {
        x: 163,
        width: 4,
        color: '#434336',
      },
    ],
  },
  'travel-stars': {
    upper: '#25282f',
    lower: '#444645',
    left: '#25282f',
    right: '#25282f',
    sky: '#2b3c3a',
    lowerSupports: [
      {
        x: 236,
        width: 18,
        color: '#272b31',
      },
      {
        x: 546,
        width: 18,
        color: '#292b31',
      },
    ],
  },
  'garden-hanok': {
    upper: '#2b2f23',
    lower: '#6a5c3e',
    left: '#2b2f23',
    right: '#2d3224',
    sky: '#2a3e35',
    lowerSupports: [
      {
        x: 142,
        width: 26,
        color: '#2b3024',
      },
      {
        x: 632,
        width: 26,
        color: '#2d3124',
      },
    ],
    upperFrames: [
      {
        x: 599,
        width: 3,
        color: '#434337',
      },
    ],
  },
  'garden-court': {
    upper: '#373e3a',
    lower: '#6a6854',
    left: '#373e3a',
    right: '#3b413b',
    sky: '#434537',
  },
  'garden-glass': {
    upper: '#2b3c33',
    lower: '#61614b',
    left: '#2b3c33',
    right: '#2c3d33',
    sky: '#2b4337',
    lowerSupports: [
      {
        x: 146,
        width: 18,
        color: '#2b3c33',
      },
      {
        x: 636,
        width: 18,
        color: '#2d3d34',
      },
    ],
    upperFrames: [
      {
        x: 399,
        width: 3,
        color: '#434337',
      },
    ],
  },
  'garden-lotus': {
    upper: '#2a3c36',
    lower: '#676146',
    left: '#2a3c36',
    right: '#2b3d36',
    sky: '#2d4940',
    lowerSupports: [
      {
        x: 232,
        width: 26,
        color: '#2c3d36',
      },
      {
        x: 542,
        width: 26,
        color: '#2e3f37',
      },
    ],
    upperFrames: [
      {
        x: 62,
        width: 4,
        color: '#3c4e45',
      },
      {
        x: 126,
        width: 4,
        color: '#3c4e45',
      },
      {
        x: 190,
        width: 7,
        color: '#3f493f',
      },
      {
        x: 254,
        width: 4,
        color: '#3c4e45',
      },
      {
        x: 318,
        width: 4,
        color: '#3c4e45',
      },
      {
        x: 382,
        width: 4,
        color: '#3c4e45',
      },
      {
        x: 446,
        width: 4,
        color: '#3c4e45',
      },
      {
        x: 510,
        width: 4,
        color: '#3c4e45',
      },
    ],
  },
  'garden-snow': {
    upper: '#3c433d',
    lower: '#6a6e5d',
    left: '#3c433d',
    right: '#3d443d',
    sky: '#233435',
  },
  'study-linen': {
    upper: '#424237',
    lower: '#72654a',
    left: '#424237',
    right: '#424237',
    sky: '#233435',
    lowerSupports: [
      {
        x: 146,
        width: 18,
        color: '#424237',
      },
      {
        x: 636,
        width: 18,
        color: '#434338',
      },
    ],
  },
  'forest-pine-fireflies': {
    upper: '#22372d',
    lower: '#5a4e39',
    left: '#22372d',
    right: '#25392e',
    sky: '#3c6150',
    lowerSupports: [
      {
        x: 146,
        width: 18,
        color: '#23382d',
      },
      {
        x: 636,
        width: 18,
        color: '#24392e',
      },
    ],
    upperFrames: [
      {
        x: 142,
        width: 4,
        color: '#434337',
      },
    ],
  },
  'study-granite': {
    upper: '#35423e',
    lower: '#686a5e',
    left: '#35423e',
    right: '#35423e',
    sky: '#4b5652',
    lowerSupports: [
      {
        x: 140,
        width: 35,
        color: '#374440',
      },
      {
        x: 625,
        width: 35,
        color: '#394541',
      },
    ],
  },
  'water-harbor-deep': {
    upper: '#1e373e',
    lower: '#3d5452',
    left: '#1e373e',
    right: '#22393e',
    sky: '#1b3c40',
    lowerSupports: [
      {
        x: 132,
        width: 9,
        color: '#1f383e',
      },
      {
        x: 204,
        width: 9,
        color: '#20393e',
      },
      {
        x: 587,
        width: 9,
        color: '#223a3f',
      },
      {
        x: 659,
        width: 9,
        color: '#20393e',
      },
    ],
  },
  'water-velvet-tide': {
    upper: '#36423e',
    lower: '#6b6a53',
    left: '#405c5b',
    right: '#425d5b',
    sky: '#233435',
    lowerSupports: [
      {
        x: 236,
        width: 18,
        color: '#38433e',
      },
      {
        x: 546,
        width: 18,
        color: '#39443e',
      },
    ],
    upperFrames: [
      {
        x: 62,
        width: 4,
        color: '#4b554d',
      },
      {
        x: 126,
        width: 4,
        color: '#4b554d',
      },
      {
        x: 190,
        width: 4,
        color: '#4b554d',
      },
      {
        x: 254,
        width: 4,
        color: '#4b554d',
      },
      {
        x: 318,
        width: 4,
        color: '#4b554d',
      },
      {
        x: 382,
        width: 4,
        color: '#4b554d',
      },
      {
        x: 446,
        width: 4,
        color: '#4b554d',
      },
      {
        x: 510,
        width: 4,
        color: '#4b554d',
      },
    ],
  },
  'cafe-barista-long-table': {
    upper: '#26261d',
    lower: '#322c20',
    left: '#26261d',
    right: '#26261d',
    sky: '#1e3236',
    upperFrames: [
      {
        x: 163,
        width: 4,
        color: '#554630',
      },
      {
        x: 648,
        width: 4,
        color: '#554630',
      },
    ],
  },
  'cafe-rain-dome': {
    upper: '#242722',
    lower: '#4c422e',
    left: '#605946',
    right: '#605946',
    sky: '#1d3337',
    upperFrames: [
      {
        x: 398,
        width: 4,
        color: '#554630',
      },
    ],
  },
  'cafe-neon-night': {
    upper: '#1d2931',
    lower: '#3c4343',
    left: '#1d2931',
    right: '#1d2a31',
    sky: '#1b2c33',
    lowerSupports: [
      {
        x: 132,
        width: 9,
        color: '#1d2931',
      },
      {
        x: 204,
        width: 9,
        color: '#1e2a31',
      },
      {
        x: 587,
        width: 9,
        color: '#202c32',
      },
      {
        x: 659,
        width: 9,
        color: '#1e2a32',
      },
    ],
  },
  'premium-christmas-bookcafe': {
    upper: '#282923',
    lower: '#665039',
    left: '#292a23',
    right: '#292a23',
    sky: '#325245',
    upperFrames: [
      {
        x: 127,
        width: 6,
        color: '#b8a476',
      },
      {
        x: 667,
        width: 6,
        color: '#b8a476',
      },
    ],
  },
  'premium-halloween-greenhouse': {
    upper: '#262b28',
    lower: '#554b39',
    left: '#262b28',
    right: '#262b28',
    sky: '#263d39',
    upperFrames: [
      {
        x: 382,
        width: 31,
        color: '#69735d',
      },
      {
        x: 680,
        width: 3,
        color: '#a49974',
      },
      {
        x: 747,
        width: 3,
        color: '#a49974',
      },
    ],
  },
  'premium-sakura-teahouse': {
    upper: '#2e3026',
    lower: '#8a7657',
    left: '#2e3026',
    right: '#2e3026',
    sky: '#2e494a',
    upperFrames: [
      {
        x: 99,
        width: 3,
        color: '#8f876e',
      },
      {
        x: 699,
        width: 3,
        color: '#8f876e',
      },
    ],
  },
  'premium-autumn-lake': {
    upper: '#332d26',
    lower: '#69513b',
    left: '#332d26',
    right: '#332d26',
    sky: '#8d6c40',
    lowerSupports: [
      {
        x: 300,
        width: 4,
        color: '#879079',
      },
      {
        x: 336,
        width: 4,
        color: '#879079',
      },
    ],
    upperFrames: [
      {
        x: 618,
        width: 4,
        color: '#8e7e5f',
      },
    ],
  },
  'premium-newyear-attic': {
    upper: '#302e2a',
    lower: '#6c5741',
    left: '#5b5140',
    right: '#5b5140',
    sky: '#302e2a',
  },
  'premium-orient-express': {
    upper: '#2a2b28',
    lower: '#493c43',
    left: '#292a28',
    right: '#292a28',
    sky: '#344c4a',
    lowerSupports: [
      {
        x: 380,
        width: 4,
        color: '#879079',
      },
      {
        x: 385,
        width: 30,
        color: '#4e594c',
      },
      {
        x: 416,
        width: 4,
        color: '#879079',
      },
    ],
  },
  'premium-treetop-house': {
    upper: '#2c3526',
    lower: '#776044',
    left: '#2c3526',
    right: '#2c3526',
    sky: '#35583f',
    upperFrames: [
      {
        x: 103,
        width: 4,
        color: '#8c8b6a',
      },
      {
        x: 638,
        width: 3,
        color: '#a49974',
      },
      {
        x: 693,
        width: 4,
        color: '#8c8b6a',
      },
      {
        x: 709,
        width: 3,
        color: '#a49974',
      },
    ],
  },
  'premium-storm-lighthouse': {
    upper: '#343d3a',
    lower: '#6a6856',
    left: '#343d3a',
    right: '#343d3a',
    sky: '#1e3940',
    lowerSupports: [
      {
        x: 161,
        width: 16,
        color: '#605640',
      },
      {
        x: 249,
        width: 4,
        color: '#605640',
      },
      {
        x: 404,
        width: 4,
        color: '#605640',
      },
      {
        x: 559,
        width: 20,
        color: '#605640',
      },
    ],
    upperFrames: [
      {
        x: 158,
        width: 4,
        color: '#8c8b6a',
      },
      {
        x: 638,
        width: 4,
        color: '#8c8b6a',
      },
    ],
  },
  'premium-canal-houseboat': {
    upper: '#3c3a2b',
    lower: '#6b563d',
    left: '#3c3a2b',
    right: '#3c3a2b',
    sky: '#36575a',
    upperFrames: [
      {
        x: 158,
        width: 4,
        color: '#8e7e5f',
      },
      {
        x: 638,
        width: 4,
        color: '#8e7e5f',
      },
    ],
  },
  'premium-cloud-airship': {
    upper: '#293432',
    lower: '#6c7163',
    left: '#303d3b',
    right: '#293432',
    sky: '#223d43',
    upperFrames: [
      {
        x: 103,
        width: 4,
        color: '#8e7e5f',
      },
      {
        x: 693,
        width: 4,
        color: '#8e7e5f',
      },
    ],
  },
  'premium-wizard-library': {
    upper: '#2b2931',
    lower: '#493c43',
    left: '#3e3b2d',
    right: '#3e3b2d',
    sky: '#3c4450',
    lowerSupports: [
      {
        x: 380,
        width: 4,
        color: '#879079',
      },
      {
        x: 385,
        width: 30,
        color: '#4e594c',
      },
      {
        x: 416,
        width: 4,
        color: '#879079',
      },
    ],
    upperFrames: [
      {
        x: 398,
        width: 4,
        color: '#8c8b6a',
      },
    ],
  },
  'premium-dragon-study': {
    upper: '#332f2a',
    lower: '#756247',
    left: '#666755',
    right: '#666755',
    sky: '#2e4948',
    upperFrames: [
      {
        x: 108,
        width: 4,
        color: '#8c8b6a',
      },
      {
        x: 688,
        width: 4,
        color: '#8c8b6a',
      },
    ],
  },
  'premium-mushroom-teahouse': {
    upper: '#383a2c',
    lower: '#817255',
    left: '#393b2c',
    right: '#393b2c',
    sky: '#41583e',
    upperFrames: [
      {
        x: 103,
        width: 4,
        color: '#8f876e',
      },
      {
        x: 693,
        width: 4,
        color: '#8f876e',
      },
    ],
  },
  'premium-moon-alchemy': {
    upper: '#292e39',
    lower: '#5d5e5a',
    left: '#292e39',
    right: '#292e39',
    sky: '#2e4948',
    upperFrames: [
      {
        x: 93,
        width: 4,
        color: '#8f876e',
      },
      {
        x: 703,
        width: 4,
        color: '#827c67',
      },
    ],
  },
  'premium-spirit-tree': {
    upper: '#26382e',
    lower: '#6c6247',
    left: '#26382e',
    right: '#26382e',
    sky: '#345f48',
    upperFrames: [
      {
        x: 114,
        width: 3,
        color: '#8f876e',
      },
      {
        x: 684,
        width: 3,
        color: '#8f876e',
      },
    ],
  },
  'premium-neon-loft': {
    upper: '#252c35',
    lower: '#555455',
    left: '#252c35',
    right: '#252c35',
    sky: '#2a444b',
    upperFrames: [
      {
        x: 466,
        width: 25,
        color: '#4e6470',
      },
    ],
  },
  'premium-midnight-jazz': {
    upper: '#2b2730',
    lower: '#4e4540',
    left: '#2b2730',
    right: '#2b2730',
    sky: '#29444b',
    upperFrames: [
      {
        x: 55,
        width: 32,
        color: '#5e494f',
      },
      {
        x: 713,
        width: 32,
        color: '#5e494f',
      },
    ],
  },
  'premium-museum-studio': {
    upper: '#3e4039',
    lower: '#8c8269',
    left: '#3e4039',
    right: '#3e4039',
    sky: '#2e4948',
    lowerSupports: [
      {
        x: 403,
        width: 4,
        color: '#635d46',
      },
      {
        x: 433,
        width: 4,
        color: '#635d46',
      },
    ],
  },
  'premium-last-bookstore': {
    upper: '#322c25',
    lower: '#72573d',
    left: '#3e3b2d',
    right: '#3e3b2d',
    sky: '#223d42',
  },
  'premium-rooftop-cinema': {
    upper: '#242c31',
    lower: '#645b45',
    left: '#645b45',
    right: '#645b45',
    sky: '#20373f',
  },
  'premium-waterfall-study': {
    upper: '#2e3c37',
    lower: '#67745d',
    left: '#2e3c37',
    right: '#2e3c37',
    sky: '#355249',
    lowerSupports: [
      {
        x: 266,
        width: 16,
        color: '#605640',
      },
      {
        x: 404,
        width: 4,
        color: '#605640',
      },
      {
        x: 559,
        width: 4,
        color: '#605640',
      },
      {
        x: 638,
        width: 16,
        color: '#605640',
      },
    ],
    upperFrames: [
      {
        x: 108,
        width: 4,
        color: '#8e7e5f',
      },
      {
        x: 680,
        width: 3,
        color: '#a49974',
      },
    ],
  },
  'premium-underwater-library': {
    upper: '#1b2f32',
    lower: '#536b66',
    left: '#20373b',
    right: '#93b1a2',
    sky: '#254b5c',
    lowerSupports: [
      {
        x: 380,
        width: 4,
        color: '#879079',
      },
      {
        x: 385,
        width: 30,
        color: '#4e594c',
      },
      {
        x: 416,
        width: 4,
        color: '#879079',
      },
    ],
    upperFrames: [
      {
        x: 88,
        width: 4,
        color: '#8f876e',
      },
      {
        x: 709,
        width: 3,
        color: '#8f876e',
      },
    ],
  },
  'premium-rain-garden-dome': {
    upper: '#203127',
    lower: '#6a7056',
    left: '#203127',
    right: '#203127',
    sky: '#3d6047',
    lowerSupports: [
      {
        x: 380,
        width: 4,
        color: '#879079',
      },
      {
        x: 385,
        width: 30,
        color: '#4e594c',
      },
      {
        x: 416,
        width: 4,
        color: '#879079',
      },
    ],
    upperFrames: [
      {
        x: 399,
        width: 3,
        color: '#8f876e',
      },
    ],
  },
  'premium-desert-rain': {
    upper: '#494132',
    lower: '#9b815c',
    left: '#4a4232',
    right: '#4a4232',
    sky: '#223d43',
    upperFrames: [
      {
        x: 103,
        width: 4,
        color: '#8c8b6a',
      },
      {
        x: 693,
        width: 4,
        color: '#8c8b6a',
      },
    ],
  },
  'premium-onsen-veranda': {
    upper: '#31372c',
    lower: '#7d7051',
    left: '#7d7051',
    right: '#7d7051',
    sky: '#4a6441',
    lowerSupports: [
      {
        x: 384,
        width: 32,
        color: '#a4a68a',
      },
      {
        x: 684,
        width: 32,
        color: '#a4a68a',
      },
    ],
    upperFrames: [
      {
        x: 148,
        width: 4,
        color: '#8c8b6a',
      },
      {
        x: 648,
        width: 4,
        color: '#8c8b6a',
      },
    ],
  },
  'premium-observatory': {
    upper: '#2d303d',
    lower: '#666777',
    left: '#2d303d',
    right: '#2d303d',
    sky: '#2e4948',
    lowerSupports: [
      {
        x: 620,
        width: 4,
        color: '#879079',
      },
      {
        x: 625,
        width: 30,
        color: '#4e594c',
      },
      {
        x: 656,
        width: 4,
        color: '#879079',
      },
    ],
    upperFrames: [
      {
        x: 84,
        width: 3,
        color: '#8f876e',
      },
      {
        x: 714,
        width: 3,
        color: '#8f876e',
      },
    ],
  },
  'premium-moon-base': {
    upper: '#243439',
    lower: '#4e7677',
    left: '#9bb1a6',
    right: '#9bb1a6',
    sky: '#183c49',
  },
  'premium-cloud-post': {
    upper: '#353a33',
    lower: '#635c45',
    left: '#353a33',
    right: '#353a33',
    sky: '#7d9790',
    lowerSupports: [
      {
        x: 704,
        width: 26,
        color: '#827155',
      },
    ],
    upperFrames: [
      {
        x: 398,
        width: 4,
        color: '#a18c64',
      },
    ],
  },
  'premium-personal-roastery': {
    upper: '#312c29',
    lower: '#71604b',
    left: '#302c29',
    right: '#302c29',
    sky: '#20373f',
    upperFrames: [
      {
        x: 143,
        width: 4,
        color: '#8e7e5f',
      },
      {
        x: 663,
        width: 4,
        color: '#8e7e5f',
      },
    ],
  },
  'premium-memory-house': {
    upper: '#3b3931',
    lower: '#765f48',
    left: '#81795c',
    right: '#81795c',
    sky: '#4f6950',
    lowerSupports: [
      {
        x: 457,
        width: 4,
        color: '#b69c70',
      },
    ],
  },
}
