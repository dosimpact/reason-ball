/** Authored matte animal rigs shared by native cached geometry and CPU proofs.
 * Geometry is parsed once. Poses only move joints; original scene SVGs are untouched. */
export type AnimalDrawingSpec = {
  id: string
  species: string
  coat: string
  marking?: string
  scale: number
  home: { x: number; y: number }
  tetherAnchor?: { x: number; y: number }
}
export type AnimalDrawingState = {
  id: string
  x: number
  y: number
  action: string
  heading: number
  phase: number
  time?: number
  gaitPhase?: number
  domain?: string
  emotion?: string
}
type Point = { x: number; y: number }
export type AnimalShape = {
  points: Point[]
  fill: string
  stroke?: string
  strokeWidth?: number
  closed?: boolean
}
type Motion =
  | 'fixed'
  | 'body'
  | 'awake-body'
  | 'sleep-body'
  | 'head'
  | 'eye-open'
  | 'eye-closed'
  | 'yawn-mouth'
  | 'leg'
  | 'tail'
  | 'flight-wing'
  | 'folded-wing'
  | 'insect-wing'
  | 'fin'
  | 'tentacle'
  | 'wake'
  | 'shell'
  | 'neck'
  | 'shadow'
  | 'glow'
  | 'pet-lie'
  | 'pet-sit'
  | 'pet-bow'
  | 'pet-scratch'
export type AnimalPart = {
  name: string
  anchor: Point
  shapes: AnimalShape[]
  svgOffset?: Point
  motion?: Motion
  species?: string
  sleepHead?: { x: number; y: number; rotation: number }
}
export type AnimalPartPose = {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  alpha: number
}
export const DRAWN_ANIMAL_SPECIES = [
  'cat',
  'dog',
  'deer',
  'fox',
  'rabbit',
  'squirrel',
  'owl',
  'heron',
  'duck',
  'gull',
  'songbird',
  'dragon',
  'fish',
  'bat',
  'spider',
  'moth',
  'butterfly',
  'snail',
  'camel',
  'jellyfish',
  'ray',
  'firefly',
] as const
const known = new Set<string>(DRAWN_ANIMAL_SPECIES)
const ink = '#293b34',
  nose = '#514b3d',
  cream = '#d2c2a1'
const oval = (x: number, y: number, rx: number, ry: number, fill: string): AnimalShape => ({
  fill,
  closed: true,
  points: Array.from({ length: 32 }, (_, i) => ({
    x: x + Math.cos((i * Math.PI) / 16) * rx,
    y: y + Math.sin((i * Math.PI) / 16) * ry,
  })),
})
const poly = (points: number[][], fill: string): AnimalShape => ({
  fill,
  closed: true,
  points: points.map(([x, y]) => ({ x: x!, y: y! })),
})
const line = (points: number[][], stroke: string, width = 2): AnimalShape => ({
  fill: 'none',
  stroke,
  strokeWidth: width,
  points: points.map(([x, y]) => ({ x: x!, y: y! })),
})
const curve = (p: number[][], stroke: string, width = 2): AnimalShape => {
  const [a, b, c, d] = p as [number[], number[], number[], number[]]
  return line(
    Array.from({ length: 17 }, (_, i) => {
      const t = i / 16,
        u = 1 - t
      return [
        u * u * u * a[0]! + 3 * u * u * t * b[0]! + 3 * u * t * t * c[0]! + t * t * t * d[0]!,
        u * u * u * a[1]! + 3 * u * u * t * b[1]! + 3 * u * t * t * c[1]! + t * t * t * d[1]!,
      ]
    }),
    stroke,
    width,
  )
}
const shade = (color: string, factor: number) =>
  /^#[0-9a-f]{6}$/i.test(color)
    ? '#' +
      [1, 3, 5]
        .map((i) =>
          Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * factor))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    : color
const rigs = new Map<string, AnimalPart[]>()
function makeRig(spec: AnimalDrawingSpec): AnimalPart[] {
  const s = spec.species,
    c = spec.coat,
    m = spec.marking ?? cream,
    dark = shade(c, 0.78)
  const parts: AnimalPart[] = []
  const add = (name: string, x: number, y: number, motion: Motion, ...shapes: AnimalShape[]) => {
    if (!shapes.length) return
    const margin = Math.max(1, ...shapes.map((shape) => shape.strokeWidth ?? 0)) * 2 + 2
    const minX = Math.min(...shapes.flatMap((shape) => shape.points.map((p) => p.x))),
      minY = Math.min(...shapes.flatMap((shape) => shape.points.map((p) => p.y)))
    const part: AnimalPart = {
      name,
      anchor: { x, y },
      shapes,
      svgOffset: { x: Math.max(0, margin - minX), y: Math.max(0, margin - minY) },
      motion,
      species: s,
    }
    parts.push(part)
    return part
  }
  const head = (
    x: number,
    y: number,
    shapes: AnimalShape[],
    eyes: Point[],
    sleep = { x: -5, y: 13, rotation: 0.12 },
  ) => {
    const h = add('head', x, y, 'head', ...shapes)
    if (h) h.sleepHead = sleep
    const open = add(
      'eye-open',
      x,
      y,
      'eye-open',
      ...eyes.map((p) =>
        oval(p.x, p.y, s === 'firefly' ? 0.7 : 1.9, s === 'firefly' ? 0.8 : 2.1, ink),
      ),
    )
    const closed = add(
      'eye-closed',
      x,
      y,
      'eye-closed',
      ...eyes.map((p) =>
        curve(
          [
            [p.x - 3, p.y],
            [p.x - 1, p.y + 2],
            [p.x + 1, p.y + 2],
            [p.x + 3, p.y],
          ],
          ink,
          1.7,
        ),
      ),
    )
    if (open) open.sleepHead = sleep
    if (closed) closed.sleepHead = sleep
    if (s === 'cat') {
      const mouth = add(
        'yawn-mouth',
        x,
        y,
        'yawn-mouth',
        oval(12, 11, 6, 7, c),
        oval(12, 11, 3, 5, ink),
        oval(12, 14, 2, 1.2, '#aa8f83'),
      )
      if (mouth) mouth.sleepHead = sleep
    }
  }
  const feet = (anchors: number[][], length: number, width: number, hoof = false) => {
    anchors.forEach(([x, y], i) =>
      add(
        `leg-${i}`,
        x!,
        y!,
        'leg',
        line(
          [
            [0, 0],
            [i % 2 ? 2 : -2, length - 3],
            [7, length - 3],
          ],
          i % 2 ? c : dark,
          width,
        ),
        ...(hoof
          ? [
              poly(
                [
                  [-3, length - 6],
                  [8, length - 6],
                  [10, length],
                  [-3, length],
                ],
                nose,
              ),
            ]
          : []),
      ),
    )
  }
  if (['cat', 'dog', 'deer', 'fox', 'rabbit', 'squirrel', 'camel'].includes(s))
    add(
      'contact-shadow',
      -4,
      2,
      'shadow',
      oval(
        0,
        0,
        s === 'rabbit' ? 30 : s === 'squirrel' ? 25 : s === 'deer' || s === 'camel' ? 48 : 40,
        3.5,
        '#26352b',
      ),
    )
  if (s === 'dragon') {
    add(
      'tail',
      60,
      -69,
      'tail',
      curve(
        [
          [0, 0],
          [145, 58],
          [132, -117],
          [60, -121],
        ],
        c,
        43,
      ),
      curve(
        [
          [59, -121],
          [98, -104],
          [114, -75],
          [105, -39],
        ],
        m,
        4,
      ),
    )
    add(
      'folded-wing-left',
      -17,
      -131,
      'fixed',
      poly(
        [
          [0, 0],
          [-104, -121],
          [-84, -50],
          [-132, -61],
          [-90, -13],
          [-140, -2],
          [-63, 37],
          [21, 26],
        ],
        dark,
      ),
      line(
        [
          [0, 0],
          [-104, -121],
          [-90, -13],
          [-63, 37],
        ],
        m,
        3,
      ),
    )
    add(
      'body',
      20,
      -79,
      'body',
      oval(0, 0, 132, 78, c),
      oval(18, 23, 90, 43, shade(c, 1.08)),
      curve(
        [
          [-55, 28],
          [-27, 67],
          [45, 67],
          [82, 18],
        ],
        dark,
        8,
      ),
    )
    add(
      'forepaw-left',
      -73,
      -4,
      'fixed',
      oval(0, 0, 43, 9, c),
      line(
        [
          [-24, 1],
          [-23, 6],
          [-12, 2],
          [-11, 7],
          [1, 2],
          [2, 7],
        ],
        m,
        2,
      ),
    )
    add(
      'forepaw-right',
      64,
      -2,
      'fixed',
      oval(0, 0, 43, 10, c),
      line(
        [
          [-22, 1],
          [-21, 6],
          [-10, 2],
          [-9, 7],
          [2, 2],
          [3, 7],
        ],
        m,
        2,
      ),
    )
    add('neck', -77, -81, 'body', oval(0, 0, 49, 37, c))
    head(
      -150,
      -95,
      [
        oval(0, 0, 49, 28, c),
        oval(-42, 7, 34, 17, c),
        poly(
          [
            [-18, -19],
            [-34, -65],
            [-3, -34],
          ],
          m,
        ),
        poly(
          [
            [20, -20],
            [37, -55],
            [35, -7],
          ],
          m,
        ),
        poly(
          [
            [34, -3],
            [67, -25],
            [45, 8],
          ],
          dark,
        ),
        oval(-67, 4, 3, 2, nose),
        curve(
          [
            [-62, 16],
            [-48, 21],
            [-32, 20],
            [-23, 15],
          ],
          dark,
          2,
        ),
      ],
      [{ x: -25, y: -5 }],
      { x: -3, y: 4, rotation: 0.025 },
    )
    for (const [x, y] of [
      [-30, -123],
      [0, -142],
      [31, -145],
      [65, -139],
      [93, -119],
    ])
      add(
        `scale-${x}`,
        x!,
        y!,
        'body',
        poly(
          [
            [-8, 0],
            [0, -14],
            [9, 0],
          ],
          m,
        ),
      )
    return parts
  }
  if (s === 'fish') {
    add(
      'tail',
      -27,
      0,
      'fin',
      poly(
        [
          [2, 0],
          [-24, -17],
          [-19, 0],
          [-24, 17],
          [2, 4],
        ],
        m,
      ),
    )
    add(
      'body',
      0,
      0,
      'body',
      oval(0, 0, 29, 13, c),
      poly(
        [
          [-11, -9],
          [-3, -25],
          [9, -11],
        ],
        m,
      ),
      curve(
        [
          [-8, 9],
          [0, 14],
          [12, 10],
          [18, 5],
        ],
        m,
        1.6,
      ),
    )
    add(
      'pectoral-fin',
      -1,
      2,
      'fin',
      poly(
        [
          [0, 0],
          [-9, 13],
          [9, 8],
        ],
        dark,
      ),
    )
    add(
      'head',
      21,
      0,
      'fixed',
      oval(0, 0, 12, 11, c),
      oval(5, -3, 1.8, 1.8, ink),
      curve(
        [
          [-5, -7],
          [-10, -3],
          [-10, 4],
          [-5, 8],
        ],
        dark,
        1.3,
      ),
      line(
        [
          [10, 2],
          [13, 1],
        ],
        dark,
        1,
      ),
    )
    return parts
  }
  if (s === 'ray') {
    add(
      'wing-0',
      -2,
      -5,
      'fin',
      poly(
        [
          [0, -9],
          [-26, -23],
          [-66, -21],
          [-46, 12],
          [-23, 24],
          [0, 12],
        ],
        c,
      ),
      curve(
        [
          [-8, -5],
          [-20, -8],
          [-39, -14],
          [-53, -15],
        ],
        m,
        2,
      ),
    )
    add(
      'wing-1',
      2,
      -5,
      'fin',
      poly(
        [
          [0, -9],
          [26, -23],
          [66, -21],
          [46, 12],
          [23, 24],
          [0, 12],
        ],
        c,
      ),
      curve(
        [
          [8, -5],
          [20, -8],
          [39, -14],
          [53, -15],
        ],
        m,
        2,
      ),
    )
    add(
      'tail',
      0,
      5,
      'tentacle',
      curve(
        [
          [0, 0],
          [14, 20],
          [-10, 41],
          [-3, 59],
        ],
        dark,
        3,
      ),
    )
    add(
      'body',
      0,
      -6,
      'body',
      oval(0, 0, 16, 21, c),
      oval(-6, -9, 1.8, 1.8, ink),
      oval(6, -9, 1.8, 1.8, ink),
    )
    return parts
  }
  if (s === 'jellyfish') {
    for (const [i, x] of [-17, -7, 5, 16].entries())
      add(
        `tentacle-${i}`,
        x,
        -5,
        'tentacle',
        curve(
          [
            [0, 0],
            [12, 18],
            [-10, 33],
            [3, 53 - i * 3],
          ],
          m,
          2.4,
        ),
      )
    add(
      'body',
      0,
      -10,
      'body',
      poly(
        Array.from({ length: 25 }, (_, i) => {
          const a = Math.PI + (i * Math.PI) / 24
          return [Math.cos(a) * 27, Math.sin(a) * 27]
        }).concat([
          [24, 10],
          [16, 5],
          [7, 11],
          [-2, 6],
          [-12, 11],
          [-22, 5],
          [-27, 0],
        ]),
        c,
      ),
      curve(
        [
          [-17, -10],
          [-7, -23],
          [7, -23],
          [17, -10],
        ],
        m,
        2,
      ),
    )
    return parts
  }
  if (s === 'snail') {
    add(
      'body',
      0,
      -3,
      'body',
      poly(
        [
          [-29, 4],
          [-23, -3],
          [-4, -6],
          [16, -2],
          [32, 0],
          [35, 5],
          [21, 8],
          [-25, 8],
        ],
        c,
      ),
    )
    const spiral = Array.from({ length: 57 }, (_, i) => {
      const t = i / 56,
        angle = t * Math.PI * 4,
        r = 12 * (1 - t) + 1.5
      return [Math.cos(angle) * r, Math.sin(angle) * r]
    })
    add('shell', -5, -15, 'shell', oval(0, 0, 17, 17, shade(m, 0.8)), line(spiral, m, 2.3))
    head(
      25,
      -6,
      [
        curve(
          [
            [3, 3],
            [5, 5],
            [7, 5],
            [9, 3],
          ],
          dark,
          1.1,
        ),
        curve(
          [
            [0, 0],
            [1, -9],
            [0, -15],
            [-1, -17],
          ],
          c,
          3,
        ),
        curve(
          [
            [6, 0],
            [10, -5],
            [10, -11],
            [12, -13],
          ],
          c,
          3,
        ),
      ],
      [
        { x: -1, y: -17 },
        { x: 12, y: -13 },
      ],
      { x: -4, y: 3, rotation: 0 },
    )
    return parts
  }
  if (s === 'spider') {
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1,
        j = i % 4
      add(
        `leg-${i}`,
        side * 4,
        -7 + j * 2,
        'leg',
        line(
          [
            [0, 0],
            [side * (13 + Math.abs(j - 1.5) * 2), -15 + j * 7],
            [side * 24, -17 + j * 10],
          ],
          c,
          2,
        ),
      )
    }
    add('body', 0, -2, 'body', oval(0, 0, 9, 11, c), oval(1, 2, 4, 5, m))
    head(
      0,
      -15,
      [oval(0, 0, 6, 6, c)],
      [
        { x: -2, y: -2 },
        { x: 2, y: -2 },
      ],
      { x: 0, y: 1, rotation: 0 },
    )
    return parts
  }
  if (s === 'firefly') {
    for (const [i, r] of [18, 12, 7].entries())
      add(`glow-${i}`, 0, 2, 'glow', oval(0, 0, r, r * 0.8, c))
    for (const side of [-1, 1])
      add(`wing-${side < 0 ? 0 : 1}`, side * 2, -4, 'insect-wing', oval(side * 9, -4, 10, 5, m))
    add('body', 0, 1, 'body', oval(0, 0, 3.8, 8, c), oval(0, -3, 3, 3.5, shade(m, 0.7)))
    head(
      0,
      -9,
      [oval(0, 0, 3.5, 3.2, shade(m, 0.7))],
      [
        { x: -1.3, y: -0.4 },
        { x: 1.3, y: -0.4 },
      ],
      { x: 0, y: 0, rotation: 0 },
    )
    return parts
  }
  if (s === 'butterfly' || s === 'moth') {
    for (const side of [-1, 1]) {
      const wing =
        s === 'moth'
          ? poly(
              [
                [0, 0],
                [side * 37, -25],
                [side * 32, 14],
                [side * 11, 13],
              ],
              m,
            )
          : oval(side * 18, -9, 18, 23, m)
      add(`wing-${side < 0 ? 0 : 1}`, 0, -10, 'insect-wing', wing, oval(side * 20, -12, 5, 7, c))
      add(
        `wing-${side < 0 ? 2 : 3}`,
        0,
        -8,
        'insect-wing',
        oval(side * 13, 16, 12, s === 'moth' ? 12 : 16, c),
        oval(side * 15, 17, 3, 4, m),
      )
    }
    add('body', 0, -5, 'body', oval(0, 0, 3.5, 18, dark))
    head(
      0,
      -25,
      [
        oval(0, 0, 5, 5, c),
        curve(
          [
            [-2, -3],
            [-3, -12],
            [-11, -13],
            [-9, -17],
          ],
          dark,
          1.5,
        ),
        curve(
          [
            [2, -3],
            [3, -12],
            [11, -13],
            [9, -17],
          ],
          dark,
          1.5,
        ),
      ],
      [
        { x: -2, y: -1 },
        { x: 2, y: -1 },
      ],
      { x: 0, y: 1, rotation: 0 },
    )
    return parts
  }
  if (['owl', 'heron', 'duck', 'gull', 'songbird', 'bat'].includes(s)) {
    const owl = s === 'owl',
      heron = s === 'heron',
      duck = s === 'duck',
      bat = s === 'bat',
      small = s === 'songbird'
    const bodyY = owl ? -31 : heron ? -51 : duck ? -20 : bat ? -20 : -22
    const rx = owl ? 23 : heron ? 31 : duck ? 31 : bat ? 12 : small ? 20 : 29,
      ry = owl ? 30 : heron ? 19 : duck ? 17 : bat ? 22 : small ? 14 : 18
    const hx = owl || bat ? 0 : heron ? 24 : duck ? 24 : small ? 19 : 24,
      hy = owl ? -57 : heron ? -91 : duck ? -36 : bat ? -42 : small ? -34 : -37
    const span = bat ? 57 : owl ? 53 : heron ? 65 : small ? 34 : 57
    if (!bat)
      add(
        'tail',
        -rx + 4,
        bodyY + 4,
        'tail',
        poly(
          [
            [0, 0],
            [-19, -7],
            [-15, 10],
            [7, 8],
          ],
          dark,
        ),
      )
    for (const side of [-1, 1]) {
      add(
        `wing-${side < 0 ? 0 : 1}`,
        side * 5,
        bodyY - 8,
        'flight-wing',
        poly(
          bat
            ? [
                [0, 0],
                [side * span, -33],
                [side * (span - 9), -2],
                [side * 31, -8],
                [side * 19, 9],
                [side * 9, 5],
              ]
            : [
                [0, 0],
                [side * span, -12],
                [side * (span - 8), 4],
                [side * 32, 16],
                [side * 11, 21],
              ],
          side < 0 ? dark : c,
        ),
      )
      add(
        `folded-wing-${side}`,
        side * (owl ? 14 : 8),
        bodyY - 6,
        'folded-wing',
        oval(
          side * 3,
          9,
          owl ? 9 : bat ? 7 : rx * 0.6,
          owl ? 22 : bat ? 26 : ry * 0.6,
          bat ? dark : side < 0 ? dark : m,
        ),
      )
    }
    add(
      'body',
      0,
      bodyY,
      'body',
      oval(0, 0, rx, ry, c),
      ...(owl ? [oval(0, 9, 15, 19, m)] : duck ? [oval(-5, 5, 22, 9, m)] : []),
    )
    if (heron)
      add(
        'neck',
        17,
        -49,
        'neck',
        curve(
          [
            [0, 0],
            [28, -20],
            [-4, -30],
            [7, -44],
          ],
          c,
          12,
        ),
      )
    const face = owl
      ? [
          oval(0, 0, 23, 20, c),
          oval(-9, 0, 12, 14, m),
          oval(9, 0, 12, 14, m),
          poly(
            [
              [-19, -9],
              [-26, -31],
              [-7, -17],
            ],
            c,
          ),
          poly(
            [
              [19, -9],
              [26, -31],
              [7, -17],
            ],
            c,
          ),
          poly(
            [
              [-4, 8],
              [0, 17],
              [4, 8],
            ],
            '#b5a173',
          ),
        ]
      : bat
        ? [
            oval(0, 0, 12, 11, c),
            poly(
              [
                [-9, -3],
                [-13, -26],
                [-2, -11],
              ],
              c,
            ),
            poly(
              [
                [9, -3],
                [13, -26],
                [2, -11],
              ],
              c,
            ),
            oval(0, 6, 2, 1.5, nose),
          ]
        : [
            oval(0, 0, small ? 11 : 13, small ? 11 : 13, c),
            poly(
              [
                [9, -1],
                [heron ? 36 : duck ? 31 : small ? 21 : 28, 4],
                [9, 8],
              ],
              duck ? '#ac976e' : '#b09c73',
            ),
          ]
    head(
      hx,
      hy,
      face,
      owl
        ? [
            { x: -8, y: -1 },
            { x: 8, y: -1 },
          ]
        : bat
          ? [
              { x: -5, y: 0 },
              { x: 5, y: 0 },
            ]
          : [{ x: 4, y: -3 }],
      { x: owl ? 0 : -4, y: owl ? 3 : 8, rotation: owl ? 0 : 0.12 },
    )
    if (!bat) {
      const length = heron ? 44 : owl ? 9 : duck ? 12 : small ? 10 : 13
      for (const [i, x] of (heron ? [-12, 8] : [-10, 10]).entries())
        add(
          `leg-${i}`,
          x,
          heron ? -44 : -length,
          'leg',
          line(
            [
              [0, 0],
              [i ? 2 : 0, length - 2],
              [8, length - 2],
            ],
            '#a59d79',
            heron ? 3 : 2.5,
          ),
          ...(duck
            ? [
                poly(
                  [
                    [-3, length - 3],
                    [9, length - 1],
                    [12, length + 2],
                    [-4, length + 2],
                  ],
                  '#a59d79',
                ),
              ]
            : []),
        )
    }
    if (duck || s === 'gull')
      add('wake', 0, 4, 'wake', { ...oval(0, 0, rx + 12, 4, 'none'), stroke: m, strokeWidth: 1.2 })
    return parts
  }
  const deer = s === 'deer',
    camel = s === 'camel',
    dog = s === 'dog',
    fox = s === 'fox',
    rabbit = s === 'rabbit',
    squirrel = s === 'squirrel'
  const long = deer || camel,
    bodyY = long ? -49 : rabbit ? -22 : squirrel ? -27 : dog ? -29 : -25
  const rx = long ? 46 : dog ? 40 : rabbit ? 30 : squirrel ? 22 : fox ? 37 : 34,
    ry = long ? 22 : rabbit ? 23 : squirrel ? 24 : dog ? 23 : 21
  if (fox)
    add(
      'tail',
      -31,
      -26,
      'tail',
      {
        fill: c,
        closed: true,
        points: curve(
          [
            [0, 0],
            [-18, -17],
            [-46, -12],
            [-65, 7],
          ],
          c,
        ).points.concat(
          curve(
            [
              [-65, 7],
              [-49, 32],
              [-20, 22],
              [0, 7],
            ],
            c,
          ).points.slice(1),
        ),
      },
      poly(
        [
          [-42, -9],
          [-65, 7],
          [-53, 20],
          [-40, 16],
        ],
        m,
      ),
    )
  else if (squirrel)
    add(
      'tail',
      -16,
      -19,
      'tail',
      curve(
        [
          [0, 0],
          [-54, 13],
          [-59, -78],
          [-21, -69],
        ],
        c,
        23,
      ),
      curve(
        [
          [-23, -67],
          [-47, -62],
          [-45, -22],
          [-29, -23],
        ],
        m,
        4,
      ),
    )
  else if (rabbit) add('tail', -33, -21, 'tail', oval(0, 0, 10, 10, m))
  else
    add(
      'tail',
      -rx + 5,
      bodyY + 3,
      'tail',
      curve(
        [
          [0, 0],
          [-18, -3],
          [-34, -19],
          [-23, -34],
        ],
        c,
        long ? 5 : dog ? 9 : 8,
      ),
    )
  feet(
    long
      ? [
          [-29, -43],
          [-22, -43],
          [19, -43],
          [26, -43],
        ]
      : rabbit
        ? [
            [-20, -17],
            [-15, -17],
            [17, -17],
            [23, -17],
          ]
        : squirrel
          ? [
              [-24, bodyY + 10],
              [-18, bodyY + 10],
              [8, bodyY + 10],
              [13, bodyY + 10],
            ]
          : [
              [-24, bodyY + 10],
              [-18, bodyY + 10],
              [20, bodyY + 10],
              [26, bodyY + 10],
            ],
    long ? 43 : rabbit ? 17 : -bodyY - 10,
    long ? 5 : rabbit ? 8 : 7,
    long,
  )
  add(
    'body',
    -5,
    bodyY,
    'awake-body',
    oval(0, 0, rx, ry, c),
    ...(dog ? [oval(-14, -5, 13, 13, m)] : []),
    ...(deer
      ? [
          ...[-27, -8, 11].flatMap((x, i) => [
            oval(x, -7 - (i % 2) * 3, 3, 3, m),
            oval(x + 7, 4, 2.6, 2.6, m),
          ]),
        ]
      : []),
  )
  if (camel) {
    add('hump-back', -22, bodyY - 14, 'awake-body', oval(0, -10, 17, 21, c))
    add('hump-front', 12, bodyY - 14, 'awake-body', oval(0, -10, 17, 22, c))
    add(
      'saddle',
      -8,
      bodyY - 7,
      'awake-body',
      poly(
        [
          [-20, -6],
          [20, -6],
          [23, 16],
          [-21, 16],
        ],
        dark,
      ),
    )
  }
  add(
    'sleep-body',
    -6,
    -13,
    'sleep-body',
    oval(0, 0, long ? 48 : rx + 3, long ? 25 : s === 'cat' || dog ? 15 : 22, c),
    ...(s === 'cat' || dog
      ? [
          oval(10, 6, 16, 7, c),
          curve(
            [
              [-19, 0],
              [-23, 11],
              [0, 15],
              [12, 5],
            ],
            m,
            3,
          ),
        ]
      : [
          curve(
            [
              [-rx * 0.6, 0],
              [-rx * 0.9, 25],
              [rx * 0.3, 25],
              [rx * 0.45, 5],
            ],
            m,
            long ? 4 : 6,
          ),
        ]),
  )
  if (long)
    add(
      'neck',
      26,
      bodyY - 4,
      'neck',
      curve(
        [
          [0, 0],
          [13, -12],
          [7, -25],
          [12, camel ? -42 : -35],
        ],
        c,
        camel ? 16 : 13,
      ),
    )
  if (camel) {
    add('sleep-hump-back', -22, -29, 'sleep-body', oval(0, -5, 15, 18, c))
    add('sleep-hump-front', 9, -29, 'sleep-body', oval(0, -5, 15, 19, c))
  }
  if (s === 'cat' || dog) {
    // Alternate supported silhouettes are cached with the rig. They never turn
    // a standing oval into an eating pose by merely translating the whole root.
    add(
      'rest-body',
      -8,
      -13,
      'pet-lie',
      oval(0, 0, dog ? 39 : 33, 13, c),
      ...(dog ? [oval(-12, -3, 12, 9, m)] : []),
    )
    add('rest-paws', 0, 0, 'pet-lie', oval(-19, -2, 12, 3, c), oval(22, -2, 12, 3, c))
    add('sit-haunch', -17, -11, 'pet-sit', oval(0, 0, dog ? 22 : 18, 12, c))
    add(
      'sit-body',
      -5,
      dog ? -27 : -25,
      'pet-sit',
      oval(0, 0, dog ? 21 : 18, dog ? 27 : 25, c),
      ...(dog ? [oval(3, -5, 9, 16, m)] : []),
    )
    add(
      'sit-paws',
      0,
      0,
      'pet-sit',
      line(
        [
          [6, -25],
          [8, -4],
          [14, -3],
        ],
        c,
        7,
      ),
      line(
        [
          [16, -23],
          [19, -4],
          [25, -3],
        ],
        c,
        7,
      ),
      oval(-21, -2, 12, 3, c),
    )
    // Hindquarters remain high while the chest lowers into a true stretch/bow.
    add(
      'bow-hind-legs',
      0,
      0,
      'pet-bow',
      line(
        [
          [-27, -27],
          [-26, -5],
          [-20, -3],
        ],
        dark,
        6,
      ),
      line(
        [
          [-20, -25],
          [-17, -5],
          [-11, -3],
        ],
        c,
        7,
      ),
    )
    const torso = oval(-9, -24, dog ? 35 : 30, 16, c)
    torso.points = torso.points.map((point) => ({
      x: -9 + (point.x + 9) * Math.cos(0.22) - (point.y + 24) * Math.sin(0.22),
      y: -24 + (point.x + 9) * Math.sin(0.22) + (point.y + 24) * Math.cos(0.22),
    }))
    add('bow-body', 0, 0, 'pet-bow', torso)
    add(
      'bow-front-legs',
      0,
      0,
      'pet-bow',
      line(
        [
          [7, -17],
          [19, -5],
          [29, -3],
        ],
        dark,
        6,
      ),
      line(
        [
          [14, -15],
          [25, -5],
          [dog ? 35 : 33, -3],
        ],
        c,
        7,
      ),
    )
    if (dog)
      add(
        'scratch-leg',
        -18,
        -17,
        'pet-scratch',
        curve(
          [
            [0, 0],
            [8, -12],
            [25, -16],
            [36, -12],
          ],
          c,
          7,
        ),
        oval(35, -12, 5, 4, c),
      )
  }
  const hx = long ? 43 : rabbit ? 21 : squirrel ? 18 : fox ? 31 : dog ? 34 : 29,
    hy = long ? (camel ? -98 : -94) : rabbit ? -39 : squirrel ? -47 : dog ? -40 : -38
  const ears = rabbit
    ? [
        oval(-7, -30, 6, 26, c),
        oval(8, -32, 6, 28, c),
        oval(-7, -29, 2.3, 19, m),
        oval(8, -31, 2.3, 20, m),
      ]
    : dog
      ? [oval(-11, 4, 8, 18, m)]
      : long
        ? [oval(-13, -16, 7, 16, c), oval(7, -18, 6, 15, c)]
        : squirrel
          ? [oval(-10, -12, 5, 8, c), oval(9, -14, 5, 8, c)]
          : [
              poly(
                [
                  [-15, -7],
                  [-16, -28],
                  [0, -17],
                ],
                c,
              ),
              poly(
                [
                  [4, -17],
                  [16, -27],
                  [15, -4],
                ],
                c,
              ),
            ]
  const headShapes = [
    oval(0, 0, long ? 20 : rabbit ? 17 : 19, long ? 13 : 17, c),
    ...ears,
    ...(long || dog || fox ? [oval(17, 6, long ? 17 : fox ? 16 : 13, 7, c)] : []),
    ...(fox
      ? [
          poly(
            [
              [2, 6],
              [29, 4],
              [19, 13],
              [2, 12],
            ],
            m,
          ),
        ]
      : []),
    oval(long ? 31 : fox ? 30 : dog ? 28 : rabbit ? 15 : 18, 6, long ? 2.5 : 2, 1.8, nose),
    curve(
      [
        [9, 11],
        [13, 14],
        [18, 13],
        [20, 11],
      ],
      dark,
      1.1,
    ),
  ]
  head(
    hx,
    hy,
    headShapes,
    [{ x: long ? 9 : 6, y: -3 }],
    long
      ? { x: -6, y: camel ? 72 : 68, rotation: 0.23 }
      : rabbit
        ? { x: -1, y: 13, rotation: 0.15 }
        : squirrel
          ? { x: 0, y: 18, rotation: 0.15 }
          : { x: -3, y: 15, rotation: 0.1 },
  )
  return parts
}
export function animalRig(spec: AnimalDrawingSpec): AnimalPart[] {
  if (!known.has(spec.species)) throw new RangeError(`Unsupported animal species: ${spec.species}`)
  const key = JSON.stringify([spec.species, spec.coat, spec.marking ?? cream])
  let rig = rigs.get(key)
  if (!rig) {
    rig = makeRig(spec)
    rigs.set(key, rig)
  }
  return rig
}
const seconds = (state: AnimalDrawingState) =>
  Number.isFinite(state.time) ? state.time! : Number.isFinite(state.phase) ? state.phase : 0
function catYawn(state: AnimalDrawingState) {
  if (
    !['rest', 'sleep'].includes(state.action) ||
    !['ground', 'perch'].includes(state.domain ?? '')
  )
    return 0
  const id = [...state.id].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 0),
    period = 70 + (id % 31),
    elapsed = seconds(state) - (40 + (id % 31))
  if (elapsed < 0 || elapsed % period >= 2.6) return 0
  return Math.sin(((elapsed % period) / 2.6) * Math.PI) ** 2
}
export function animalPartPose(part: AnimalPart, state: AnimalDrawingState): AnimalPartPose {
  const action = state.action.toLowerCase(),
    s = part.species ?? 'cat',
    t = seconds(state),
    airborne =
      state.domain === 'air' &&
      ['owl', 'gull', 'songbird', 'bat', 'moth', 'butterfly', 'firefly'].includes(s),
    pet = s === 'cat' || s === 'dog',
    sleep = (action === 'sleep' || (!pet && action === 'rest')) && !airborne,
    moving = ['walk', 'hop', 'fly', 'swim', 'yield'].includes(action)
  const mammal = ['cat', 'dog', 'deer', 'fox', 'rabbit', 'squirrel', 'camel'].includes(s),
    fly = action === 'fly' || airborne,
    swim = action === 'swim' || state.domain === 'water'
  const cadence =
    s === 'snail'
      ? 0.45
      : s === 'spider'
        ? 1.7
        : s === 'rabbit' || s === 'squirrel'
          ? 2.1
          : s === 'deer' || s === 'camel'
            ? 1.2
            : 1.7
  const gait = Math.sin(
      (Number.isFinite(state.gaitPhase) ? state.gaitPhase! : t * cadence) * Math.PI * 2,
    ),
    breath = Math.sin((t * Math.PI * 2) / 4.2)
  const phase = Math.max(0, Math.min(1, state.phase || 0)),
    social = Math.sin(phase * Math.PI)
  const supportedGroom =
      action === 'groom' && (state.domain === 'ground' || state.domain === 'perch'),
    pawGroom = supportedGroom && ['cat', 'dog', 'fox', 'rabbit', 'squirrel'].includes(s),
    birdGroom = supportedGroom && ['owl', 'songbird', 'gull', 'duck', 'heron'].includes(s),
    grooming = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.7)
  let x = part.anchor.x,
    y = part.anchor.y,
    rotation = 0,
    scaleX = 1,
    scaleY = 1,
    alpha = 1
  if (part.motion === 'awake-body') alpha = sleep ? 0 : 1
  if (part.motion === 'glow')
    alpha =
      (0.035 + (Number(part.name.split('-').at(-1)) || 0) * 0.035) *
      (0.7 + 0.3 * Math.sin((t * Math.PI * 2) / 3.7))
  if (part.motion === 'shadow') alpha = fly || swim ? 0 : 0.16
  if (part.motion === 'neck') {
    alpha = mammal && sleep ? 0 : 1
    if (action === 'eat') rotation = 2.2
  }
  if (part.motion === 'sleep-body') {
    alpha = sleep ? 1 : 0
    scaleY = 1 + breath * 0.025
  }
  if (part.motion === 'body') {
    if (s === 'jellyfish') {
      scaleX = 1 + Math.sin((t * Math.PI * 2) / 3) * 0.08
      scaleY = 1 - Math.sin((t * Math.PI * 2) / 3) * 0.1
    } else scaleY = 1 + breath * (sleep ? 0.018 : 0.006)
  }
  if (part.motion === 'leg') {
    const i = Number(part.name.split('-').at(-1)) || 0
    alpha = (mammal && sleep) || (swim && (s === 'duck' || s === 'gull')) || fly ? 0 : 1
    rotation = moving
      ? gait * (i % 2 ? -1 : 1) * (s === 'spider' ? 0.12 : s === 'rabbit' ? 0.27 : 0.24)
      : 0
    // Rotate one front limb at its shoulder; the paw rises toward the lowered muzzle.
    if (pawGroom && i === 3) rotation = -1.2 - grooming * 0.16
  }
  if (mammal && action === 'hop' && part.motion !== 'shadow') y -= Math.max(0, gait) * 5
  if (part.motion === 'tail')
    rotation =
      Math.sin((t * Math.PI * 2) / (state.emotion === 'content' ? 1.7 : 4.5)) *
      (state.emotion === 'content' ? 0.16 : 0.055)
  if (part.motion === 'tail' && mammal && sleep) {
    if (s === 'deer' || s === 'camel') {
      y += 34
      x += 8
      rotation = -0.9
    } else if (s === 'cat' || s === 'dog') {
      rotation = -1.1
      y += 6
    }
  }
  if (part.motion === 'tail' && s === 'dragon') rotation = breath * 0.008
  const headPart = ['head', 'eye-open', 'eye-closed', 'yawn-mouth'].includes(part.motion ?? '')
  if (headPart) {
    if (sleep) {
      const p = part.sleepHead ?? { x: 0, y: 0, rotation: 0 }
      x += p.x
      y += p.y
      rotation = p.rotation
    } else if (action === 'eat') {
      if (mammal) {
        rotation = s === 'deer' || s === 'camel' ? 0.35 : 0.58
        if (s === 'deer' || s === 'camel') {
          x = 53
          y = -16
        } else y = s === 'dog' ? -20 : s === 'fox' ? -21 : s === 'rabbit' ? -13 : -15
      } else if (s === 'heron') {
        x = 49
        y = -16
        rotation = 0.35
      } else if (s === 'owl') {
        x = 16
        y = -17
        rotation = 0
      } else if (['duck', 'gull', 'songbird'].includes(s)) {
        y = s === 'duck' ? -14 : s === 'gull' ? -13 : -11
        rotation = 0.35
      } else if (s === 'snail') {
        rotation = 0.08
        y += 1
      }
    } else if (pawGroom) {
      y += 8 + grooming * 2
      rotation = 0.32 + grooming * 0.07
    } else if (birdGroom) {
      // Small neck turn toward the folded wing, with eye layers following the same joint.
      x -= 3
      y += 4
      rotation = -0.28 - grooming * 0.09
    } else if (['headbump', 'nuzzle', 'sniff', 'greet'].includes(action)) {
      x += social * (s === 'dragon' ? 1 : 3)
      rotation = social * 0.07
    } else rotation = Math.sin((t * Math.PI * 2) / 5.1) * 0.018
  }
  const offset = ([...state.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 37) / 10,
    blink = (t + offset) % 5.3 < 0.13
  if (part.motion === 'eye-open') {
    alpha = sleep || blink ? 0 : 1
    if (state.emotion === 'startled') {
      scaleX = 1.18
      scaleY = 1.18
    }
  }
  if (part.motion === 'eye-closed') alpha = sleep || blink ? 1 : 0
  if (part.motion === 'flight-wing') {
    alpha = fly ? 1 : 0
    rotation =
      Math.sin(t * Math.PI * 2 * (s === 'bat' ? 4.2 : 2.4)) *
      (part.name.endsWith('0') ? -1 : 1) *
      0.65
  }
  if (part.motion === 'folded-wing') {
    alpha = fly ? 0 : 1
    rotation = breath * 0.015
    if (birdGroom) rotation += grooming * 0.06
  }
  if (part.motion === 'insect-wing') {
    scaleX = 0.25 + 0.75 * Math.abs(Math.sin(t * Math.PI * 2 * (s === 'moth' ? 5.2 : 3.7)))
    rotation = Math.sin(t * Math.PI * 2 * 2) * 0.06
  }
  if (part.motion === 'fin') {
    rotation = Math.sin(t * Math.PI * 2 * (s === 'ray' ? 0.6 : 1.5)) * (s === 'ray' ? 0.1 : 0.2)
    if (s === 'ray') scaleY = 0.75 + Math.sin(t * Math.PI * 2 * 0.6) * 0.25
  }
  if (part.motion === 'tentacle')
    rotation =
      Math.sin((t * Math.PI * 2) / 3 + (Number(part.name.split('-').at(-1)) || 0)) *
      (s === 'jellyfish' ? 0.07 : 0.035)
  if (part.motion === 'shell') rotation = moving ? Math.sin(t * Math.PI * 2 * 0.45) * 0.015 : 0
  if (part.motion === 'wake') alpha = swim ? (action === 'swim' ? 0.25 : 0.12) : 0
  if (action === 'stretch' && part.motion === 'awake-body') {
    scaleX = 1 + social * 0.1
    scaleY = 1 - social * 0.06
  }
  if (pet) {
    const supported = !state.domain || state.domain === 'ground' || state.domain === 'perch'
    const lying = supported && action === 'rest'
    const sitting = supported && (action === 'sit' || (s === 'dog' && action === 'groom'))
    const bowing = supported && (action === 'stretch' || (s === 'dog' && action === 'play'))
    const alternate = lying || sitting || bowing
    if (part.motion === 'awake-body' || part.motion === 'leg') {
      if (alternate) alpha = 0
    }
    if (part.motion === 'pet-lie') {
      alpha = lying ? 1 : 0
      if (part.name === 'rest-body') scaleY = 1 + breath * 0.014
    }
    if (part.motion === 'pet-sit') {
      alpha = sitting ? 1 : 0
      if (part.name === 'sit-body') scaleY = 1 + breath * 0.008
    }
    if (part.motion === 'pet-bow') {
      alpha = bowing ? 1 : 0
      // All four paws are baked on the contact plane; only the chest breathes.
      if (part.name === 'bow-body') scaleY = 1 + breath * 0.008
    }
    if (part.motion === 'pet-scratch') {
      alpha = supported && action === 'groom' ? 1 : 0
      rotation = -0.08 + grooming * 0.12
    }
    if (supported && action === 'play' && s === 'cat' && part.name === 'leg-3')
      rotation = -0.35 - (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.85)) * 0.7
    if (part.motion === 'tail' && !sleep) {
      if (lying) {
        y += 13
        rotation = -0.9 + breath * 0.025
      }
      if (sitting) {
        x += 7
        y += 12
        rotation = -0.85 + breath * 0.035
      }
      if (bowing) {
        y -= 3
        rotation = 0.15 + Math.sin(t * Math.PI * 2 * 1.1) * (s === 'dog' ? 0.2 : 0.07)
      }
      if (action === 'play' && s === 'cat') rotation = Math.sin(t * Math.PI * 2 * 1.25) * 0.18
    }
    if (headPart && supported && !sleep) {
      if (lying) {
        x = s === 'dog' ? 28 : 22
        y = s === 'dog' ? -27 : -25
        rotation = -0.08 + breath * 0.025
      } else if (sitting) {
        x = s === 'dog' ? 19 : 14
        y = s === 'dog' ? -45 : -43
        rotation = Math.sin((t * Math.PI * 2) / 6.5) * 0.065
      } else if (bowing) {
        x = s === 'dog' ? 29 : 25
        y = -24
        rotation = -0.12 + breath * 0.025
      } else if (action === 'sniff') {
        x = (s === 'dog' ? 34 : 29) + Math.sin(t * Math.PI * 2 * 0.8) * 0.4
        y += 2 + Math.sin(t * Math.PI * 2 * 0.6)
        rotation = 0.1 + Math.sin(t * Math.PI * 2 * 0.5) * 0.05
      } else if (action === 'observe') rotation = 0.08 + Math.sin((t * Math.PI * 2) / 7) * 0.07
      else if (action === 'play') {
        y += 4
        rotation = 0.08 + Math.sin(t * Math.PI * 2 * 0.85) * 0.06
      }
      if (s === 'dog' && action === 'groom') {
        x -= 1
        y += 4
        rotation = -0.28 - grooming * 0.06
      }
      if (action === 'eat') {
        // A tiny chew stays within the established mouth contact tolerance.
        y += Math.sin(t * Math.PI * 2 * 1.6) * 0.45
        rotation += Math.sin(t * Math.PI * 2 * 1.6) * 0.012
      }
    }
  }
  if (part.motion === 'yawn-mouth') {
    const amount = s === 'cat' ? catYawn(state) : 0
    alpha = Math.min(1, amount * 4)
    scaleY = amount > 0 ? 0.04 + amount * 0.96 : 1
    // Morph around the local mouth center, while retaining the head's anatomical joint.
    x -= Math.sin(rotation) * 11 * (1 - scaleY)
    y += Math.cos(rotation) * 11 * (1 - scaleY)
  }
  // SVG path points are nonnegative. Compensate their baked offset around the original anatomical joint.
  const o = part.svgOffset ?? { x: 0, y: 0 },
    cos = Math.cos(rotation),
    sin = Math.sin(rotation)
  return {
    x: x - cos * o.x * scaleX + sin * o.y * scaleY,
    y: y - sin * o.x * scaleX - cos * o.y * scaleY,
    rotation,
    scaleX,
    scaleY,
    alpha,
  }
}
const num = (n: number) => Number(n.toFixed(3))
function shapeSvg(shape: AnimalShape, transform: (p: Point) => Point, alpha = 1, scale = 1) {
  const d =
    shape.points
      .map((p, i) => {
        const q = transform(p)
        return `${i ? 'L' : 'M'}${num(q.x)} ${num(q.y)}`
      })
      .join('') + (shape.closed ? 'Z' : '')
  return `<path d="${d}" fill="${shape.fill}"${shape.stroke ? ` stroke="${shape.stroke}" stroke-width="${num((shape.strokeWidth ?? 2) * scale)}" stroke-linecap="round" stroke-linejoin="round"` : ''} opacity="${num(alpha)}"/>`
}
export function animalPartSvg(part: AnimalPart) {
  const o = part.svgOffset ?? { x: 0, y: 0 }
  return `<svg xmlns="http://www.w3.org/2000/svg">${part.shapes.map((shape) => shapeSvg(shape, (p) => ({ x: p.x + o.x, y: p.y + o.y }))).join('')}</svg>`
}
function projected(spec: AnimalDrawingSpec, state: AnimalDrawingState, part: AnimalPart, p: Point) {
  const pose = animalPartPose(part, state),
    o = part.svgOffset ?? { x: 0, y: 0 },
    x = (p.x + o.x) * pose.scaleX,
    y = (p.y + o.y) * pose.scaleY,
    cos = Math.cos(pose.rotation),
    sin = Math.sin(pose.rotation)
  return {
    x: state.x + (pose.x + cos * x - sin * y) * spec.scale * (state.heading < 0 ? -1 : 1),
    y: state.y + (pose.y + sin * x + cos * y) * spec.scale,
  }
}
export function animalPoseSvg(spec: AnimalDrawingSpec, state: AnimalDrawingState) {
  const tether = animalTetherLine(spec, state)
  const thread = tether
    ? shapeSvg(
        line(
          [
            [tether.x1, tether.y1],
            [tether.x2, tether.y2],
          ],
          tether.color,
          tether.width,
        ),
        (p) => p,
        tether.alpha,
      )
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820" viewBox="0 0 800 820" data-animal-id="${spec.id}">${thread}${animalRig(
    spec,
  )
    .map((part) => {
      const pose = animalPartPose(part, state)
      return pose.alpha <= 0
        ? ''
        : part.shapes
            .map((shape) =>
              shapeSvg(shape, (p) => projected(spec, state, part, p), pose.alpha, spec.scale),
            )
            .join('')
    })
    .join('')}</svg>`
}
/** Actual posed geometry envelope for independent navigation/proof checks (stroke included). */
export function animalPoseBounds(spec: AnimalDrawingSpec, state: AnimalDrawingState) {
  const points = animalRig(spec).flatMap((part) =>
    animalPartPose(part, state).alpha <= 0
      ? []
      : part.shapes.flatMap((shape) => {
          const radius = ((shape.strokeWidth ?? 0) * spec.scale) / 2
          return shape.points.flatMap((p) => {
            const q = projected(spec, state, part, p)
            return [
              { x: q.x - radius, y: q.y - radius },
              { x: q.x + radius, y: q.y + radius },
            ]
          })
        }),
  )
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y))
  return {
    x,
    y,
    width: Math.max(...points.map((p) => p.x)) - x,
    height: Math.max(...points.map((p) => p.y)) - y,
  }
}

export type AnimalResourceDrawing = {
  kind: string
  position: Point
  scale?: number
  species?: string
}
export type AnimalResourceZone = { domain: string; support?: string }
/** Static, world-baked meal stations. Never duplicate source beds for rest resources. */
export function animalResourceSvg(resource: AnimalResourceDrawing, zone: AnimalResourceZone) {
  const { x, y } = resource.position
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw new RangeError('Resource position must be finite')
  if (resource.scale !== undefined && (!Number.isFinite(resource.scale) || resource.scale <= 0))
    throw new RangeError('Resource consumer scale must be finite and positive')
  const shapes: AnimalShape[] = []
  const ground =
    zone.domain !== 'air' &&
    zone.domain !== 'water' &&
    (zone.domain !== 'perch' || ['bench', 'chair'].includes(zone.support ?? '')) &&
    !['branch', 'post', 'thread'].includes(zone.support ?? '')
  const scale = ground ? (resource.scale ?? 1) : 1
  if (resource.kind !== 'rest') {
    if (zone.domain === 'water') {
      for (const [i, dx] of [-9, -3, 4, 10].entries())
        shapes.push(oval(dx, i % 2 ? 3 : -2, 1.8, 2.6, i % 2 ? '#879b75' : '#b4ad80'))
    } else if (
      (zone.domain === 'perch' && !ground) ||
      ['branch', 'post', 'thread'].includes(zone.support ?? '')
    ) {
      shapes.push(oval(0, 1, 13, 2, '#596348'))
      for (const [i, dx] of [-8, -3, 2, 7].entries())
        shapes.push(oval(dx, i % 2 ? -1.5 : 0, 1.8, 1.2, '#c2ad7d'))
    } else if (zone.domain !== 'air') {
      if (
        resource.kind === 'food' &&
        ['rabbit', 'deer', 'camel', 'snail'].includes(resource.species ?? '')
      ) {
        shapes.push(
          poly(
            [
              [-8, 1],
              [-3, -3],
              [5, -2],
              [9, 1],
              [1, 3],
            ],
            '#879569',
          ),
          line(
            [
              [-6, 1],
              [2, 0],
              [7, 1],
            ],
            '#b1b586',
            0.8,
          ),
        )
        if (resource.species !== 'snail')
          shapes.push(
            line(
              [
                [-4, 1],
                [-3, -4],
                [-1, 0],
                [1, -5],
                [3, 1],
              ],
              '#a4ab79',
              1.1,
            ),
          )
      } else {
        shapes.push(
          poly(
            [
              [-7.5, 0],
              [7.5, 0],
              [5.5, 4.5],
              [-5.5, 4.5],
            ],
            '#8f8b72',
          ),
          oval(0, 0, 7.5, 2.2, '#c3b897'),
          oval(0, 0, 5.8, 1.4, resource.kind === 'water' ? '#718f86' : '#715a40'),
        )
        if (resource.kind === 'food')
          for (const [i, dx] of [-3.5, 0, 3].entries())
            shapes.push(oval(dx, i % 2 ? 0.5 : -0.5, 0.9, 0.7, '#b89e72'))
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820" viewBox="0 0 800 820">${shapes.map((shape) => shapeSvg(shape, (p) => ({ x: x + p.x * scale, y: y + p.y * scale }), 1, scale)).join('')}</svg>`
}

/** World-food targets are these local posed mouth points, scaled from the feet. */
export const ANIMAL_FEEDING_OFFSET: Readonly<Record<string, Point>> = {
  cat: { x: 41, y: 0 },
  dog: { x: 54, y: 0 },
  deer: { x: 80, y: 0 },
  fox: { x: 53, y: 0 },
  rabbit: { x: 30, y: 0 },
  squirrel: { x: 30, y: 0 },
  owl: { x: 16, y: 0 },
  heron: { x: 81, y: 0 },
  duck: { x: 52, y: 0 },
  gull: { x: 49, y: 0 },
  songbird: { x: 37, y: 0 },
  dragon: { x: 0, y: 0 },
  fish: { x: 36, y: 0 },
  bat: { x: 0, y: 0 },
  spider: { x: 0, y: 0 },
  moth: { x: 0, y: 0 },
  butterfly: { x: 0, y: 0 },
  snail: { x: 32, y: 0 },
  camel: { x: 80, y: 0 },
  jellyfish: { x: 0, y: 48 },
  ray: { x: 0, y: 10 },
  firefly: { x: 0, y: 0 },
}

export function animalTetherLine(
  spec: AnimalDrawingSpec,
  state: AnimalDrawingState,
  anchor = spec.tetherAnchor,
) {
  if (spec.species !== 'spider' || !anchor) return null
  return {
    x1: anchor.x,
    y1: anchor.y,
    x2: state.x,
    y2: state.y - 20 * spec.scale,
    color: '#c0c8b2',
    width: 1.2,
    alpha: 0.65,
  }
}
