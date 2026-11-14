import { ALL_BACKGROUNDS, getBackground } from './backgrounds.ts'
import { getSceneAnimals } from './sceneAnimals.ts'
import { PREMIUM_EXPERIENCES } from './premiumExperience.ts'
import {
  ANIMAL_SPECIES,
  ANIMAL_FEEDING_OFFSET,
  type AnimalSpecies,
  type AnimalDomain,
} from './animalSpecies.ts'
// Top edge of the authored quadratic branch (stroke width 9), in local coordinates.
export function ordinaryBranchSurface(x: number): number {
  const t = (-330 + Math.sqrt(330 ** 2 + 4 * 935 * (x + 65))) / 1870
  return 17 - 50 * t - 57 * t * t - 4.5
}
export type Point = { x: number; y: number }
export type AnimalSource = {
  selector: string
  index: number
  origin?: Point
  supportSelectors?: string[]
  part?: number
}
export type AnimalSpec = {
  id: string
  species: AnimalSpecies
  home: Point
  scale: number
  coat: string
  marking?: string
  zoneId: string
  source?: AnimalSource
  sourceMotionId?: string
  slotOf?: string
}
export type NavZone = {
  id: string
  domain: AnimalDomain
  habitat: 'indoor' | 'outdoor'
  polygon: Point[]
  holes: Point[][]
  layer: 'interior' | 'exterior' | 'foreground'
  route: Point[]
  support: 'floor' | 'bench' | 'chair' | 'branch' | 'post' | 'bank' | 'water' | 'air' | 'thread'
  anchor?: Point
  boundsPolicy: 'contact' | 'body'
}
export type NavLink = { from: string; to: string; capabilities: AnimalDomain[] }
export type AnimalResource = {
  id: string
  zoneId: string
  kind: 'food' | 'water' | 'rest'
  position: Point
  approach?: Point
  heading?: 1 | -1
  consumerId?: string
}
export type AnimalHabitat = {
  id: string
  actors: AnimalSpec[]
  zones: NavZone[]
  links: NavLink[]
  resources: AnimalResource[]
  policy: 'authored' | 'quiet'
}
type PetRow = {
  species: AnimalSpecies
  x: number
  y: number
  scale: number
  coat: string
  index: number
}

// Exact authored Pet call sites, including second owls. Empty rooms remain explicit.
const premiumPets: Record<string, PetRow[]> = {
  'premium-christmas-bookcafe': [
    {
      index: 0,
      x: 635,
      y: 745,
      scale: 1,
      species: 'cat',
      coat: '#c2ad89',
    },
  ],
  'premium-halloween-greenhouse': [
    {
      index: 0,
      x: 590,
      y: 740,
      scale: 1,
      species: 'cat',
      coat: '#4f5347',
    },
  ],
  'premium-sakura-teahouse': [
    {
      index: 0,
      x: 690,
      y: 755,
      scale: 0.8,
      species: 'rabbit',
      coat: '#c6c0aa',
    },
  ],
  'premium-autumn-lake': [
    {
      index: 0,
      x: 115,
      y: 755,
      scale: 1,
      species: 'cat',
      coat: '#b8a27a',
    },
  ],
  'premium-newyear-attic': [
    {
      index: 0,
      x: 680,
      y: 730,
      scale: 1,
      species: 'cat',
      coat: '#a7a799',
    },
  ],
  'premium-orient-express': [],
  'premium-treetop-house': [
    {
      index: 0,
      x: 640,
      y: 755,
      scale: 1,
      species: 'fox',
      coat: '#ad8c61',
    },
    {
      index: 1,
      x: 170,
      y: 565,
      scale: 0.65,
      species: 'owl',
      coat: '#b7a181',
    },
  ],
  'premium-storm-lighthouse': [
    {
      index: 0,
      x: 125,
      y: 755,
      scale: 1,
      species: 'cat',
      coat: '#939b8e',
    },
  ],
  'premium-canal-houseboat': [
    {
      index: 0,
      x: 660,
      y: 755,
      scale: 1,
      species: 'cat',
      coat: '#79867a',
    },
  ],
  'premium-cloud-airship': [
    {
      index: 0,
      x: 165,
      y: 545,
      scale: 0.7,
      species: 'owl',
      coat: '#a49d7e',
    },
  ],
  'premium-wizard-library': [
    {
      index: 0,
      x: 190,
      y: 570,
      scale: 0.8,
      species: 'owl',
      coat: '#a99b7c',
    },
  ],
  'premium-dragon-study': [],
  'premium-mushroom-teahouse': [
    {
      index: 0,
      x: 650,
      y: 730,
      scale: 0.85,
      species: 'rabbit',
      coat: '#c4bda1',
    },
  ],
  'premium-moon-alchemy': [],
  'premium-spirit-tree': [
    {
      index: 0,
      x: 610,
      y: 745,
      scale: 1,
      species: 'fox',
      coat: '#b0b493',
    },
    {
      index: 1,
      x: 160,
      y: 440,
      scale: 0.6,
      species: 'owl',
      coat: '#b7a181',
    },
  ],
  'premium-neon-loft': [
    {
      index: 0,
      x: 190,
      y: 755,
      scale: 1,
      species: 'cat',
      coat: '#7b8279',
    },
  ],
  'premium-midnight-jazz': [
    {
      index: 0,
      x: 650,
      y: 760,
      scale: 1,
      species: 'cat',
      coat: '#6f6f66',
    },
  ],
  'premium-museum-studio': [],
  'premium-last-bookstore': [
    {
      index: 0,
      x: 625,
      y: 755,
      scale: 1,
      species: 'cat',
      coat: '#b4a480',
    },
  ],
  'premium-rooftop-cinema': [
    {
      index: 0,
      x: 675,
      y: 760,
      scale: 1,
      species: 'cat',
      coat: '#b6a380',
    },
  ],
  'premium-waterfall-study': [
    {
      index: 0,
      x: 680,
      y: 755,
      scale: 0.75,
      species: 'rabbit',
      coat: '#b9c3ad',
    },
  ],
  'premium-underwater-library': [
    {
      index: 0,
      x: 165,
      y: 680,
      scale: 0.6,
      species: 'owl',
      coat: '#9cae9a',
    },
  ],
  'premium-rain-garden-dome': [
    {
      index: 0,
      x: 620,
      y: 755,
      scale: 1,
      species: 'rabbit',
      coat: '#c2bba1',
    },
  ],
  'premium-desert-rain': [
    {
      index: 0,
      x: 105,
      y: 770,
      scale: 0.7,
      species: 'cat',
      coat: '#c5b490',
    },
  ],
  'premium-onsen-veranda': [],
  'premium-observatory': [],
  'premium-moon-base': [
    {
      index: 0,
      x: 145,
      y: 775,
      scale: 0.7,
      species: 'cat',
      coat: '#c1cabc',
    },
  ],
  'premium-cloud-post': [
    {
      index: 0,
      x: 125,
      y: 315,
      scale: 0.7,
      species: 'owl',
      coat: '#bbb08c',
    },
  ],
  'premium-personal-roastery': [
    {
      index: 0,
      x: 375,
      y: 775,
      scale: 0.75,
      species: 'cat',
      coat: '#b39d7b',
    },
  ],
  'premium-memory-house': [
    {
      index: 0,
      x: 660,
      y: 765,
      scale: 1,
      species: 'cat',
      coat: '#b7ac90',
    },
  ],
}
const rectangle = (x: number, y: number, w: number, h: number): Point[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
]
const signaturePalette: Record<string, [string, string?]> = {
  bird: ['#9da98d', '#64877e'],
  squirrel: ['#aa8c67', '#ac9270'],
  ray: ['#709a9c', '#a1b9aa'],
  jelly: ['#98aaa9', '#aabfba'],
  butterfly: ['#bc9c80', '#ceb995'],
  moth: ['#9b9a7d'],
  web: ['#7e8072', '#aaa994'],
  snail: ['#9caa86', '#957a57'],
  caravan: ['#9d8d6b', '#7e7860'],
}
const signatureSpecies: Record<string, AnimalSpecies> = {
  bird: 'songbird',
  squirrel: 'squirrel',
  web: 'spider',
  moth: 'moth',
  butterfly: 'butterfly',
  snail: 'snail',
  ray: 'ray',
  jelly: 'jellyfish',
  caravan: 'camel',
}
function buildHabitat(id: string): AnimalHabitat {
  const plan: AnimalHabitat = {
    id,
    actors: [],
    zones: [],
    links: [],
    resources: [],
    policy: 'quiet',
  }
  function add(
    species: AnimalSpecies,
    origin: Point,
    scale: number,
    coat: string,
    habitat: 'indoor' | 'outdoor',
    domain: AnimalDomain,
    support: NavZone['support'],
    source?: AnimalSource,
    sourceMotionId?: string,
    marking?: string,
    footOffset = 0,
  ) {
    const actorId = `${id}:${sourceMotionId ? sourceMotionId + (source?.part === undefined ? '' : `-part-${source.part}`) : source?.selector.includes('premium-hero') ? 'dragon' : `actor-${plan.actors.length + 1}`}`
    const home = { x: origin.x, y: origin.y + footOffset * scale }
    const traits = ANIMAL_SPECIES[species],
      radius = traits.footprint.halfWidth * scale,
      depth = traits.footprint.halfDepth * scale
    const roam =
      species === 'dragon'
        ? 0
        : domain === 'air' || domain === 'water'
          ? 28
          : support === 'post'
            ? 0
            : 16 * scale
    const bodyPolicy =
      domain === 'air' || (domain === 'water' && !['duck', 'gull'].includes(species))
    const envelope = traits.visualEnvelope
    const halfW = (bodyPolicy ? envelope.halfWidth * scale : radius) + roam + 3,
      above = bodyPolicy ? envelope.above * scale + 25 : depth + 2,
      below = bodyPolicy ? envelope.below * scale + 25 : depth + 2
    const zoneId = `${actorId}:zone`
    plan.zones.push({
      id: zoneId,
      domain,
      habitat,
      layer: habitat === 'outdoor' ? 'exterior' : 'foreground',
      polygon: rectangle(home.x - halfW, home.y - above, halfW * 2, above + below),
      holes: [],
      route:
        domain === 'air' || (domain === 'water' && bodyPolicy)
          ? [{ x: home.x - roam, y: home.y - 12 }, { x: home.x + roam, y: home.y + 12 }, home]
          : [
              { x: home.x - roam, y: home.y },
              { x: home.x + roam, y: home.y },
            ],
      support,
      boundsPolicy:
        domain === 'air' || (domain === 'water' && !['duck', 'gull'].includes(species))
          ? 'body'
          : 'contact',
    })
    plan.actors.push({
      id: actorId,
      species,
      home,
      scale,
      coat,
      marking,
      zoneId,
      source: source ? { ...source, origin } : undefined,
      sourceMotionId,
    })
    if (domain !== 'air' && species !== 'dragon')
      plan.resources.push({
        id: `${actorId}:food`,
        zoneId,
        kind: 'food',
        position: { x: home.x + roam * 0.6, y: home.y },
      })
    plan.resources.push({ id: `${actorId}:rest`, zoneId, kind: 'rest', position: home })
  }
  const regular = getSceneAnimals(id)
  const indexBySelector = new Map<string, number>()
  for (const animal of regular) {
    const indoor = animal.habitat === 'indoor'
    const selector = indoor
      ? `[data-pet="${animal.species}"]`
      : `[data-wildlife="${animal.species}"]`
    const index = indexBySelector.get(selector) || 0
    indexBySelector.set(selector, index + 1)
    const domain: AnimalDomain =
      indoor || animal.support === 'branch' || animal.support === 'post'
        ? 'perch'
        : animal.support === 'flight'
          ? 'air'
          : animal.support === 'water'
            ? 'water'
            : 'ground'
    const support: NavZone['support'] = indoor
      ? id === 'water-velvet-tide'
        ? 'chair'
        : 'bench'
      : animal.support === 'branch'
        ? 'branch'
        : animal.support === 'post'
          ? 'post'
          : animal.support === 'flight'
            ? 'air'
            : animal.support === 'water'
              ? 'water'
              : 'bank'
    const foot = indoor
      ? animal.species === 'dog'
        ? 13
        : 7
      : animal.support === 'branch'
        ? ordinaryBranchSurface(0)
        : 0
    add(
      animal.species,
      { x: animal.x, y: animal.y },
      animal.scale,
      animal.coat,
      animal.habitat,
      domain,
      support,
      {
        selector,
        index,
        supportSelectors:
          indoor && animal.species === 'dog'
            ? [':scope > ellipse:nth-of-type(-n+2)']
            : animal.support === 'post'
              ? [':scope > path:nth-of-type(-n+2)']
              : animal.support === 'branch'
                ? [':scope > path:first-of-type']
                : animal.support === 'ground'
                  ? [':scope > path:first-of-type']
                  : animal.support === 'water'
                    ? [':scope > g:first-child']
                    : [],
      },
      undefined,
      animal.marking,
      foot,
    )
    if (animal.support === 'branch') {
      const actor = plan.actors.at(-1)!,
        zone = plan.zones.at(-1)!
      const extent = 16 * animal.scale
      zone.route = [-extent, 0, extent].map((dx) => ({
        x: animal.x + dx,
        y: animal.y + ordinaryBranchSurface(dx / animal.scale) * animal.scale,
      }))
      const depth = ANIMAL_SPECIES[animal.species].footprint.halfDepth * animal.scale + 2
      const ys = zone.route.map((p) => p.y)
      zone.polygon = rectangle(
        zone.polygon[0].x,
        Math.min(...ys) - depth,
        zone.polygon[1].x - zone.polygon[0].x,
        Math.max(...ys) - Math.min(...ys) + 2 * depth,
      )
      actor.home = { ...zone.route[1] }
    }
  }
  for (const pet of premiumPets[id] || [])
    add(
      pet.species,
      { x: pet.x, y: pet.y },
      pet.scale,
      pet.coat,
      'indoor',
      pet.species === 'owl' ? 'perch' : 'ground',
      pet.species === 'owl' ? 'branch' : 'floor',
      {
        selector: '[data-premium-animal]',
        index: pet.index,
        supportSelectors: [':scope > ellipse:first-child'],
      },
      undefined,
      undefined,
      pet.species === 'owl' ? 16 : 12,
    )
  if (id === 'premium-dragon-study') {
    add(
      'dragon',
      { x: 598, y: 771 },
      1,
      '#788a68',
      'indoor',
      'ground',
      'floor',
      {
        selector: '[data-premium-hero="sleeping-dragon"]',
        index: 0,
        supportSelectors: [':scope > ellipse:first-child'],
      },
      'dragon-study-wing',
    )
    const dragon = plan.actors.at(-1)!
    dragon.slotOf = 'dragon-study-wing'
  }
  for (const motion of PREMIUM_EXPERIENCES[id] || []) {
    if (motion.kind === 'firefly') {
      for (const [part, dx] of [-18, 0, 19].entries())
        add(
          'firefly',
          { x: motion.x + dx, y: motion.y + (part % 2) * 19 },
          1,
          '#d5d498',
          'outdoor',
          'air',
          'air',
          {
            selector: `[data-premium-motion="${motion.id}"]`,
            index: 0,
            part,
            supportSelectors: [],
          },
          motion.id,
          '#91ad9b',
        )
      continue
    }
    const species = signatureSpecies[motion.kind]
    if (!species) continue
    const domain: AnimalDomain = ['ray', 'jelly'].includes(motion.kind)
      ? 'water'
      : ['moth', 'butterfly', 'web'].includes(motion.kind)
        ? 'air'
        : ['bird', 'squirrel'].includes(motion.kind)
          ? 'perch'
          : 'ground'
    const foot = ['bird', 'squirrel'].includes(motion.kind)
      ? 21
      : motion.kind === 'snail'
        ? 26
        : motion.kind === 'caravan'
          ? 35
          : 0
    add(
      species,
      { x: motion.x, y: motion.y },
      1,
      signaturePalette[motion.kind]?.[0] || '#aa9b7c',
      'outdoor',
      domain,
      motion.kind === 'web'
        ? 'thread'
        : domain === 'perch'
          ? 'branch'
          : domain === 'water'
            ? 'water'
            : domain === 'air'
              ? 'air'
              : 'bank',
      {
        selector: `[data-premium-motion="${motion.id}"]`,
        index: 0,
        supportSelectors: ['bird', 'squirrel', 'snail', 'caravan'].includes(motion.kind)
          ? [':scope > path:first-of-type']
          : [],
      },
      motion.id,
      signaturePalette[motion.kind]?.[1],
      foot,
    )
  }
  if (id === 'premium-underwater-library')
    for (const [index, x] of [180, 370, 580].entries())
      add(
        'fish',
        { x, y: 230 + (index % 2) * 85 },
        1,
        index % 2 ? '#bca977' : '#8cafb1',
        'outdoor',
        'water',
        'water',
        { selector: '.premium-fish', index },
      )
  if (id === 'premium-halloween-greenhouse')
    for (const [part, x] of [570, 270].entries())
      add('bat', { x, y: 260 + part * 10 }, 0.7, '#142b2c', 'outdoor', 'air', 'air', {
        selector: '.premium-bat',
        index: 0,
        part,
      })
  const spider = plan.actors.find((actor) => actor.species === 'spider')
  if (spider) {
    const thread = plan.zones.find((zone) => zone.id === spider.zoneId)!
    thread.anchor = { x: spider.home.x, y: spider.home.y - 75 }
    thread.route = [
      { x: spider.home.x, y: spider.home.y - 18 },
      { x: spider.home.x, y: spider.home.y + 18 },
    ]
    thread.polygon = rectangle(spider.home.x - 34, spider.home.y - 50, 68, 88)
  }
  if (id === 'premium-underwater-library') {
    const school = plan.actors.filter((a) => ['fish', 'ray', 'jellyfish'].includes(a.species))
    const zone: NavZone = {
      id: `${id}:lagoon`,
      domain: 'water',
      habitat: 'outdoor',
      layer: 'exterior',
      polygon: [
        { x: 110, y: 160 },
        { x: 630, y: 160 },
        { x: 705, y: 330 },
        { x: 600, y: 465 },
        { x: 220, y: 465 },
        { x: 90, y: 330 },
      ],
      holes: [],
      route: [
        { x: 180, y: 230 },
        { x: 370, y: 315 },
        { x: 630, y: 330 },
        { x: 550, y: 230 },
        { x: 180, y: 330 },
        { x: 340, y: 205 },
        { x: 440, y: 395 },
        { x: 300, y: 230 },
      ],
      support: 'water',
      boundsPolicy: 'body',
    }
    school.find((a) => a.species === 'jellyfish')!.home = { x: 300, y: 230 }
    const last = school.find((a) => a.source?.selector === '.premium-fish' && a.source.index === 2)!
    last.home = { x: 605, y: 345 }
    const old = new Set(school.map((a) => a.zoneId))
    plan.zones = plan.zones.filter((z) => !old.has(z.id))
    plan.resources = plan.resources.filter((r) => !old.has(r.zoneId))
    plan.zones.push(zone)
    for (const actor of school) actor.zoneId = zone.id
    plan.resources.push({
      id: `${id}:plankton`,
      zoneId: zone.id,
      kind: 'food',
      position: { x: 350, y: 400 },
    })
  }
  if (id === 'premium-spirit-tree') {
    const swarm = plan.actors.filter((a) => a.species === 'firefly')
    const old = new Set(swarm.map((a) => a.zoneId)),
      zoneId = `${id}:swarm`
    plan.zones = plan.zones.filter((z) => !old.has(z.id))
    plan.resources = plan.resources.filter((r) => !old.has(r.zoneId))
    plan.zones.push({
      id: zoneId,
      domain: 'air',
      habitat: 'outdoor',
      layer: 'exterior',
      polygon: rectangle(470, 260, 200, 130),
      holes: [],
      route: [
        { x: 505, y: 300 },
        { x: 565, y: 335 },
        { x: 635, y: 300 },
        { x: 570, y: 290 },
      ],
      support: 'air',
      boundsPolicy: 'body',
    })
    swarm.forEach((a, i) => {
      a.zoneId = zoneId
      a.home = { x: [510, 565, 625][i], y: [300, 335, 300][i] }
    })
  }
  // Deliberately limited social casts on physically shared surfaces, never between chairs/windows.
  const social: Record<string, { species: AnimalSpecies; second: Point; polygon: Point[] }> = {
    'garden-court': {
      species: 'rabbit',
      second: { x: 620, y: 535 },
      polygon: rectangle(515, 522, 175, 26),
    },
    'forest-autumn': {
      species: 'squirrel',
      second: { x: 565, y: 490 + ordinaryBranchSurface((565 - 610) / 0.7) * 0.7 },
      polygon: rectangle(535, 480, 160, 40),
    },
    'water-lake': {
      species: 'duck',
      second: { x: 610, y: 505 },
      polygon: rectangle(475, 480, 210, 50),
    },
    'premium-last-bookstore': {
      species: 'cat',
      second: { x: 715, y: 767 },
      polygon: rectangle(560, 751, 215, 32),
    },
  }
  const pair = social[id]
  if (pair) {
    const first = plan.actors.find((a) => a.species === pair.species)!
    const old = first.zoneId,
      zoneId = `${id}:social-surface`
    plan.zones = plan.zones.filter((z) => z.id !== old)
    plan.resources = plan.resources.filter((r) => r.zoneId !== old)
    const domain: AnimalDomain =
      id === 'forest-autumn' ? 'perch' : id === 'water-lake' ? 'water' : 'ground'
    plan.zones.push({
      id: zoneId,
      domain,
      habitat: first.source?.selector.includes('premium') ? 'indoor' : 'outdoor',
      polygon: pair.polygon,
      holes: [],
      layer: id === 'premium-last-bookstore' ? 'foreground' : 'exterior',
      route:
        id === 'forest-autumn'
          ? [565, 585, 605, 625, 650].map((x) => ({
              x,
              y: 490 + ordinaryBranchSurface((x - 610) / 0.7) * 0.7,
            }))
          : [first.home, pair.second],
      support:
        domain === 'perch'
          ? 'branch'
          : domain === 'water'
            ? 'water'
            : id === 'premium-last-bookstore'
              ? 'floor'
              : 'bank',
      boundsPolicy: 'contact',
    })
    first.zoneId = zoneId
    plan.actors.push({
      id: `${id}:social-companion`,
      species: pair.species,
      home: pair.second,
      scale: first.scale * 0.85,
      coat: first.marking || '#b9b29b',
      marking: first.coat,
      zoneId,
    })
    for (const [index, position] of [first.home, pair.second].entries())
      plan.resources.push({ id: `${zoneId}:food-${index}`, zoneId, kind: 'food', position })
  }
  if (id === 'premium-halloween-greenhouse') {
    // Keep the authored source anchor, but separate the live moth from the bat's
    // full wing envelope before either actor starts moving.
    const actor = plan.actors.find((actor) => actor.species === 'moth')!
    actor.home = { x: actor.home.x + 70, y: actor.home.y }
    const zone = plan.zones.find((zone) => zone.id === actor.zoneId)!
    zone.route = zone.route.map((point) => ({ x: point.x + 70, y: point.y }))
    zone.polygon = zone.polygon.map((point) => ({ x: point.x + 70, y: point.y }))
    for (const resource of plan.resources)
      if (resource.zoneId === zone.id)
        resource.position = { x: resource.position.x + 70, y: resource.position.y }
  }
  if (id === 'premium-memory-house') {
    // The original contact point is hidden by the later-painted chest (x445..750).
    // Keep the source binding/paint order and use the open floor to its left.
    const actor = plan.actors.find((actor) => actor.species === 'cat')!
    actor.home = { x: 370, y: 799 }
    const zone = plan.zones.find((zone) => zone.id === actor.zoneId)!
    zone.support = 'floor'
    zone.route = [
      { x: 360, y: 799 },
      { x: 380, y: 799 },
    ]
    zone.polygon = rectangle(319, 790, 102, 18)
    for (const resource of plan.resources)
      if (resource.zoneId === zone.id && resource.kind === 'rest')
        resource.position = { ...actor.home }
  }
  for (const actor of plan.actors) {
    const zone = plan.zones.find((zone) => zone.id === actor.zoneId)!
    if (zone.support !== 'bench' && zone.support !== 'chair') continue
    const origin = actor.source!.origin!
    // ScenePets' cat cap spans local -60..60; the dog bench -76..76.
    // Scene34's retained upholstered chair spans world x60..210.
    const left =
      zone.support === 'chair' ? 60 : origin.x - (actor.species === 'dog' ? 76 : 60) * actor.scale
    const right =
      zone.support === 'chair' ? 210 : origin.x + (actor.species === 'dog' ? 76 : 60) * actor.scale
    const mouth = ANIMAL_FEEDING_OFFSET[actor.species].x * actor.scale
    const vesselHalfWidth = 8.5 * actor.scale
    const leftEndpoint = left + mouth + vesselHalfWidth
    const rightEndpoint = right - mouth - vesselHalfWidth
    zone.route = zone.route.map((point) => ({
      x: Math.max(leftEndpoint, Math.min(point.x, rightEndpoint)),
      y: point.y,
    }))
  }
  // A station is under the eating mouth; the feet stand at approach, not on the bowl.
  plan.resources = plan.resources.filter((resource) => resource.kind !== 'food')
  for (const actor of plan.actors) {
    const zone = plan.zones.find((zone) => zone.id === actor.zoneId)!
    if (zone.domain === 'air' || zone.support === 'post' || actor.species === 'dragon') continue
    const mouth = ANIMAL_FEEDING_OFFSET[actor.species]
    const surfaceActors = plan.actors
      .filter((candidate) => candidate.zoneId === zone.id)
      .sort((a, b) => a.home.x - b.home.x)
    const route = [...zone.route].sort((a, b) => a.x - b.x)
    let heading: 1 | -1 =
      surfaceActors.length > 1
        ? surfaceActors.indexOf(actor) === 0
          ? -1
          : 1
        : actor.home.x < 400
          ? -1
          : 1
    let approach = { ...actor.home }
    // Hard food vessels stay beyond the reachable walking corridor, never on it.
    // Water-body plankton remains distributed within its own swimming volume.
    if (zone.boundsPolicy === 'contact' && route.length) {
      const endpoint = (direction: 1 | -1) => route[direction === -1 ? 0 : route.length - 1]
      approach = { ...endpoint(heading) }
      const foodX = approach.x + mouth.x * actor.scale * heading
      if (surfaceActors.length === 1 && (foodX < 16 || foodX > 784)) {
        heading = heading === 1 ? -1 : 1
        approach = { ...endpoint(heading) }
      }
    }
    if (zone.support === 'branch') {
      const author = surfaceActors.find((candidate) => candidate.source?.origin)!
      const origin = author.source!.origin!
      const signature = Boolean(author.sourceMotionId)
      const left = Math.max(0, origin.x + (signature ? -90 : -65) * author.scale) + 13
      const right = Math.min(800, origin.x + (signature ? 105 : 1200) * author.scale) - 13
      const supported = (point: Point, direction: 1 | -1) => {
        const x = point.x + mouth.x * actor.scale * direction
        return x >= left && x <= right
      }
      // Seeds are soft scatter, not a hard bowl: face inward when an outward
      // endpoint would leave the actual authored branch.
      if (!supported(approach, heading)) {
        const opposite = heading === 1 ? -1 : 1
        if (supported(approach, opposite)) heading = opposite
        else {
          const candidate = route.find((point) => supported(point, heading))
          if (!candidate) throw new Error(`No supported seed station for ${actor.id}`)
          approach = { ...candidate }
        }
      }
    }
    const position = {
      x: approach.x + mouth.x * actor.scale * heading,
      y: approach.y + mouth.y * actor.scale,
    }
    plan.resources.push({
      id: `${actor.id}:meal`,
      kind: 'food',
      zoneId: zone.id,
      consumerId: actor.id,
      position,
      approach,
      heading,
    })
  }

  if (id === 'premium-underwater-library') {
    for (const actor of plan.actors.filter((a) =>
      ['fish', 'ray', 'jellyfish'].includes(a.species),
    )) {
      const mouth = ANIMAL_FEEDING_OFFSET[actor.species]
      for (const [index, approach] of [
        { x: actor.species === 'ray' ? 250 : 180, y: 330 },
        { x: 340, y: 205 },
        { x: 440, y: 395 },
      ].entries())
        plan.resources.push({
          id: `${actor.id}:plankton-${index}`,
          kind: 'food',
          zoneId: actor.zoneId,
          consumerId: actor.id,
          approach,
          heading: 1,
          position: {
            x: approach.x + mouth.x * actor.scale,
            y: approach.y + mouth.y * actor.scale,
          },
        })
    }
  }
  plan.policy = plan.actors.length ? 'authored' : 'quiet'
  return plan
}
export const ANIMAL_HABITATS: Record<string, AnimalHabitat> = Object.fromEntries(
  ALL_BACKGROUNDS.map((room) => [room.id, buildHabitat(room.id)]),
)
export function getAnimalHabitat(roomId: string): AnimalHabitat {
  return ANIMAL_HABITATS[getBackground(roomId).id]
}
