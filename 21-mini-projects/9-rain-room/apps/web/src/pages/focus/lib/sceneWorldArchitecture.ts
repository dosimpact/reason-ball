import {
  getSceneWorldJunction,
  sideFloorAt,
  type SceneWorldJunction,
  PREMIUM_SIDE_OPENINGS,
} from '../model/sceneWorldJunctions.ts'
import { getSceneInterior } from '../model/sceneInterior.ts'
import type { SceneWorld } from '../model/sceneWorldCatalog.ts'
import type { SceneRenovation } from '../model/sceneRenovation.ts'
import { sceneWorldFittings } from './sceneWorldFittings.ts'

export type EdgeMaterials = {
  upper: string
  sky?: string
  lower: string
  left: string
  right: string
  upperFrames?: { x: number; width: number; color: string }[]
  lowerSupports?: { x: number; width: number; color: string; kind?: 'leg'; dx?: number }[]
}
// A lone post or a pair of six-pixel lamp suspensions does not establish a
// glazed bay. A source-aligned clerestory needs multiple substantial mullions.
const glazingFrames = (edge: EdgeMaterials) => {
  const frames = (edge.upperFrames ?? []).filter((frame) => frame.width >= 6)
  return frames.length >= 2 && frames.some((frame) => frame.width >= 8) ? frames : []
}
type Room = { world: SceneWorld; plan: SceneRenovation; edge: EdgeMaterials }
const ox = 900,
  oy = 760
const num = (v: number) => Number(v.toFixed(2))
const px = (v: number) => num(Math.max(0, Math.min(2600, v + ox)))
const py = (v: number) => num(Math.max(0, Math.min(2340, v + oy)))
const channels = (s: string) =>
  s
    .slice(1)
    .match(/../g)!
    .map((n) => parseInt(n, 16))
function mix(a: string, b: string, amount: number) {
  const other = channels(b)
  return (
    '#' +
    channels(a)
      .map((v, i) =>
        Math.round(v + (other[i] - v) * amount)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}
const tone = (c: string, amount: number) =>
  mix(c, amount < 0 ? '#000000' : '#ffffff', Math.abs(amount))
function box(x: number, y: number, width: number, height: number, fill: string) {
  const left = Math.max(-900, x),
    top = Math.max(-760, y)
  return `<rect x="${px(left)}" y="${py(top)}" width="${num(Math.max(0, Math.min(1700, x + width) - left))}" height="${num(Math.max(0, Math.min(1580, y + height) - top))}" fill="${fill}" stroke="none"/>`
}
function polygon(points: number[][], fill: string) {
  return `<path d="${points.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x)} ${py(y)}`).join('')}Z" fill="${fill}" stroke="none"/>`
}
function oval(x: number, y: number, rx: number, ry: number, fill: string) {
  // All authored ellipses are inside the world; no negative SVG local points.
  return `<ellipse cx="${px(x)}" cy="${py(y)}" rx="${num(rx)}" ry="${num(ry)}" fill="${fill}" stroke="none"/>`
}
function beam(x1: number, y1: number, x2: number, y2: number, width: number, fill: string) {
  const length = Math.hypot(x2 - x1, y2 - y1)
  if (!length) return ''
  const dx = ((y2 - y1) * width) / length / 2,
    dy = ((x2 - x1) * width) / length / 2
  return polygon(
    [
      [x1 - dx, y1 + dy],
      [x2 - dx, y2 + dy],
      [x2 + dx, y2 - dy],
      [x1 + dx, y1 - dy],
    ],
    fill,
  )
}
function arch(cx: number, cy: number, rx: number, ry: number, thickness: number, fill: string) {
  const outer = [],
    inner = []
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI + (i * Math.PI) / 32
    outer.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
    inner.unshift([cx + Math.cos(a) * (rx - thickness), cy + Math.sin(a) * (ry - thickness)])
  }
  return polygon([...outer, ...inner], fill)
}
function curvedBand(points: number[][], width: number, fill: string) {
  let out = ''
  for (let i = 1; i < points.length; i++)
    out += beam(
      ...(points[i - 1] as [number, number]),
      ...(points[i] as [number, number]),
      width,
      fill,
    )
  return out
}
function glow(x: number, y: number, rx: number, ry: number, base: string) {
  return (
    oval(x, y, rx, ry, mix(base, '#cbbd8e', 0.035)) +
    oval(x, y, rx * 0.72, ry * 0.7, mix(base, '#cbbd8e', 0.055)) +
    oval(x, y, rx * 0.45, ry * 0.43, mix(base, '#cbbd8e', 0.075))
  )
}

/** Ceiling shapes are surfaces of the room, never a second generic roof placed on a picture. */
function envelope({ world: c, plan: p, edge: e }: Room) {
  const rise = Math.max(95, p.roofRise),
    back = glazingFrames(e).length
      ? -Math.max(285, Math.min(360, rise + 140))
      : -Math.min(210, Math.max(90, rise * 0.46))
  const wall = e.upper,
    ceiling = mix(c.wall, wall, 0.32),
    ink = mix(c.trim, ceiling, 0.67)
  let s = box(-900, -760, 2600, 760, wall)
  if (p.envelope === 'open') {
    if (p.roofRise > 0) {
      // These rooms are viewed from under a dry veranda canopy. The upward
      // continuation is its underside, while the forward aperture stays open.
      s = box(-900, -760, 2600, 760, e.upper)
      const seam = mix(e.upper, c.trim, 0.15)
      const anchors = (e.upperFrames ?? [])
        .filter((frame) => frame.width >= 6)
        .sort((a, b) => a.x - b.x)
      const left = anchors[0]?.x ?? 16
      const right = anchors.at(-1)?.x ?? 784
      // Two shallow soffit courses meet the longitudinal canopy bearers;
      // there is no pitched roof, hanging lamp or unsupported suspension line.
      for (const y of [-430, -195]) {
        s += box(-900, y, 2600, 4, seam)
        s += box(-900, y + 4, 2600, 3, tone(e.upper, -0.035))
      }
      for (const [x, spread] of [
        [left, -165],
        [right, 165],
      ]) {
        s += beam(x + spread, -760, x, 0, 8, mix(e.upper, c.trim, 0.28))
        s += beam(x + spread + 6, -760, x + 6, 0, 2, tone(e.upper, 0.035))
      }
      for (const x of [left + (right - left) / 3, left + ((right - left) * 2) / 3])
        s += beam(400 + (x - 400) * 1.5, -760, x, 0, 2, seam)
      s += box(-900, -11, 2600, 11, mix(e.upper, c.trim, 0.22))
      return s
    }
    // Unsheltered rooftop and bathing decks continue into actual sampled sky.
    const sky = e.sky ?? c.wall
    s = box(-900, -760, 2600, 760, sky)
    s += oval(150, -480, 480, 24, tone(sky, 0.018))
    s += oval(680, -330, 560, 30, tone(sky, 0.012))
    return s
  }
  s += polygon(
    [
      [-900, -760],
      [1700, -760],
      [800, back],
      [0, back],
    ],
    tone(ceiling, -0.13),
  )
  if (p.envelope === 'timber') {
    s += box(-900, back - 16, 2600, 16, ink)
    for (const x of [-470, 170, 810, 1450])
      s += beam(x, -760, 400 + (x - 400) * 0.6, back - 16, 9, mix(ink, ceiling, 0.35))
    s += beam(-900, -410, 1700, -410, 10, mix(ink, ceiling, 0.28))
  } else if (p.envelope === 'vault' || p.envelope === 'salon') {
    s += arch(400, 30, 880, Math.min(620, rise + 180), 22, mix(c.trim, ceiling, 0.64))
    s += arch(400, 32, 856, Math.min(620, rise + 180) - 18, 4, mix(c.trim, ceiling, 0.35))
    if (p.envelope === 'salon') s += box(-900, back - 14, 2600, 7, mix(c.trim, ceiling, 0.7))
  } else if (p.envelope === 'attic') {
    const ridge = p.vanishing.x
    s += polygon(
      [
        [-900, -760],
        [ridge, -rise],
        [ridge, back],
        [-900, back],
      ],
      tone(ceiling, 0.035),
    )
    s += polygon(
      [
        [ridge, -rise],
        [1700, -760],
        [1700, back],
        [ridge, back],
      ],
      tone(ceiling, -0.075),
    )
    s += beam(-900, -760, ridge, -rise, 15, ink) + beam(ridge, -rise, 1700, -760, 15, ink)
    s += beam(ridge, -760, ridge, back, 13, ink)
    for (const x of [-360, 90, 760, 1210])
      s += beam(x, -760, ridge + (x - ridge) * 0.56, back, 8, mix(ink, ceiling, 0.4))
  } else if (p.envelope === 'glasshouse') {
    const peak = -Math.max(260, rise)
    s += polygon(
      [
        [0, back],
        [400, peak],
        [800, back],
      ],
      mix(wall, '#597268', 0.16),
    )
    for (const x of [70, 400, 730])
      s += beam(x, back, x === 400 ? 400 : 400 + (x - 400) * 0.45, peak, 7, ink)
    s +=
      beam(-900, back, 1700, back, 10, ink) +
      beam(-900, back - 200, 1700, back - 200, 6, mix(ink, wall, 0.3))
  } else if (p.envelope === 'fabric') {
    const ridge = p.vanishing.x
    s += polygon(
      [
        [-900, -760],
        [ridge, -rise],
        [70, back],
        [-900, back],
      ],
      mix(ceiling, c.trim, 0.1),
    )
    s += polygon(
      [
        [ridge, -rise],
        [1700, -760],
        [1700, back],
        [730, back],
      ],
      tone(ceiling, -0.045),
    )
    s +=
      beam(ridge, -760, ridge, -rise, 4, ink) +
      beam(ridge, -rise, 70, back, 3, ink) +
      beam(ridge, -rise, 730, back, 3, ink)
    s += curvedBand(
      [
        [70, back],
        [170, back - 13],
        [400, back - 20],
        [630, back - 13],
        [730, back],
      ],
      5,
      ink,
    )
  } else if (p.envelope === 'cabin' || p.envelope === 'hull') {
    s += arch(400, 15, 850, Math.min(590, rise + 190), 26, mix(c.trim, ceiling, 0.63))
    s += arch(400, 15, 820, Math.min(590, rise + 190) - 24, 5, mix(c.trim, ceiling, 0.4))
    const width = p.envelope === 'hull' ? 9 : 4
    s += arch(400, -190, 1070, 430, width, mix(c.trim, ceiling, 0.76))
    if (p.envelope === 'hull') {
      for (const x of [95, 705]) s += box(x - 4, back, 8, -back, ink)
    }
  } else if (p.envelope === 'dome') {
    s += arch(400, 65, 680, Math.max(330, rise + 120), 15, ink)
    s += arch(400, 65, 656, Math.max(330, rise + 120) - 20, 4, mix(c.trim, wall, 0.5))
    // Curved enclosure panels terminate at a crown, rather than radial triangular trusses.
    s += curvedBand(
      [
        [80, back],
        [118, -260],
        [220, -405],
        [400, -Math.max(340, rise + 100)],
        [580, -405],
        [682, -260],
        [720, back],
      ],
      5,
      mix(c.trim, wall, 0.68),
    )
  } else if (p.envelope === 'organic') {
    s += curvedBand(
      [
        [-90, 0],
        [-65, -180],
        [30, -350],
        [180, -490],
        [380, -580],
      ],
      36,
      mix(c.trim, ceiling, 0.5),
    )
    s += curvedBand(
      [
        [880, 0],
        [845, -180],
        [750, -340],
        [610, -460],
        [380, -580],
      ],
      27,
      mix(c.trim, ceiling, 0.58),
    )
    for (const [x, y, rx, ry] of [
      [50, -390, 120, 48],
      [195, -515, 125, 44],
      [650, -420, 115, 43],
      [450, -585, 115, 38],
    ])
      s += oval(x, y, rx, ry, mix(ceiling, '#667a54', 0.13))
  } else if (p.envelope === 'industrial') {
    s += box(-900, back - 10, 2600, 10, ink)
    s += box(-900, -490, 2600, 6, mix(ink, ceiling, 0.35))
    for (const x of [-300, 1100]) s += box(x, -760, 13, 760 + back, ink)
    s += polygon(
      [
        [120, -420],
        [625, -470],
        [655, -420],
        [155, -369],
      ],
      tone(ceiling, 0.025),
    )
  }
  // Where the source cuts through glass, continue its real narrow mullions exactly to a lintel.
  // Nothing is stretched: these are source-measured positions and flat material colors.
  if (glazingFrames(e).length) {
    s += box(0, back, 800, -back, e.upper)
    for (const frame of glazingFrames(e)) {
      if (frame.width < 5) s += box(frame.x, back, frame.width, -back, frame.color)
      else s += box(frame.x, back, frame.width, -back, frame.color)
    }
    s += box(0, back - 7, 800, 7, mix(ink, e.upper, 0.25))
  }
  return s
}

function upperFeature({ world: c, plan: p, edge: e }: Room) {
  if (c.id === 'premium-onsen-veranda') return '' // Existing core lanterns hang from its canopy.
  const x = p.upperX,
    lintel = glazingFrames(e).length
      ? -Math.max(285, Math.min(360, Math.max(95, p.roofRise) + 140))
      : -Math.min(210, Math.max(90, Math.max(95, p.roofRise) * 0.46)),
    y = glazingFrames(e).length
      ? lintel - 45
      : Math.max(
          p.upperFeature === 'shelf' ? -220 : -Infinity,
          -Math.min(270, Math.max(125, p.roofRise * 0.52)) - 30,
        )
  const material = mix(c.wall, e.upper, 0.3),
    trim = mix(c.trim, material, 0.42),
    dark = tone(material, -0.2),
    light = '#c6b78e'
  let s = ''
  if (p.upperFeature === 'coving') {
    // Recessed light belongs to the continuous wall/ceiling joint, not an oval
    // fixture floating above the window.
    return (
      box(-900, lintel - 17, 2600, 12, mix(c.trim, material, 0.66)) +
      box(-900, lintel - 5, 2600, 5, mix(material, light, 0.15)) +
      box(-900, lintel, 2600, 5, tone(material, -0.12))
    )
  }
  if (p.upperFeature === 'shelf') {
    s += box(x - 145, y - 76, 290, 76, mix(material, trim, 0.08))
    s +=
      box(x - 145, y, 290, 9, trim) +
      box(x - 132, y + 9, 9, 25, dark) +
      box(x + 123, y + 9, 9, 25, dark)
    for (const [i, h] of [47, 59, 42, 63, 51, 56].entries())
      s += box(x - 118 + i * 39, y - h, 28, h, mix(c.trim, c.floor, 0.15 + i * 0.1))
    return s
  }
  if (p.upperFeature === 'curtain') {
    s += box(35, y - 4, 730, 5, trim)
    const left = x < 400 ? 55 : 635
    s += polygon(
      [
        [left, y],
        [left + 110, y],
        [left + 85, y + 150],
        [left + 20, y + 185],
      ],
      mix(c.trim, material, 0.36),
    )
    for (const dx of [26, 54, 82])
      s += beam(left + dx, y, left + dx * 0.72 + 10, y + 142, 3, mix(c.trim, material, 0.58))
    return s + beam(left + 15, y + 137, left + 90, y + 117, 6, trim)
  }
  if (p.upperFeature === 'skylight') {
    s += polygon(
      [
        [x - 130, y - 65],
        [x + 130, y - 65],
        [x + 170, y + 30],
        [x - 170, y + 30],
      ],
      trim,
    )
    s += polygon(
      [
        [x - 117, y - 58],
        [x + 117, y - 58],
        [x + 151, y + 19],
        [x - 151, y + 19],
      ],
      mix(e.upper, '#76948c', 0.19),
    )
    return s + beam(x, y - 58, x, y + 19, 5, trim) + beam(x - 134, y - 19, x + 134, y - 19, 4, trim)
  }
  if (p.upperFeature === 'lockers') {
    s += box(0, y - 90, 800, 14, mix(trim, material, 0.3))
    s += box(x - 183, y - 76, 366, 84, trim)
    for (const dx of [-175, 5])
      s +=
        box(x + dx, y - 68, 170, 68, mix(c.trim, material, 0.64)) +
        box(x + dx + 69, y - 20, 32, 4, trim)
    return s + box(x - 183, y + 8, 366, 7, dark)
  }
  if (p.upperFeature === 'plants') {
    s += box(x - 130, -760, 2, y + 696, trim) + box(x + 128, -760, 2, y + 696, trim)
    s += box(x - 152, y - 64, 304, 7, trim)
    for (const [dx, drop] of [
      [-100, 58],
      [12, 84],
      [111, 48],
    ]) {
      s += beam(x + dx, y - 57, x + dx, y + drop - 20, 2, trim)
      s += polygon(
        [
          [x + dx - 24, y + drop - 20],
          [x + dx + 24, y + drop - 20],
          [x + dx + 18, y + drop + 8],
          [x + dx - 18, y + drop + 8],
        ],
        mix(c.trim, material, 0.42),
      )
      for (const side of [-1, 1])
        s +=
          beam(x + dx, y + drop - 15, x + dx + side * 30, y + drop - 42, 3, '#63755a') +
          oval(x + dx + side * 24, y + drop - 35, 21, 7, '#718366')
    }
    return s
  }
  if (p.upperFeature === 'ducts') {
    s +=
      box(x - 170, y - 39, 340, 38, mix(c.trim, material, 0.62)) +
      box(x - 176, y - 42, 7, 44, trim) +
      box(x + 169, y - 42, 7, 44, trim)
    for (const dx of [-105, -40, 25, 90])
      s += box(x + dx, y - 31, 28, 3, mix(c.trim, material, 0.33))
    return s + box(x - 122, y - 74, 8, 35, dark) + box(x + 114, y - 74, 8, 35, dark)
  }
  if (p.upperFeature === 'rope') {
    if (p.envelope === 'open') return ''
    s += box(x - 211, -760, 2, y + 712, trim) + box(x + 189, -760, 2, y + 712, trim)
    s += curvedBand(
      [
        [x - 210, y - 48],
        [x - 130, y - 23],
        [x, y - 12],
        [x + 120, y - 24],
        [x + 190, y - 48],
      ],
      3,
      trim,
    )
    return s + box(x - 214, y - 58, 8, 20, dark) + box(x + 186, y - 58, 8, 20, dark)
  }
  if (p.upperFeature === 'branches') {
    // This bough grows from the envelope's left trunk (-65,-180), not mid-air.
    const ceiling = mix(c.wall, e.upper, 0.32)
    const wood = mix(c.trim, ceiling, 0.5)
    const points = [
      [-65, -180],
      [35, -245],
      [160, -302],
      [300, -350],
      [465, -392],
      [610, -460],
    ]
    s += curvedBand(points, 18, wood)
    for (const [x, y] of [
      [160, -302],
      [300, -350],
      [465, -392],
    ]) {
      s += beam(x, y, x - 24, y - 45, 6, wood)
      s += oval(x - 32, y - 55, 35, 13, mix(ceiling, '#667a54', 0.22))
    }
    return s
  }
  if (p.upperFeature === 'panels') {
    for (const dx of [-210, -65, 80]) {
      s += polygon(
        [
          [x + dx, y - 72],
          [x + dx + 124, y - 72],
          [x + dx + 135, y + 16],
          [x + dx - 12, y + 16],
        ],
        trim,
      )
      s += polygon(
        [
          [x + dx + 5, y - 66],
          [x + dx + 118, y - 66],
          [x + dx + 127, y + 9],
          [x + dx - 5, y + 9],
        ],
        mix(e.upper, c.trim, 0.13),
      )
    }
    return s
  }
  if (p.upperFeature === 'luggage') {
    s +=
      box(x - 190, y, 380, 9, trim) +
      beam(x - 175, y, x - 160, y - 70, 5, trim) +
      beam(x + 175, y, x + 160, y - 70, 5, trim)
    for (const [dx, w, h] of [
      [-135, 105, 54],
      [12, 125, 65],
    ])
      s +=
        box(x + dx, y - h, w, h, mix(c.floor, c.trim, 0.2)) +
        box(x + dx + 15, y - h, 5, h, dark) +
        box(x + dx + w - 20, y - h, 5, h, dark) +
        box(x + dx + w * 0.4, y - h - 6, w * 0.2, 6, trim)
    return s
  }
  if (p.upperFeature === 'lanterns') {
    if (p.envelope === 'open') {
      s += beam(0, 0, x - 220, y - 100, 6, trim) + beam(800, 0, x + 180, y - 100, 6, trim)
    } else {
      s += box(x - 221, -760, 2, y + 660, trim) + box(x + 179, -760, 2, y + 660, trim)
    }
    s += beam(x - 220, y - 100, x + 180, y - 100, 3, trim)
    for (const [dx, drop] of [
      [-90, 42],
      [95, 63],
    ]) {
      s +=
        box(x + dx - 1.5, y - 100, 3, drop, trim) +
        glow(x + dx, y - 100 + drop + 22, 60, 47, material)
      s +=
        oval(x + dx, y - 100 + drop + 22, 22, 26, mix(c.trim, light, 0.5)) +
        box(x + dx - 15, y - 100 + drop - 4, 30, 4, trim) +
        box(x + dx - 15, y - 100 + drop + 46, 30, 4, trim)
    }
  }
  return s
}

function floor({ world: c, plan: p, edge: e }: Room) {
  const base = e.lower,
    seam = mix(base, c.trim, 0.19),
    shadow = tone(base, -0.1)
  let s = box(-900, 650, 2600, 930, base)
  // No repeated horizontal courses: one physical foreground, with material-appropriate joints.
  if (p.foreground === 'counter') {
    // The existing cut countertop continues into a fitted cabinet fascia.
    const face = mix(base, c.floor, 0.48)
    const frame = mix(face, c.trim, 0.22)
    s += box(-900, 820, 2600, 760, face)
    s += box(-900, 820, 2600, 13, tone(face, -0.17))
    for (const x of [-470, 15, 500, 985]) {
      s += box(x, 852, 455, 254, frame)
      s += box(x + 8, 860, 439, 238, mix(face, c.floor, 0.13))
    }
    s += box(-900, 1120, 2600, 24, tone(face, -0.2))
  } else if (p.foreground === 'rug') {
    s += polygon(
      [
        [115, 846],
        [685, 846],
        [1020, 1500],
        [-220, 1500],
      ],
      mix(base, c.trim, 0.17),
    )
    s += polygon(
      [
        [138, 864],
        [662, 864],
        [981, 1480],
        [-181, 1480],
      ],
      mix(base, c.wall, 0.12),
    )
    s += beam(138, 864, -181, 1480, 3, seam) + beam(662, 864, 981, 1480, 3, seam)
  } else if (p.foreground === 'tatami') {
    if (c.id === 'garden-hanok') {
      for (const x of [-60, 180, 430, 680])
        s += beam(p.vanishing.x + (x - p.vanishing.x) * 0.46, 820, x * 1.7 - 280, 1580, 3, seam)
      s += box(-900, 1120, 2600, 6, shadow)
    } else {
      s += polygon(
        [
          [-200, 855],
          [395, 855],
          [390, 1580],
          [-600, 1580],
        ],
        tone(base, 0.035),
      )
      s += beam(395, 855, 390, 1580, 10, seam) + box(-900, 1160, 2600, 8, seam)
    }
  } else if (p.foreground === 'deck') {
    for (const x of [-650, -120, 410, 940, 1470]) {
      const start =
        p.vanishing.x + (x - p.vanishing.x) * ((820 - p.vanishing.y) / (1580 - p.vanishing.y))
      s += beam(start, 820, x, 1580, 3, seam)
    }
    s += box(-900, 1215, 2600, 5, shadow)
  } else if (p.foreground === 'cabin') {
    s += polygon(
      [
        [135, 835],
        [665, 835],
        [750, 1580],
        [50, 1580],
      ],
      tone(base, -0.045),
    )
    // Shallow seat-base lockers along the aisle, not tall freestanding pillars.
    for (const x of [-65, 645]) {
      s += polygon(
        [
          [x, 850],
          [x + 220, 850],
          [x + 235, 982],
          [x - 15, 982],
        ],
        mix(c.trim, base, 0.73),
      )
      s += box(x - 3, 850, 226, 10, mix(c.trim, base, 0.46))
      s += box(x + 9, 874, 202, 81, mix(c.wall, base, 0.67))
      s += box(x + 87, 900, 42, 4, mix(c.trim, base, 0.4))
      s += beam(x - 15, 984, x + 235, 984, 4, tone(base, -0.13))
    }
  } else if (p.foreground === 'stone') {
    s += polygon(
      [
        [-360, 910],
        [210, 880],
        [260, 1160],
        [-570, 1260],
      ],
      tone(base, 0.025),
    )
    s += polygon(
      [
        [265, 850],
        [820, 875],
        [1040, 1250],
        [330, 1160],
      ],
      tone(base, -0.025),
    )
    s +=
      beam(260, 906, 330, 1160, 3, seam) + beam(-570, 1260, 1040, 1250, 3, mix(base, c.trim, 0.11))
  } else if (p.foreground === 'organic') {
    s += polygon(
      [
        [-900, 1050],
        [-350, 915],
        [80, 870],
        [470, 893],
        [960, 864],
        [1700, 1030],
        [1700, 1580],
        [-900, 1580],
      ],
      tone(base, -0.025),
    )
    s += curvedBand(
      [
        [-400, 1170],
        [-30, 1060],
        [280, 1020],
        [610, 1045],
        [1080, 1100],
      ],
      3,
      seam,
    )
  } else if (p.foreground === 'platform') {
    s += polygon(
      [
        [-700, 970],
        [-80, 870],
        [880, 870],
        [1500, 970],
        [1500, 1080],
        [-700, 1080],
      ],
      tone(base, -0.025),
    )
    s += curvedBand(
      [
        [-700, 1080],
        [-130, 1010],
        [400, 988],
        [930, 1010],
        [1500, 1080],
      ],
      4,
      seam,
    )
  } else if (p.foreground === 'workshop') {
    s += box(-900, 865, 2600, 110, tone(base, -0.055)) + box(-900, 970, 2600, 5, shadow)
    s += polygon(
      [
        [80, 975],
        [720, 975],
        [820, 1010],
        [-20, 1010],
      ],
      tone(base, -0.08),
    )
  } else {
    // Quiet reading-floor grain follows the original room's vanishing point, not a tile grid.
    for (const x of [-200, 490, 1180]) {
      const start =
        p.vanishing.x + (x - p.vanishing.x) * ((820 - p.vanishing.y) / (1580 - p.vanishing.y))
      s += beam(start, 820, x, 1580, 2, mix(base, c.trim, 0.1))
    }
    s += oval(400, 902, 330, 28, mix(base, c.wall, 0.07))
  }
  return s
}

function lowerFeature({ world: c, plan: p, edge: e }: Room) {
  let x = p.lowerX
  const base = e.lower,
    trim = mix(c.trim, base, 0.45),
    ink = tone(base, -0.22),
    y = 1060
  if (p.foreground === 'cabin' && ['drawers', 'cases'].includes(p.lowerFeature)) return '' // The aisle's built-in seat-base lockers already fulfill this function.
  const onFront = ['counter', 'workshop'].includes(p.foreground)
  let s = ''
  if (p.lowerFeature === 'foot-rail')
    return box(90, 1000, 620, 7, trim) + box(115, 975, 7, 25, ink) + box(668, 975, 7, 25, ink)
  if (p.lowerFeature === 'rug-edge' || p.lowerFeature === 'woven-edge') {
    const width = p.foreground === 'tatami' ? 650 : 540
    s += box(x - width / 2, y, width, 8, mix(base, c.trim, 0.2))
    s += box(x - width / 2, y + 10, width, 3, mix(base, c.trim, 0.1))
    for (const dx of [-230, -140, -50, 40, 130, 220])
      s += beam(x + dx, y + 16, x + dx + 5, y + 27, 2, trim)
    return s
  }
  if (p.lowerFeature === 'planter') {
    const right = x > 400,
      left = right ? 650 : -80
    s += oval(left + 115, y + 76, 135, 14, tone(base, -0.08))
    s += polygon(
      [
        [left, y - 14],
        [left + 230, y - 14],
        [left + 212, y + 68],
        [left + 18, y + 68],
      ],
      mix(c.trim, base, 0.63),
    )
    s += box(left - 5, y - 21, 240, 10, trim)
    for (const [dx, height] of [
      [30, 62],
      [90, 88],
      [154, 58],
      [205, 74],
    ]) {
      s += beam(left + dx, y - 21, left + dx - 8, y - 21 - height, 3, '#637358')
      s +=
        oval(left + dx - 19, y - 21 - height * 0.62, 22, 8, '#718065') +
        oval(left + dx + 9, y - 21 - height * 0.82, 18, 7, '#63765b')
    }
    return s
  }
  if (p.lowerFeature === 'drawers') {
    const top = onFront ? 890 : 950,
      width = onFront ? 260 : 180,
      height = onFront ? 170 : 150
    s += box(x - width / 2 - 6, top - 5, width + 12, height + 12, trim)
    for (const row of [0, 1])
      s +=
        box(
          x - width / 2 + 2,
          top + (row * height) / 2,
          width - 4,
          height / 2 - 4,
          mix(c.floor, base, 0.6),
        ) + box(x - 20, top + (row * height) / 2 + height / 4, 40, 4, trim)
    if (!onFront) s += oval(x, top + height + 12, width * 0.6, 9, tone(base, -0.08))
    return s
  }
  if (p.lowerFeature === 'cases') {
    if (p.foreground === 'platform') {
      return (
        polygon(
          [
            [x - 126, 986],
            [x + 126, 986],
            [x + 145, 1048],
            [x - 145, 1048],
          ],
          trim,
        ) +
        polygon(
          [
            [x - 116, 994],
            [x + 116, 994],
            [x + 130, 1041],
            [x - 130, 1041],
          ],
          mix(c.wall, base, 0.68),
        ) +
        box(x - 25, 1014, 50, 5, trim)
      )
    }
    if (onFront) {
      // Parcels rest inside a recessed counter cubby, not on a vertical panel.
      return (
        box(x - 103, 945, 206, 150, trim) +
        box(x - 95, 953, 190, 126, tone(base, -0.22)) +
        box(x - 80, 990, 160, 82, mix(c.trim, base, 0.57)) +
        box(x - 51, 990, 5, 82, ink) +
        box(x + 45, 990, 5, 82, ink) +
        box(x - 24, 982, 48, 8, trim) +
        box(x - 100, 1072, 200, 12, trim)
      )
    }
    s +=
      oval(x, y + 48, 102, 10, tone(base, -0.08)) +
      box(x - 80, y - 40, 160, 82, mix(c.trim, base, 0.57))
    return (
      s +
      box(x - 51, y - 40, 5, 82, ink) +
      box(x + 45, y - 40, 5, 82, ink) +
      box(x - 24, y - 48, 48, 8, trim)
    )
  }
  if (p.lowerFeature === 'books') {
    const top = onFront ? 1000 : 1080
    if (onFront) {
      s += box(x - 98, top - 57, 196, 86, trim)
      s += box(x - 90, top - 49, 180, 66, tone(base, -0.22))
      s += box(x - 96, top + 16, 192, 10, trim)
    }
    if (!onFront) s += oval(x, top + 34, 95, 9, tone(base, -0.08))
    for (const [i, width] of [138, 124, 147].entries())
      s +=
        box(x - width / 2, top - i * 18, width, 16, mix(c.trim, base, 0.45 + i * 0.1)) +
        box(x - width / 2 + 5, top - i * 18 + 3, width - 10, 8, mix(c.trim, '#c7b899', 0.3))
    return s
  }
  if (p.lowerFeature === 'cables') {
    s += box(80, 1065, 640, 24, mix(c.wall, base, 0.65)) + box(90, 1069, 620, 3, trim)
    return (
      s +
      curvedBand(
        [
          [x, 1088],
          [x + 5, 1120],
          [x + 30, 1140],
          [x + 67, 1133],
          [x + 78, 1100],
        ],
        3,
        mix(c.trim, base, 0.3),
      )
    )
  }
  if (p.lowerFeature === 'stone-step')
    return (
      polygon(
        [
          [-200, 1015],
          [1000, 1015],
          [1100, 1080],
          [-300, 1080],
        ],
        tone(base, 0.045),
      ) +
      polygon(
        [
          [-300, 1080],
          [1100, 1080],
          [1100, 1116],
          [-300, 1116],
        ],
        tone(base, -0.06),
      ) +
      box(-300, 1116, 1400, 5, tone(base, -0.12))
    )
  if (p.lowerFeature === 'roots') {
    s += curvedBand(
      [
        [x < 400 ? -70 : 870, 805],
        [x < 400 ? 0 : 800, 870],
        [x, 1020],
        [x + 110, 1110],
        [x + 250, 1160],
      ],
      28,
      mix(c.trim, base, 0.72),
    )
    return (
      s +
      curvedBand(
        [
          [x, 1020],
          [x - 95, 1060],
          [x - 160, 1125],
        ],
        15,
        mix(c.trim, base, 0.76),
      )
    )
  }
  if (p.lowerFeature === 'cushion') {
    s += oval(x, y + 65, 120, 13, tone(base, -0.07))
    s += polygon(
      [
        [x - 95, y - 30],
        [x + 80, y - 35],
        [x + 115, y + 45],
        [x - 110, y + 52],
      ],
      mix(c.trim, base, 0.44),
    )
    return (
      s +
      beam(x - 95, y - 30, x + 80, y - 35, 3, mix(c.trim, base, 0.17)) +
      beam(x - 106, y + 39, x + 107, y + 33, 3, mix(base, c.trim, 0.12))
    )
  }
  if (p.lowerFeature === 'joinery') {
    s += box(0, 1020, 800, 10, trim) + box(0, 1030, 800, 14, mix(base, c.trim, 0.08))
    for (const dx of [45, 755]) s += box(dx, 1017, 6, 17, mix(c.trim, base, 0.2))
  }
  return s
}

/** Clip a real surface to its source tangent rather than stretching a wedge. */
function belowLine(points: number[][], yAt: (x: number) => number): number[][] {
  const result: number[][] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length]
    const da = a[1] - yAt(a[0]),
      db = b[1] - yAt(b[0])
    if (da >= 0) result.push(a)
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db)
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return result
}
function polygonPath(points: number[][]): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x)} ${py(y)}`).join('') + 'Z'
}
function clipSidePolygon(
  points: number[][],
  left: number,
  right: number,
  top: number,
  bottom: number,
): number[][] {
  let result = points
  for (const distance of [
    (p: number[]) => p[0] - left,
    (p: number[]) => right - p[0],
    (p: number[]) => p[1] - top,
    (p: number[]) => bottom - p[1],
  ]) {
    const next: number[][] = []
    for (let i = 0; i < result.length; i++) {
      const a = result[i],
        b = result[(i + 1) % result.length],
        da = distance(a),
        db = distance(b)
      if (da >= 0) next.push(a)
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db)
        next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
      }
    }
    result = next
  }
  return result
}
function sideFloorPattern(
  c: SceneWorld,
  j: SceneWorldJunction,
  left: number,
  right: number,
  base: string,
) {
  if (j.source !== 'premium') return ''
  let fill = '',
    stroke = ''
  const clipped = (points: number[][]) =>
    belowLine(clipSidePolygon(points, left, right, 0, 820), (x) => sideFloorAt(j, x))
  const line = (a: number[], b: number[], width: number) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (!length) return
    const dx = ((b[1] - a[1]) * width) / length / 2,
      dy = ((a[0] - b[0]) * width) / length / 2
    const shape = clipped([
      [a[0] + dx, a[1] + dy],
      [b[0] + dx, b[1] + dy],
      [b[0] - dx, b[1] - dy],
      [a[0] - dx, a[1] - dy],
    ])
    if (shape.length >= 3) stroke += polygonPath(shape)
  }
  const shape = (points: number[][]) => {
    const p = clipped(points)
    if (p.length >= 3) fill += polygonPath(p)
  }
  const kind = j.floorMaterial
  let color = '#d2b78b',
    alpha = 0.15
  if (['tile', 'mosaic'].includes(kind)) {
    color = '#c3ba99'
    alpha = 0.2
    for (let y = 630; y <= 820; y += 30) line([left, y], [right, y], 2)
    for (const x of [-120, 860]) {
      const y = 820 + ((left - x) * (590 - 820)) / (400 - x)
      line([left, y], [right, 820 + ((right - x) * (590 - 820)) / (400 - x)], 2)
    }
  } else if (kind === 'tatami') {
    color = '#c7bd8a'
    alpha = 0.35
    for (let y = 625; y <= 820; y += 42) line([left, y], [right, y], 2)
    for (let x = Math.floor(left / 190) * 190; x < right; x += 190) line([x, 600], [x, 820], 2)
  } else if (kind === 'metal') {
    color = '#aec2b5'
    alpha = 0.17
    for (let i = -4; i < 9; i++) {
      const x = i * 230
      line([x, 640], [x - 80, 820], 2)
      const panel = [
        [x - 70, 670],
        [x + 100, 670],
        [x + 85, 760],
        [x - 45, 760],
        [x - 70, 670],
      ]
      for (let n = 1; n < panel.length; n++) line(panel[n - 1], panel[n], 2)
    }
  } else if (['parquet', 'herringbone'].includes(kind)) {
    for (let i = -6; i < 12; i++) {
      const x = i * 155 - 90,
        triangle = [
          [x, 820],
          [x + 150, 710],
          [x + 65, 645],
        ]
      shape(triangle)
      line(triangle[0], triangle[1], 2)
      line(triangle[1], triangle[2], 2)
      line([x + 85, 710], [x + 235, 820], 2)
    }
  } else if (kind === 'onsen-deck') {
    for (const y of [630, 695, 760]) line([left, y], [right, y], 4)
    color = '#5b6248'
    alpha = 1
  } else if (kind !== 'carpet') {
    for (let i = -6; i < 12; i++) line([i * 155, 610], [i * 155 - 65, 820], 2)
  }
  if (c.id === 'premium-storm-lighthouse')
    for (const y of [620, 660, 700]) line([left, y], [right, y], 3)
  return (
    (fill ? `<path d="${fill}" fill="${mix(base, '#000000', 0.15)}" stroke="none"/>` : '') +
    (stroke ? `<path d="${stroke}" fill="${mix(base, color, alpha)}" stroke="none"/>` : '')
  )
}
function premiumSideOpening(c: SceneWorld, left: number, right: number) {
  const p = PREMIUM_SIDE_OPENINGS[c.id]
  if (!p) return ''
  let s = ''
  for (let y = p.top; y < p.bottom; y += 16)
    s += box(left, y, right - left, Math.min(16, p.bottom - y), mix('#102c38', '#526c60', y / 820))
  const paints = new Map<string, string>()
  const add = (points: number[][], color: string) => {
    const clipped = clipSidePolygon(points, left, right, p.top, p.bottom)
    if (clipped.length >= 3) paints.set(color, (paints.get(color) || '') + polygonPath(clipped))
  }
  if (c.id === 'premium-onsen-veranda') {
    for (let i = -8; i < 16; i++) {
      const x = i * 120 - 20,
        n = ((i % 3) + 3) % 3,
        y = 100 + n * 45
      add(
        [
          [x - 6.5, 150 + n * 45],
          [x + 6.5, 150 + n * 45],
          [x + 6.5, 630 + n * 45],
          [x - 6.5, 630 + n * 45],
        ],
        '#405842',
      )
      add(
        [
          [x, y],
          [x - 75, y + 170],
          [x - 40, y + 170],
          [x - 110, y + 290],
          [x + 110, y + 290],
          [x + 40, y + 170],
          [x + 75, y + 170],
        ],
        '#496341',
      )
    }
  } else {
    for (let i = -12; i < 24; i++) {
      const x = i * 80 - 20,
        n = ((i % 4) + 4) % 4,
        y = 210 + n * 38,
        color = i % 2 ? '#28434b' : '#20373f'
      add(
        [
          [x, y],
          [x + 66, y],
          [x + 66, y + 420],
          [x, y + 420],
        ],
        color,
      )
      for (let j = 0; j < 5; j++)
        for (const dx of [16, 39])
          add(
            [
              [x + dx, 245 + n * 38 + j * 50 - 3.5],
              [x + dx + 7, 245 + n * 38 + j * 50 - 3.5],
              [x + dx + 7, 245 + n * 38 + j * 50 + 3.5],
              [x + dx, 245 + n * 38 + j * 50 + 3.5],
            ],
            mix(color, i % 3 ? '#998b62' : '#6e9290', 0.6),
          )
    }
  }
  for (const [color, d] of paints) s += `<path d="${d}" fill="${color}" stroke="none"/>`
  s += box(left, p.horizon, right - left, p.bottom - p.horizon, p.water)
  if (p.railY) {
    s += box(left, p.railY - 3.5, right - left, 7, p.railColor!)
    for (let x = Math.floor(left / 140) * 140 + 50; x < right; x += 140)
      s += box(x - 3.5, p.railY, 7, p.bottom - p.railY, p.railColor!)
  }
  s +=
    box(left, p.top - 8.5, right - left, 17, c.trim) +
    box(left, p.bottom - 8.5, right - left, 17, c.trim)
  return s
}

/** Physical continuation of the authored side surfaces, in source coordinates. */
function sideWalls({ world: c, edge: e }: Room) {
  const j = getSceneWorldJunction(c.id)
  const dim = (color: string) =>
    mix(
      color,
      '#07100e',
      j.source === 'ordinary' ? 0.12 : ['barista', 'dome'].includes(j.source) ? 0.08 : 0,
    )
  const floorColor =
    j.source === 'barista'
      ? dim('#342e22')
      : j.source === 'dome'
        ? dim('#514631')
        : j.floorMaterial === 'onsen-deck'
          ? '#7d7051'
          : dim(c.floor)
  let s = ''
  for (const [left, right, border, wall] of [
    [-900, 0, 0, e.left],
    [800, 1700, 800, e.right],
  ] as const) {
    const yl = sideFloorAt(j, left),
      yr = sideFloorAt(j, right)
    s += polygon(
      [
        [left, yl],
        [right, yr],
        [right, 1580],
        [left, 1580],
      ],
      floorColor,
    )
    if (j.horizon) {
      // These are actual exposed landscape planes, not colored wall panels.
      for (let y = 0; y < j.floorLeft; y += 20)
        s += box(
          left,
          y,
          right - left,
          Math.min(20, j.floorLeft - y),
          dim(mix('#10242e', '#536455', y / 820)),
        )
      if (c.id === 'water-lake') {
        const hills =
          border === 0
            ? [
                { y: 440, slope: -230 / 160, color: '#223a3d' },
                { y: 530, slope: -180 / 250, color: '#1a302f' },
              ]
            : [
                { y: 420, slope: 250 / 250, color: '#223a3d' },
                { y: 450, slope: 120 / 150, color: '#1a302f' },
              ]
        for (const hill of hills) {
          const shape = belowLine(
            [
              [left, 0],
              [right, 0],
              [right, 650],
              [left, 650],
            ],
            (x) => hill.y + (x - border) * hill.slope,
          )
          if (shape.length >= 3) s += polygon(shape, dim(hill.color))
        }
      }
      s += box(left, j.horizon.y, right - left, j.floorLeft - j.horizon.y, dim(j.horizon.color))
      // Existing source canopy slab and deck remain at their original heights.
      s += box(left, 0, right - left, 107, dim(c.wall))
      s += sideMaterial(c, j, left, right, dim)
    } else {
      const sourceWall =
        j.source === 'premium'
          ? ['paper', 'lattice'].includes(j.wallMaterial)
            ? mix(c.wall, '#000000', 0.15)
            : c.wall
          : j.source === 'ordinary'
            ? dim(c.wall)
            : wall
      s += polygon(
        [
          [left, 0],
          [right, 0],
          [right, yr],
          [left, yl],
        ],
        sourceWall,
      )
      if (j.source === 'original' && border === 0) {
        for (let y = 0; y < Math.max(yl, yr); y += 16)
          s += polygon(
            [
              [left, y],
              [right, y],
              [right, Math.min(y + 16, yr)],
              [left, Math.min(y + 16, yl)],
            ],
            mix('#252a24', '#121a18', Math.max(0, Math.min(1, (border / 800 + y / 820) / 2))),
          )
      }
      if (j.source === 'dome')
        s += polygon(
          [
            [left, 0],
            [right, 0],
            [right, yr],
            [left, yl],
          ],
          dim('#68604c'),
        )
      if (j.source !== 'dome') s += sideMaterial(c, j, left, right, dim)
      if (j.source === 'dome') {
        // Return the hull into the dark outer room with the same vertical
        // tangent as Q0 20 400 20 at the source spring (0,397). Mirroring
        // its quadratic progression outward makes a curved structural return,
        // never a horizontal brown band across the neighboring room.
        const curve = Array.from({ length: 65 }, (_, i) => {
          const t = i / 64,
            distance = 400 * t * t
          return [border === 0 ? -distance : 800 + distance, 397 + 754 * t + 377 * t * t]
        })
        const dark =
          border === 0
            ? [[left, 0], [right, 0], ...curve, [left, 1580]]
            : [[left, 0], [right, 0], [right, 1580], ...curve.reverse()]
        const clipped = belowLine(clipSidePolygon(dark, left, right, 0, 1580), (x) => 0)
        const wallOnly = clipPolygonBelowFloor(clipped, j)
        if (wallOnly.length >= 3) s += polygon(wallOnly, dim('#272a24'))
        // Source stone ink covers both materials; native alpha composites it
        // against the actual background instead of a preblended brown base.
        s += sideMaterial(c, j, left, right, dim)
      }
      s += premiumSideOpening(c, left, right)
      if (c.id === 'premium-newyear-attic') s += box(left, 0, right - left, 440, '#5b5140')
    }
    s += sideFloorPattern(c, j, left, right, floorColor)
    // Extend only source lines that actually cross this border; clipping keeps
    // every new line outside the preserved original composition.
    const lines: number[][] =
      j.source === 'ordinary'
        ? j.horizon
          ? [
              [0, 690, 800, 650],
              [0, 750, 800, 700],
            ]
          : [
              [0, 704, 800, 661],
              [0, 770, 800, 708],
            ]
        : j.source === 'premium'
          ? [
              [0, 660, 800, 625],
              [0, 730, 800, 675],
            ]
          : j.source === 'barista'
            ? [
                [0, 715, 800, 666],
                [0, 776, 800, 718],
              ]
            : j.source === 'dome'
              ? [[0, 756, 800, 756]]
              : []
    for (const [x1, y1, x2, y2] of lines) {
      const slope = (y2 - y1) / (x2 - x1)
      const a = y1 + (left - x1) * slope,
        b = y1 + (right - x1) * slope
      s += beam(
        left,
        a,
        right,
        b,
        j.source === 'premium' ? 2 : 3,
        mix(
          floorColor,
          dim(j.source === 'premium' ? '#c0a67b' : '#b18b5e'),
          j.source === 'premium' ? 0.18 : 0.22,
        ),
      )
    }
    if (j.rail) {
      for (const y of j.rail.courses)
        s += box(left, y - j.rail.width / 2, right - left, j.rail.width, dim(c.trim))
      for (let x = border === 0 ? -40 : 840; x > left && x < right; x += border === 0 ? -140 : 140)
        s += box(x - 3.5, 585, 7, j.rail.bottom - 585, dim(c.trim))
    }
  }
  return s
}

/** Reproduce the original RoomWallTexture's user-space tile, including clipped
 * overhanging curves. Stroke outlines are baked into native filled geometry. */
function ordinarySideTexture(
  c: SceneWorld,
  j: SceneWorldJunction,
  left: number,
  right: number,
  dim: (s: string) => string,
) {
  const material = j.wallMaterial
  const interior = getSceneInterior(c.id)
  const pw = material === 'brick' ? 96 : material === 'stone' ? 112 : material === 'logs' ? 48 : 64
  const ph = material === 'brick' ? 44 : material === 'stone' ? 76 : 64
  const paths = new Map<number, string>()
  const add = (points: number[][], width = 1.5, opacity = 0.22, tx = 0, ty = 0) => {
    let d = paths.get(opacity) ?? ''
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        length = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (!length) continue
      const nx = ((b[1] - a[1]) * width) / (2 * length),
        ny = ((a[0] - b[0]) * width) / (2 * length)
      const polygon = [
        [a[0] + nx + tx, a[1] + ny + ty],
        [b[0] + nx + tx, b[1] + ny + ty],
        [b[0] - nx + tx, b[1] - ny + ty],
        [a[0] - nx + tx, a[1] - ny + ty],
      ]
      const clipped = clipSidePolygon(
        polygon,
        Math.max(left, tx),
        Math.min(right, tx + pw),
        Math.max(0, ty),
        Math.min(j.textureBottom, ty + ph),
      )
      if (clipped.length >= 3) d += polygonPath(clipped)
    }
    paths.set(opacity, d)
  }
  const curve = (a: number[], b: number[], e: number[]) =>
    Array.from({ length: 13 }, (_, i) => {
      const t = i / 12,
        u = 1 - t
      return [
        u * u * a[0] + 2 * u * t * b[0] + t * t * e[0],
        u * u * a[1] + 2 * u * t * b[1] + t * t * e[1],
      ]
    })
  for (let y = 0; y < j.textureBottom; y += ph)
    for (let x = Math.floor(left / pw) * pw; x < right; x += pw) {
      const stroke = (points: number[][], width = 1.5, opacity = 0.22) =>
        add(points, width, opacity, x, y)
      const line = (x1: number, y1: number, x2: number, y2: number, width = 1.5, opacity = 0.22) =>
        stroke(
          [
            [x1, y1],
            [x2, y2],
          ],
          width,
          opacity,
        )
      if (material === 'stone') {
        stroke(
          [
            [0, 4],
            [46, 0],
            [112, 9],
          ],
          2,
        )
        stroke(
          [
            [0, 43],
            [62, 38],
            [112, 47],
          ],
          2,
        )
        line(0, 75, 112, 75, 2)
        line(46, 0, 41, 39, 2)
        line(62, 39, 72, 76, 2)
      } else if (material === 'brick') {
        for (const yy of [1, 23, 43]) line(0, yy, 96, yy)
        line(47, 1, 47, 23)
        line(0, 23, 0, 43)
        line(95, 23, 95, 43)
      } else if (material === 'slats') {
        for (const xx of [1, 31, 63]) line(xx, 0, xx, 64)
        for (const xx of [9, 42]) line(xx, 0, xx, 64, 1.5, 0.09)
      } else if (material === 'logs') {
        for (const yy of [2, 30, 62]) line(0, yy, 64, yy, 5)
        stroke(curve([4, 11], [30, 7], [64, 12]))
        stroke(curve([3, 43], [35, 38], [64, 44]))
      } else if (material === 'panels' || material === 'lattice') {
        const offsets = material === 'lattice' ? [2, 32, 62] : [2, 62],
          width = material === 'lattice' ? 2.5 : 1.5
        for (const v of offsets) {
          line(v, 0, v, 64, width)
          line(0, v, 64, v, width)
        }
      } else if (material === 'canvas') {
        for (let yy = 1; yy <= 61; yy += 6) line(0, yy, 64, yy, 1.5, 0.09)
        for (const xx of [16, 48]) line(xx, 0, xx, 64)
      } else if (material === 'metal') {
        line(0, 2, 64, 2)
        line(2, 0, 2, 64)
        for (const [cx, cy] of [
          [8, 8],
          [55, 55],
        ])
          stroke(
            Array.from({ length: 17 }, (_, i) => [
              cx + 1.6 * Math.cos((i * Math.PI) / 8),
              cy + 1.6 * Math.sin((i * Math.PI) / 8),
            ]),
          )
      }
    }
  return [...paths]
    .map(([opacity, d]) =>
      d
        ? j.source === 'dome'
          ? `<path d="${d}" fill="${dim(interior.wall.detail)}" fill-opacity="${opacity}" stroke="none"/>`
          : `<path d="${d}" fill="${mix(dim(c.wall), dim(interior.wall.detail), opacity)}" stroke="none"/>`
        : '',
    )
    .join('')
}

function clipPolygonBelowFloor(points: number[][], j: SceneWorldJunction) {
  if (!points.length) return points
  const result: number[][] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      da = sideFloorAt(j, a[0]) - a[1],
      db = sideFloorAt(j, b[0]) - b[1]
    if (da >= 0) result.push(a)
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db)
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return result
}

/** Source-periodic wall material, clipped to the exterior side bay. Paths are
 * consolidated by paint to bound native draw instructions, not rasterized. */
function sideMaterial(
  c: SceneWorld,
  j: SceneWorldJunction,
  left: number,
  right: number,
  dim: (s: string) => string,
) {
  const material = j.wallMaterial,
    premium = j.source === 'premium'
  if (
    premium &&
    [
      'brick',
      'stone',
      'adobe',
      'panel',
      'timber',
      'painted',
      'bark',
      'beams',
      'acoustic',
      'lattice',
      'paper',
    ].includes(material)
  )
    return ''
  const detail = premium ? '#c2ad87' : getSceneInterior(c.id).wall.detail
  const color = mix(dim(c.wall), dim(detail), premium ? 0.15 : 0.22)
  if (
    !premium &&
    ['brick', 'slats', 'logs', 'panels', 'stone', 'canvas', 'metal', 'lattice'].includes(material)
  )
    return ordinarySideTexture(c, j, left, right, dim)
  let d = ''
  const r = (x: number, y: number, w: number, h: number) => {
    const a = Math.max(left, x),
      b = Math.min(right, x + w),
      top = Math.max(0, y),
      bottom = Math.min(j.textureBottom, sideFloorAt(j, a), sideFloorAt(j, b), y + h)
    if (b > a && bottom > top) d += `M${px(a)} ${py(top)}H${px(b)}V${py(bottom)}H${px(a)}Z`
  }
  const horizontal = (period: number, offsets: number[], width = 1.5) => {
    for (let y = 0; y < j.textureBottom; y += period)
      for (const off of offsets) r(left, y + off - width / 2, right - left, width)
  }
  const vertical = (period: number, offsets: number[], width = 1.5) => {
    for (let x = Math.floor(left / period) * period; x < right; x += period)
      for (const off of offsets) r(x + off - width / 2, 0, width, j.textureBottom)
  }
  if (material === 'rivets' && premium) {
    // The original material path has an implicit triangular fill, not a
    // rectangular metal panel. Preserve that real source-plane pattern.
    let triangles = ''
    for (let x = Math.floor(left / 80) * 80; x < right; x += 80)
      for (let y = 0; y < j.textureBottom; y += 80) {
        const points = clipSidePolygon(
          [
            [x, y + 1],
            [x + 80, y + 1],
            [x + 80, y + 80],
          ],
          left,
          right,
          0,
          j.textureBottom,
        )
        if (points.length >= 3) triangles += polygonPath(points)
        r(x, y + 0.25, 80, 1.5)
        r(x + 79.25, y + 1, 1.5, 79)
        for (const [dx, dy] of [
          [8, 9],
          [72, 71],
        ]) {
          const circle = Array.from({ length: 12 }, (_, i) => [
            x + dx + 2 * Math.cos((i * Math.PI) / 6),
            y + dy + 2 * Math.sin((i * Math.PI) / 6),
          ])
          const clipped = clipSidePolygon(circle, left, right, 0, j.textureBottom)
          if (clipped.length >= 3) triangles += polygonPath(clipped)
        }
      }
    return triangles
      ? `<path d="${triangles}" fill="${mix(c.wall, '#000000', 0.15)}" stroke="none"/>`
      : ''
  } else if (material === 'metal') {
    horizontal(64, [2])
    vertical(64, [2])
    for (let x = Math.floor(left / 64) * 64; x < right; x += 64)
      for (let y = 0; y < j.textureBottom; y += 64) {
        r(x + 7, y + 7, 2.5, 2.5)
        r(x + 54, y + 54, 2.5, 2.5)
      }
  } else if (material === 'brick') {
    const pw = premium ? 120 : 96,
      ph = premium ? 52 : 44
    horizontal(ph, premium ? [1, 26, 51] : [1, 23, 43])
    for (let y = 0; y < j.textureBottom; y += ph)
      for (let x = Math.floor(left / pw) * pw; x < right; x += pw) {
        r(x + pw / 2, y, 1.5, ph / 2)
        r(x, y + ph / 2, 1.5, ph / 2)
      }
  } else if (['panels', 'panel', 'lattice', 'paper'].includes(material)) {
    const pw = premium ? 80 : 64
    vertical(
      pw,
      ['lattice', 'paper'].includes(material) ? [2, pw / 2, pw - 2] : [2, pw - 2],
      material === 'lattice' ? 2.5 : 1.5,
    )
    horizontal(
      pw,
      ['lattice', 'paper'].includes(material) ? [2, pw / 2, pw - 2] : [2, pw - 2],
      material === 'lattice' ? 2.5 : 1.5,
    )
  } else if (['slats', 'timber', 'painted', 'bark', 'beams', 'acoustic'].includes(material)) {
    vertical(premium ? 80 : 64, premium ? [8, 18, 70] : [1, 31, 63])
  } else if (material === 'canvas') {
    horizontal(64, [1, 7, 13, 19, 25, 31, 37, 43, 49, 55, 61], 0.5)
    vertical(64, [16, 48])
  } else if (material === 'logs') {
    horizontal(64, [2, 30, 62], 5)
  } else if (['stone', 'adobe'].includes(material)) {
    horizontal(premium ? 52 : 76, premium ? [1, 26, 51] : [4, 43, 75])
    for (let y = 0; y < j.textureBottom; y += premium ? 52 : 76)
      for (let x = Math.floor(left / 112) * 112; x < right; x += 112) {
        r(x + 46, y, 2, 39)
        r(x + 62, y + 39, 2, 37)
      }
  }
  if (
    material === 'wallpaper' ||
    (premium &&
      ![
        'brick',
        'stone',
        'adobe',
        'panel',
        'timber',
        'painted',
        'bark',
        'beams',
        'acoustic',
        'rivets',
        'lattice',
        'paper',
      ].includes(material))
  ) {
    const period = premium ? 80 : 64
    let fill = ''
    const q = (a: number[], control: number[], end: number[], steps = 8) =>
      Array.from({ length: steps }, (_, i) => {
        const t = (i + 1) / steps,
          u = 1 - t
        return [
          u * u * a[0] + 2 * u * t * control[0] + t * t * end[0],
          u * u * a[1] + 2 * u * t * control[1] + t * t * end[1],
        ]
      })
    const leaf = (cx: number, y: number, w: number, h: number) => [
      [cx, y],
      ...q([cx, y], [cx - w, y + h * 0.5], [cx, y + h]),
      ...q([cx, y + h], [cx + w, y + h * 0.5], [cx, y]),
    ]
    for (let x = Math.floor(left / period) * period - period; x < right + period; x += period)
      for (let y = 0; y < j.textureBottom; y += period) {
        const shapes =
          material === 'wallpaper'
            ? premium
              ? [leaf(x + 40, y + 5, 28, 35), leaf(x + 40, y + 40, 28, 35)]
              : [leaf(x + 32, y + 6, 22, 27), leaf(x, y + 39, 20, 25)]
            : [
                [[x + 4, y + 16], ...q([x + 4, y + 16], [x + 31, y + 2], [x + 64, y + 16])],
                [[x + 10, y + 67], ...q([x + 10, y + 67], [x + 40, y + 55], [x + 70, y + 67])],
              ]
        for (const shape of shapes) {
          const clipped = clipSidePolygon(shape, left, right, 0, j.textureBottom)
          if (clipped.length >= 3) fill += polygonPath(clipped)
          for (let i = 1; i < shape.length; i++) {
            const a = shape[i - 1],
              b = shape[i],
              len = Math.hypot(b[0] - a[0], b[1] - a[1])
            if (!len) continue
            const dx = ((b[1] - a[1]) * 0.75) / len,
              dy = ((a[0] - b[0]) * 0.75) / len
            const stroke = clipSidePolygon(
              [
                [a[0] + dx, a[1] + dy],
                [b[0] + dx, b[1] + dy],
                [b[0] - dx, b[1] - dy],
                [a[0] - dx, a[1] - dy],
              ],
              left,
              right,
              0,
              j.textureBottom,
            )
            if (stroke.length >= 3) d += polygonPath(stroke)
          }
        }
      }
    // Premium source leaves carry their default black fill under the pale outline;
    // ordinary wallpaper is explicitly fill=none and retains only its outline.
    return (
      (premium && fill
        ? `<path d="${fill}" fill="${mix(c.wall, '#000000', 0.15)}" stroke="none"/>`
        : '') + (!premium && d ? `<path d="${d}" fill="${color}" stroke="none"/>` : '')
    )
  }
  return d ? `<path d="${d}" fill="${color}" stroke="none"/>` : ''
}

/** A core-edge foreground plane must occlude side fixtures just as the original
 * table occludes its own room. This is a material surface, never a border cover. */
function sideForeground({ world: c }: Room) {
  const j = getSceneWorldJunction(c.id)
  const opening = PREMIUM_SIDE_OPENINGS[c.id]
  if (opening)
    return (
      box(-900, opening.beamY - opening.beamWidth / 2, 900, opening.beamWidth, opening.beamColor) +
      box(800, opening.beamY - opening.beamWidth / 2, 900, opening.beamWidth, opening.beamColor)
    )
  if (!j.counter) return ''
  let s = ''
  const shade = (y: number) => {
    const t = Math.max(0, Math.min(1, (y - 625) / 195))
    return t < 0.1 ? mix('#786046', '#5c4835', t / 0.1) : mix('#5c4835', '#29271f', (t - 0.1) / 0.9)
  }
  for (const [left, right] of [
    [-900, 0],
    [800, 1700],
  ]) {
    const top = (x: number) => 665 - x * 0.05
    for (let y = 575; y < 820; y += 8) {
      const end = Math.min(820, y + 8)
      const rect = [
        [left, y],
        [right, y],
        [right, end],
        [left, end],
      ]
      const surface = belowLine(rect, top)
      if (surface.length >= 3) s += polygon(surface, shade(y + 4))
      const shadow = belowLine(surface, (x) =>
        left < 0 ? 802 - x * 0.1 : 792 + ((x - 800) * 50) / 900,
      )
      if (shadow.length >= 3) s += polygon(shadow, mix(shade(y + 4), '#101813', 0.45))
    }
    for (const [y, slope] of [
      [700, -47 / 800],
      [763, -71 / 800],
    ])
      s += beam(left, y + left * slope, right, y + right * slope, 1, mix(shade(y), '#9d805b', 0.25))
  }
  return s
}

function attachedSupports({ world: c, plan: p, edge: e }: Room) {
  if (['counter', 'workshop'].includes(p.foreground)) return ''
  let s = ''
  for (const support of e.lowerSupports ?? []) {
    // Palette-run detection cannot distinguish chest trim from a leg. Only a
    // semantic source annotation may extend a support beyond the preserved core.
    if (support.kind !== 'leg') continue
    const length = p.foreground === 'cabin' ? 40 : 58
    const dx = support.dx ?? 0
    s += polygon(
      [
        [support.x, 820],
        [support.x + support.width, 820],
        [support.x + support.width + dx, 820 + length],
        [support.x + dx, 820 + length],
      ],
      support.color,
    )
    s += oval(
      support.x + support.width / 2 + dx,
      823 + length,
      support.width + 8,
      3,
      mix(e.lower, c.wall, 0.09),
    )
  }
  return s
}

export function renovatedWorldContent(room: Room, layer: 'underlay' | 'joinery') {
  if (layer === 'joinery') return attachedSupports(room)
  return (
    box(-900, -760, 2600, 2340, room.world.wall) +
    floor(room) +
    sideWalls(room) +
    sceneWorldFittings(room.world) +
    sideForeground(room) +
    envelope(room) +
    upperFeature(room) +
    lowerFeature(room)
  )
}

/** Side-only structural projection, exposed for independent native registration checks. */
export function sceneWorldSideSurfaces(world: SceneWorld): string {
  const room = { world, plan: world.renovation, edge: world.edge }
  return sideWalls(room) + sideForeground(room)
}
