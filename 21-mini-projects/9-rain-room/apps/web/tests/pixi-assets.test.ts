import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { ALL_BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { PREMIUM_EXPERIENCES } from '../src/pages/focus/model/premiumExperience.ts'
import { getAnimalHabitat } from '../src/pages/focus/model/animalHabitats.ts'
import sharp from 'sharp'

const readManifest = async (id: string) =>
  JSON.parse(await readFile(`public/backgrounds/pixi/${id}/manifest.json`, 'utf8'))
test('all 68 Pixi scenes preserve ordered independent textures, weather masks and bounded motion', async () => {
  for (const room of ALL_BACKGROUNDS) {
    const manifest = await readManifest(room.id)
    assert.equal(manifest.version, 1)
    assert.equal(manifest.id, room.id)
    assert.equal(manifest.width, 800)
    assert.equal(manifest.height, 820)
    assert.equal(manifest.animalLifeVersion, 1)
    assert.equal(manifest.proof.staticBodiesRemoved, true)
    assert.ok(manifest.layers.length >= 3, room.id)
    assert.equal(manifest.layers[0].id, 'rear')
    assert.equal(manifest.layers.filter((layer: any) => layer.kind === 'weather').length, 1)
    const ids = new Set<string>()
    for (const layer of manifest.layers) {
      assert.ok(!ids.has(layer.id), `${room.id}: unique paint order id`)
      ids.add(layer.id)
      if (layer.kind === 'weather') continue
      if (layer.kind === 'animal') {
        assert.ok(getAnimalHabitat(room.id).actors.some((actor) => actor.id === layer.animalId))
        assert.equal(layer.src, undefined, 'live bodies never load baked PNGs')
        if (layer.clipMask) assert.ok(existsSync(`public${layer.clipMask}`))
        continue
      }
      assert.ok(
        ['character', 'structural', 'soft-effect'].includes(layer.sourceRole),
        `${room.id}: source-authored quality role`,
      )
      assert.ok(layer.src.endsWith('.png'), `${room.id}: PNG texture`)
      assert.ok(existsSync(`public${layer.src}`), layer.src)
      assert.ok(layer.width > 0 && layer.width <= 800 && layer.height > 0 && layer.height <= 820)
      assert.ok(
        layer.x >= 0 &&
          layer.y >= 0 &&
          layer.x + layer.width <= 800 &&
          layer.y + layer.height <= 820,
      )
      if (layer.clipMask) assert.ok(existsSync(`public${layer.clipMask}`))
      for (const motion of layer.motions ?? []) {
        assert.ok(Number.isFinite(motion.duration) && motion.duration > 0)
        assert.ok(Number.isFinite(motion.pivotX) && Number.isFinite(motion.pivotY))
        assert.ok(motion.keyframes?.length > 0)
        assert.ok(
          motion.keyframes.some((frame: any) => Object.keys(frame).some((key) => key !== 'offset')),
          `${room.id}: actual motion channels`,
        )
        assert.ok(motion.keyframes.every((frame: any) => frame.offset >= 0 && frame.offset <= 1))
      }
    }
    const mask = await sharp(`public${manifest.weatherMask}`).metadata()
    assert.equal(mask.width, 800)
    assert.equal(mask.height, 820)
    assert.ok(mask.hasAlpha)
    const first = manifest.proof.variants[0]
    assert.ok(
      first.meanAbsoluteError < 1,
      `${room.id}: static PNG recomposite MAE ${first.meanAbsoluteError}`,
    )
  }
})
test('authored signatures retain texture motion or native animal slots, and nonliving nested neon motion remains intact', async () => {
  for (const [id, expected] of Object.entries(PREMIUM_EXPERIENCES)) {
    const m = await readManifest(id)
    const layers = m.layers.filter(
      (layer: any) => layer.ifCoffeeMin === undefined || layer.ifCoffeeMin === 0,
    )
    const actual = new Set(
      layers
        .flatMap((layer: any) => layer.motions ?? [])
        .map((motion: any) => motion.sourceMotionId)
        .concat(
          layers
            .filter((layer: any) => layer.kind === 'animal')
            .map((layer: any) => layer.sourceMotionId),
        ),
    )
    for (const item of expected) assert.ok(actual.has(item.id), `${id}: ${item.id}`)
  }
  // These four former nested signature stacks belonged to living bodies. Their
  // independent native parts replace drift/wing/rock CSS; nonliving ancestry stays.
  for (const [roomId, sourceMotionId] of [
    ['premium-halloween-greenhouse', 'halloween-greenhouse-moth'],
    ['premium-rain-garden-dome', 'rain-garden-dome-butterfly'],
    ['premium-underwater-library', 'underwater-library-jelly'],
    ['premium-underwater-library', 'underwater-library-ray'],
  ]) {
    const manifest = await readManifest(roomId)
    const slots = manifest.layers.filter((layer: any) => layer.sourceMotionId === sourceMotionId)
    assert.ok(slots.length > 0, sourceMotionId)
    assert.ok(
      slots.every((layer: any) => layer.kind === 'animal'),
      sourceMotionId,
    )
    assert.ok(
      getAnimalHabitat(roomId).actors.some((actor) => actor.sourceMotionId === sourceMotionId),
    )
  }
  const neon = await readManifest('cafe-neon-night')
  assert.deepEqual(
    neon.layers
      .filter((layer: any) => layer.motions?.length > 1)
      .map((layer: any) => ({
        id: layer.id,
        ancestry: layer.motions.map((motion: any) => motion.cssName),
      })),
    ['effect-1', 'effect-3', 'effect-5'].map((id) => ({
      id,
      ancestry: ['neon-breathe', 'neon-sparkle'],
    })),
    'nonliving parent breathe and child sparkle preserve their authored paint order and motion ancestry',
  )
})
test('coffee collections retain five growth states and every live animal has exactly one active slot', async () => {
  for (const id of ['premium-personal-roastery', 'premium-memory-house']) {
    const m = await readManifest(id)
    assert.deepEqual(
      [
        ...new Set(
          m.layers
            .filter((layer: any) => layer.ifCoffeeMin !== undefined)
            .map((layer: any) => layer.ifCoffeeMin),
        ),
      ],
      [0, 1, 5, 10, 25],
    )
    const textures = new Set(m.layers.map((layer: any) => layer.src).filter(Boolean))
    assert.ok(textures.size < m.layers.length, 'growth states reuse unchanged textures')
  }
  for (const room of ALL_BACKGROUNDS) {
    const m = await readManifest(room.id)
    const slots = m.layers.filter(
      (layer: any) =>
        layer.kind === 'animal' &&
        (layer.ifCoffeeMin ?? 0) <= 0 &&
        (layer.ifCoffeeMax ?? Infinity) >= 0,
    )
    assert.deepEqual(
      slots.map((layer: any) => layer.animalId).sort(),
      getAnimalHabitat(room.id)
        .actors.map((actor) => actor.id)
        .sort(),
      room.id,
    )
    assert.equal(
      m.layers.some(
        (layer: any) =>
          layer.motion?.cssName === 'cat-yawn' ||
          layer.motions?.some((motion: any) => motion.cssName === 'cat-yawn'),
      ),
      false,
      'old homed mouth overlay is removed',
    )
  }
})

test('Pixi textures declare current authoring source hashes so stale exports fail validation', async () => {
  const first = await readManifest('cafe-rain')
  assert.ok(first.provenance.sourceHashes.length > 20)
  for (const source of first.provenance.sourceHashes) {
    const actual = createHash('sha256')
      .update(await readFile(source.path))
      .digest('hex')
    assert.equal(actual, source.sha256, `stale Pixi assets: ${source.path}; run export:pixi`)
  }
  for (const room of ALL_BACKGROUNDS)
    assert.equal(
      (await readManifest(room.id)).provenance.sourceDigest,
      first.provenance.sourceDigest,
    )
})

test('moving outdoor artwork keeps a stationary aperture mask and local steam distances become world distances', async () => {
  const sea = await readManifest('premium-underwater-library')
  const fish = sea.layers.filter(
    (layer: any) =>
      layer.kind === 'animal' &&
      getAnimalHabitat(sea.id).actors.some(
        (actor) => actor.id === layer.animalId && actor.species === 'fish',
      ),
  )
  assert.ok(fish.length > 0)
  assert.ok(
    fish.every((layer: any) => layer.clipMask),
    'fish retain fixed pressure-window masking while swimming',
  )
  const cafe = await readManifest('cafe-rain')
  const steam = cafe.layers
    .flatMap((layer: any) => layer.motions ?? [])
    .find((motion: any) => motion.cssName === 'coffee-rise' && motion.ancestorMatrix?.[0] === 0.45)
  assert.ok(steam)
  assert.equal(steam.keyframes.find((frame: any) => frame.offset === 0).y, 2.25)
  assert.equal(steam.keyframes.find((frame: any) => frame.offset === 1).y, -6.3)
})

test('every fullscreen layer and stationary mask has a native three-times-resolution texture', async () => {
  const checked = new Map<string, { width?: number; height?: number }>()
  const dimensions = async (src: string) => {
    if (!checked.has(src)) checked.set(src, await sharp(`public${src}`).metadata())
    return checked.get(src)!
  }
  for (const room of ALL_BACKGROUNDS) {
    const manifest = await readManifest(room.id)
    assert.equal(manifest.resolutionHigh, 3, room.id)
    assert.match(manifest.layers[0].src, /\/rear-(?:base|empty)\.png$/)
    assert.match(manifest.layers[0].srcHigh, /\/rear-(?:high|empty-high)\.png$/)
    assert.match(manifest.provenance.highResolutionSource, /original authoring SVG/)
    for (const layer of manifest.layers) {
      if (layer.kind === 'weather') continue
      if (layer.kind === 'animal') {
        if (layer.clipMask) {
          assert.ok(layer.clipMaskHigh)
          const mask = await dimensions(layer.clipMaskHigh)
          assert.equal(mask.width, 2400)
          assert.equal(mask.height, 2460)
        }
        continue
      }
      assert.equal(layer.resolutionHigh, 3, `${room.id}/${layer.id}`)
      assert.ok(layer.srcHigh && layer.srcHigh !== layer.src)
      const high = await dimensions(layer.srcHigh)
      assert.equal(high.width, layer.width * 3, layer.srcHigh)
      assert.equal(high.height, layer.height * 3, layer.srcHigh)
      if (layer.clipMask) {
        assert.ok(layer.clipMaskHigh)
        const mask = await dimensions(layer.clipMaskHigh)
        assert.equal(mask.width, 2400)
        assert.equal(mask.height, 2460)
      }
    }
    const weather = await dimensions(manifest.weatherMaskHigh)
    assert.equal(weather.width, 2400)
    assert.equal(weather.height, 2460)
  }
})

test('base and fullscreen rear textures keep the same vector composition at both resolutions', async () => {
  for (const room of ALL_BACKGROUNDS) {
    const manifest = await readManifest(room.id)
    const rear = manifest.layers[0]
    const normal = await sharp(`public${rear.src}`).ensureAlpha().raw().toBuffer()
    const high = await sharp(`public${rear.srcHigh}`)
      .resize(rear.width, rear.height)
      .ensureAlpha()
      .raw()
      .toBuffer()
    let difference = 0
    for (let index = 0; index < normal.length; index++)
      difference += Math.abs(normal[index] - high[index])
    assert.ok(difference / normal.length < 1, `${room.id}: rear family composition diverged`)
  }
})

test('native vector normalization preserves relative/smooth/arc paths and uses a separate exact matrix', async () => {
  const { Window } = await import('happy-dom')
  const { createVectorParts, validateNativeParts, vectorProofSvg } = await import(
    '../scripts/pixi-vector-geometry.mjs'
  )
  const window = new Window()
  try {
    const fixtures = [
      '<g transform="translate(120 180) scale(1.2 .8)"><path d="M10 10q20-15 40 0t40 0v40H10Z" fill="#9ba182" stroke="#354c42" stroke-width="2"/></g>',
      '<g transform="rotate(17 200 200)"><path d="M160 200a40 25 18 1 0 80 0a40 25 18 1 0-80 0Z" fill="#a8ad8c"/></g>',
      '<path d="M80 100c20-30 40-30 60 0s40 30 60 0L200 170H80Z" fill="#748e7a"/>',
      '<polyline points="40.5,50.25 70.8,20.3 100.2,50.7" fill="none" stroke="#889a80" stroke-width="2"/>',
    ]
    for (const content of fixtures) {
      window.document.body.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820">${content}</svg>`
      const root = window.document.querySelector('svg')!
      const vector = createVectorParts(Array.from(root.children))
      assert.ok(vector.eligible, vector.reason)
      assert.ok(validateNativeParts(vector, window.document) > 0)
      assert.ok(vector.parts.every((part: any) => !part.svg.includes('transform=')))
      const a = await sharp(Buffer.from(root.outerHTML)).ensureAlpha().raw().toBuffer()
      const b = await sharp(Buffer.from(vectorProofSvg(vector)))
        .ensureAlpha()
        .raw()
        .toBuffer()
      let total = 0
      for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i])
      assert.ok(total / a.length < 0.002, `normalization changed geometry: ${total / a.length}`)
    }
    for (const content of [
      '<g transform="perspective(5)"><rect width="20" height="30"/></g>',
      '<g transform="translate(20oops)"><rect width="20" height="30"/></g>',
      '<g opacity=".5"><rect width="20" height="30"/><rect x="10" width="20" height="30"/></g>',
      '<path d="M0 0L20 20" stroke="#889977" stroke-linecap="round"/>',
      '<path d="M0 0h20v20zM5 5h10v10z" fill="#889977"/>',
      '<rect width="10%" height="20"/>',
    ]) {
      window.document.body.innerHTML = `<svg>${content}</svg>`
      assert.equal(
        createVectorParts(Array.from(window.document.querySelector('svg')!.children)).eligible,
        false,
        content,
      )
    }
  } finally {
    await window.happyDOM.abort()
  }
})

test('all rooms expose meaningful bounded native geometry and independently verified vector proofs', async () => {
  const { Window } = await import('happy-dom')
  const { validateNativeParts } = await import('../scripts/pixi-vector-geometry.mjs')
  const window = new Window()
  let primitives = 0,
    decodedBefore = 0,
    decodedAfter = 0
  try {
    for (const room of ALL_BACKGROUNDS) {
      const manifest = await readManifest(room.id)
      const coverage = manifest.proof.vectorCoverage[0]
      assert.ok(
        coverage.nativePrimitives >= 0,
        `${room.id}: native geometry is optional when splitting costs more`,
      )
      assert.ok(coverage.nativeParts <= 128, `${room.id}: bounded native draw groups`)
      primitives += coverage.nativePrimitives
      decodedBefore += coverage.textureDecodedBytesBefore
      decodedAfter += coverage.textureDecodedBytesAfter
      for (const layer of manifest.layers.filter(
        (layer: any) =>
          layer.vector && (layer.ifCoffeeMin === undefined || layer.ifCoffeeMin === 0),
      )) {
        const vector = layer.vector
        assert.ok(vector.parts.length > 0)
        assert.equal(vector.sourceBounds.x, layer.x)
        assert.equal(vector.sourceBounds.y, layer.y)
        assert.ok(vector.proof.meanAbsoluteError <= 0.02)
        assert.ok(vector.proof.localMeanAbsoluteError <= 0.15)
        assert.equal(
          validateNativeParts(
            { ...vector, expectedInstructions: vector.nativeInstructions },
            window.document,
          ),
          vector.nativeInstructions,
        )
        for (const part of vector.parts) {
          assert.equal(part.matrix.length, 6)
          assert.ok(part.matrix.every(Number.isFinite))
          assert.ok(
            !/transform=|style=|url\(|<(?:g|defs|text|image|use)\b/.test(part.svg),
            'strict flat explicit native input',
          )
        }
      }
      for (const variant of manifest.proof.variants)
        assert.ok(variant.vectorComparison.meanAbsoluteError < 1, room.id)
    }
    assert.ok(
      primitives > 100,
      'native path covers actual scene geometry, not decorative marker dots',
    )
    assert.ok(
      decodedAfter < decodedBefore,
      'native geometry removes measurable decoded texture allocation',
    )
  } finally {
    await window.happyDOM.abort()
  }
})

test('cost guard retains original composites unless bounded splitting saves raster area', async () => {
  for (const room of ALL_BACKGROUNDS) {
    const manifest = await readManifest(room.id)
    for (const layer of manifest.layers) {
      const guard = layer.costGuard
      if (!guard) continue
      assert.ok(guard.retainedRasterCount <= 2)
      assert.ok(guard.retainedRasterArea <= guard.originalArea)
      if (guard.decision === 'cost-saving-split') {
        assert.ok(guard.nativeParts + guard.retainedRasterCount <= 8)
        if (guard.retainedRasterCount === 2)
          assert.ok(guard.retainedRasterArea <= guard.originalArea * 0.8)
      }
    }
    for (const state of manifest.proof.vectorCoverage) {
      const before = state.originalRunBaseline,
        after = state.guardedHybrid
      assert.ok(
        after.logicalArea <= before.logicalArea,
        `${room.id}/${state.coffeeCount}: raster area`,
      )
      assert.ok(after.decoded1xBytes <= before.decoded1xBytes)
      assert.ok(after.decoded3xBytes <= before.decoded3xBytes)
    }
  }
})

test('every human marker protects its complete subtree and inherited descendant geometry from native conversion', async () => {
  const { Window } = await import('happy-dom')
  const { createVectorParts, vectorBoundary, HUMAN_SELECTOR } = await import(
    '../scripts/pixi-vector-geometry.mjs'
  )
  const window = new Window()
  try {
    for (const marker of [
      'data-character',
      'data-character-id',
      'data-pose',
      'data-head-view',
      'data-premium-character',
      'data-premium-person',
      'data-person-view',
    ]) {
      window.document.body.innerHTML = `<svg><g transform="translate(200 300)" ${marker}="person"><g fill="#bca482"><path d="M0 0h20v30H0Z"/><circle cx="10" cy="-7" r="9"/></g></g><rect x="50" width="20" height="30" fill="#889977"/></svg>`
      const root = window.document.querySelector('svg')!,
        human = root.querySelector(HUMAN_SELECTOR)!
      assert.equal(vectorBoundary(human), true)
      assert.equal(createVectorParts([human]).eligible, false)
      assert.equal(createVectorParts([human.querySelector('path')]).eligible, false)
      assert.equal(createVectorParts([root]).eligible, false)
      assert.equal(createVectorParts([root.querySelector('rect')]).eligible, true)
    }
  } finally {
    await window.happyDOM.abort()
  }
})
test('all authored human layers are raster-only with native 3x quality sources', async () => {
  for (const room of ALL_BACKGROUNDS) {
    const manifest = await readManifest(room.id)
    assert.equal(manifest.humanRasterPolicy?.version, 1)
    for (const layer of manifest.layers.filter((layer: any) => layer.sourceRole === 'character')) {
      assert.equal(layer.vector, undefined, `${room.id}/${layer.id}: no partial human vectors`)
      assert.equal(layer.rasterOnlyReason, 'human-subtree')
      assert.ok(layer.srcHigh)
      assert.equal(layer.resolutionHigh, 3)
    }
  }
})
