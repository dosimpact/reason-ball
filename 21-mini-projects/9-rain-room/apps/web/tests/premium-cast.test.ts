import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PREMIUM_CAST,
  PREMIUM_ROOM_CAST,
  validatePremiumCast,
} from '../src/pages/focus/model/premiumCast.ts'
test('each visible premium resident belongs to exactly one room and has a distinct structural appearance', () => {
  assert.deepEqual(validatePremiumCast(), [])
  assert.equal(Object.keys(PREMIUM_ROOM_CAST).length, 30)
  const profiles = Object.values(PREMIUM_CAST)
  assert.equal(profiles.length, 27)
  assert.equal(Object.values(PREMIUM_ROOM_CAST).filter((p) => p.length).length, 26)
  assert.equal(PREMIUM_ROOM_CAST['premium-orient-express']?.length, 2)
  assert.equal(
    new Set(
      profiles.map((p) =>
        [
          p.face,
          p.headWidth,
          p.headHeight,
          p.hair,
          p.body,
          p.garment,
          p.expression,
          p.stance,
          p.headTilt,
        ].join('|'),
      ),
    ).size,
    27,
  )
  for (const p of profiles) {
    assert.ok(p.age >= 18 && p.age <= 90)
    assert.ok(!p.signature.includes('glasses'))
  }
})
test('all live premium people render their assigned cast, with no person baked into rear layers', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { default: Scene } = await server.ssrLoadModule(
      '/src/pages/focus/ui/premium/PremiumScene.tsx',
    )
    const signatures = new Set<string>()
    for (const [room, cast] of Object.entries(PREMIUM_ROOM_CAST)) {
      const html = renderToStaticMarkup(
        createElement(Scene, { spaceId: room, layer: 'foreground', static: true }),
      )
      const rear = renderToStaticMarkup(
        createElement(Scene, { spaceId: room, layer: 'rear', static: true }),
      )
      assert.equal((html.match(/data-premium-character=/g) || []).length, cast.length)
      assert.ok(!rear.includes('data-premium-character='))
      for (const id of cast) {
        assert.ok(html.includes(`data-premium-character="${id}"`))
        const p = PREMIUM_CAST[id]!
        assert.ok(html.includes(`data-character-face="${p.face}"`))
        assert.ok(html.includes(`data-character-stance="${p.stance}"`))
        signatures.add(p.signature)
      }
    }
    assert.equal(signatures.size, 27)
  } finally {
    await server.close()
  }
})

test('all cast portraits rasterize cleanly in each view with one connected head silhouette', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { Window } = await import('happy-dom')
  const { default: sharp } = await import('sharp')
  const window = new Window()
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { default: Character } = await server.ssrLoadModule(
      '/src/pages/focus/ui/premium/PremiumCharacter.tsx',
    )
    for (const cast of Object.values(PREMIUM_CAST))
      for (const view of ['front', 'profile', 'back']) {
        const holder = window.document.createElement('div')
        holder.innerHTML = renderToStaticMarkup(
          createElement('svg', null, createElement(Character, { castId: cast.id, view })),
        )
        const head = holder.querySelector('[data-character-head]')!
        assert.ok(head, `${cast.id}/${view}: missing portrait`)
        head.removeAttribute('transform')
        // Isolate the local portrait so chair, props and body cannot hide a gap.
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="-75 -65 150 150">${head.outerHTML}</svg>`
        const { data, info } = await sharp(Buffer.from(svg))
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        const pixels = new Set<number>()
        for (let i = 0; i < info.width * info.height; i++) if (data[i * 4 + 3] > 40) pixels.add(i)
        const area = pixels.size
        assert.ok(area > 2500 && area < 10000, `${cast.id}/${view}: portrait proportion ${area}`)
        let largest = 0
        while (pixels.size) {
          const first = pixels.values().next().value!,
            queue = [first]
          pixels.delete(first)
          for (let i = 0; i < queue.length; i++) {
            const point = queue[i]!,
              x = point % info.width
            for (const next of [
              point - info.width,
              point + info.width,
              ...(x > 0 ? [point - 1] : []),
              ...(x < info.width - 1 ? [point + 1] : []),
            ])
              if (pixels.delete(next)) queue.push(next)
          }
          largest = Math.max(largest, queue.length)
        }
        assert.ok(
          largest / area > 0.97,
          `${cast.id}/${view}: disconnected hair/head (${largest}/${area})`,
        )
        if (view === 'back') assert.equal(head.querySelector('[data-face-feature]'), null)
      }
  } finally {
    await server.close()
    await window.happyDOM.abort()
  }
})

test('held brush stays clear of the portrait and writing fingers meet the pencil', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { Window } = await import('happy-dom')
  const { default: sharp } = await import('sharp')
  const window = new Window()
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const alpha = async (body: string) => {
    const { data, info } = await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="-150 -200 300 300">${body}</svg>`,
      ),
    )
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    return Array.from({ length: info.width * info.height }, (_, i) => data[i * 4 + 3]!)
  }
  try {
    const { default: Character } = await server.ssrLoadModule(
      '/src/pages/focus/ui/premium/PremiumCharacter.tsx',
    )
    const holder = window.document.createElement('div')
    holder.innerHTML = renderToStaticMarkup(
      createElement(
        'svg',
        null,
        createElement(Character, {
          castId: 'museum-studio-resident',
          pose: 'writing',
          view: 'profile',
        }),
      ),
    )
    const head = await alpha(holder.querySelector('[data-character-head]')!.outerHTML)
    const brush = await alpha(holder.querySelector('[data-held-tool="brush"]')!.outerHTML)
    assert.equal(
      head.filter((value, i) => value > 40 && brush[i]! > 40).length,
      0,
      'brush must not cross face or hair',
    )
    holder.innerHTML = renderToStaticMarkup(
      createElement(
        'svg',
        null,
        createElement(Character, {
          castId: 'personal-roastery-resident',
          pose: 'writing',
          view: 'profile',
        }),
      ),
    )
    // Choose a cast with the authored writing-tool gesture.
    const writer = Object.values(PREMIUM_CAST).find((c) => c.occupation === 'engineer')!
    holder.innerHTML = renderToStaticMarkup(
      createElement(
        'svg',
        null,
        createElement(Character, { castId: writer.id, pose: 'writing', view: 'profile' }),
      ),
    )
    const pencil = await alpha(holder.querySelector('[data-held-tool="pencil"]')!.outerHTML)
    const hands = await alpha(holder.querySelector('[data-character-hands]')!.outerHTML)
    assert.ok(
      pencil.some((value, i) => value > 40 && hands[i]! > 40),
      'writing tool must meet the palm',
    )
  } finally {
    await server.close()
    await window.happyDOM.abort()
  }
})

test('rear gestures stay behind an opaque back and observatory shoes fit the authored artboard', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { Window } = await import('happy-dom')
  const { default: sharp } = await import('sharp')
  const dom = new Window()
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { default: Character } = await server.ssrLoadModule(
      '/src/pages/focus/ui/premium/PremiumCharacter.tsx',
    )
    const { default: Scene } = await server.ssrLoadModule(
      '/src/pages/focus/ui/premium/PremiumScene.tsx',
    )
    for (const suffix of ['newyear-attic', 'cloud-airship', 'neon-loft', 'underwater-library']) {
      const cast = PREMIUM_CAST[`${suffix}-resident`]!
      const pose = ['cloud-airship', 'neon-loft'].includes(suffix) ? 'laptop' : 'reading'
      const holder = dom.document.createElement('div')
      holder.innerHTML = renderToStaticMarkup(
        createElement(
          'svg',
          null,
          createElement(Character, { castId: cast.id, view: 'back', pose, x: 150, y: 200 }),
        ),
      )
      const actor = holder.querySelector('[data-premium-character]')!
      assert.equal(actor.querySelector('[data-character-garment="front"]'), null)
      const far = actor.querySelector('[data-character-depth="far-gesture"]')!
      const torso = actor.querySelector('[data-character-depth="torso"]')!
      assert.ok(
        [...actor.children].indexOf(far) < [...actor.children].indexOf(torso),
        `${suffix}: tool must be farther than back`,
      )
      // Pixel in the formerly exposed laptop/book footprint must be coat, not a tool/page.
      const { data, info } = await sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400">${actor.outerHTML}</svg>`,
        ),
      )
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const pixel = (200 * info.width + 162) * 4
      const expected = cast.coat.match(/[0-9a-f]{2}/gi)!.map((v) => parseInt(v, 16))
      assert.deepEqual(
        [...data.subarray(pixel, pixel + 3)],
        expected,
        `${suffix}: no prop painted across rear waist`,
      )
    }
    const holder = dom.document.createElement('div')
    holder.innerHTML = renderToStaticMarkup(
      createElement(Scene, { spaceId: 'premium-observatory', layer: 'foreground', static: true }),
    )
    const actor = holder.querySelector('[data-premium-character="observatory-resident"]')!
    // A taller isolation surface reveals pixels that the real 820-high scene would clip.
    const { data, info } = await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="900">${actor.outerHTML}</svg>`,
      ),
    )
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    let bottom = -1
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++)
        if (data[(y * info.width + x) * 4 + 3]! > 40) bottom = Math.max(bottom, y)
    assert.ok(bottom > 790 && bottom < 820, `full standing shoes must fit (bottom=${bottom})`)
    for (const id of [
      'premium-newyear-attic',
      'premium-canal-houseboat',
      'premium-underwater-library',
      'premium-memory-house',
    ]) {
      holder.innerHTML = renderToStaticMarkup(
        createElement(Scene, { spaceId: id, layer: 'foreground', static: true, coffeeCount: 25 }),
      )
      const extra = [...holder.querySelectorAll('path')].filter(
        (p) => p.getAttribute('d') === 'M-70-5 0-23 70-5l-6 30L0 10l-64 15z',
      )
      assert.equal(
        extra.length,
        0,
        `${id}: redundant scene-level page fan must not cover held book`,
      )
      assert.equal(holder.querySelectorAll('[data-premium-character]').length, 1)
    }
  } finally {
    await server.close()
    await dom.happyDOM.abort()
  }
})
