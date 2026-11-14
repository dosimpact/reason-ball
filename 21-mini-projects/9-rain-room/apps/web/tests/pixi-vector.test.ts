import assert from 'node:assert/strict'
import test from 'node:test'
import { Window } from 'happy-dom'
import { Graphics, Matrix, Point } from 'pixi.js'
const window = new Window()
// Pixi's native SVG geometry parser needs a DOM parser; no renderer/GPU is created.
globalThis.document = window.document as unknown as Document
const draw = (body: string) =>
  new Graphics().svg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`)

test('real Graphics.svg triangle is geometry with correct interior and exterior', () => {
  const g = draw('<path d="M10 20L50 20L10 60Z" fill="#aabbcc"/>')
  const bounds = g.getLocalBounds()
  assert.deepEqual([bounds.minX, bounds.minY, bounds.maxX, bounds.maxY], [10, 20, 50, 60])
  assert.equal(g.containsPoint(new Point(15, 25)), true)
  assert.equal(g.containsPoint(new Point(45, 55)), false)
  const instruction = g.context.instructions[0]
  assert.equal(instruction.action, 'fill')
  assert.equal(instruction.data.style.color, 0xaabbcc)
  assert.equal(
    instruction.data.style.texture.label,
    'WHITE',
    'solid primitive uses shared white texture rather than SVG raster',
  )
  g.destroy()
})
test('real SVG basic rectangle and ellipse retain authored bounds and separate paint alpha', () => {
  const g = draw(
    '<rect x="10" y="20" width="30" height="40" fill="#123456" fill-opacity="0.4"/><ellipse cx="100" cy="110" rx="20" ry="10" fill="#abcdef"/>',
  )
  assert.equal(g.context.instructions.length, 2)
  assert.equal(g.context.instructions[0].data.style.alpha, 0.4)
  assert.equal(g.containsPoint(new Point(20, 30)), true)
  assert.equal(g.containsPoint(new Point(100, 110)), true)
  assert.equal(g.containsPoint(new Point(119, 119)), false)
  const b = g.getLocalBounds()
  assert.deepEqual([b.minX, b.minY, b.maxX, b.maxY], [10, 20, 120, 120])
  g.destroy()
})
test('native parser limitations are demonstrated: transforms and explicit round stroke caps are ignored', () => {
  const g = draw(
    '<path transform="translate(100 200)" d="M0 0L10 0" fill="none" stroke="#ff0000" stroke-width="3" stroke-linecap="round"/>',
  )
  assert.equal(g.context.instructions[0].data.style.cap, 'butt')
  assert.equal(
    g.getLocalBounds().maxX,
    11.5,
    'transform is ignored by installed parser and must be baked or rejected',
  )
  g.destroy()
})
test('native parser cannot composite overlapping group opacity', () => {
  const g = draw(
    '<g opacity="0.5"><rect width="20" height="20" fill="#123456"/><rect x="10" width="20" height="20" fill="#123456"/></g>',
  )
  // Group compositing should yield .5 alpha across its union. A group with
  // opacity alone does not activate a fill style, so its opacity is lost.
  assert.equal(g.context.instructions.length, 2)
  assert.equal(g.context.instructions[0].data.style.alpha, 1)
  assert.equal(g.context.instructions[1].data.style.alpha, 1)
  g.destroy()
})
test.after(async () => {
  await window.happyDOM.abort()
})

test('eligibility accepts explicit primitive paints and rejects known semantic hazards', async () => {
  const { isNativeVectorEligible } = await import('../src/pages/focus/model/pixiScene.ts')
  const candidate = (body: string, extra: Record<string, unknown> = {}) => ({
    id: 'fixture',
    src: '/backgrounds/fixture.png',
    x: 0,
    y: 0,
    width: 800,
    height: 820,
    vector: {
      svg: `<svg>${body}</svg>`,
      primitiveCount: 1,
      sourceBounds: { x: 0, y: 0, width: 800, height: 820 },
    },
    ...extra,
  })
  const safe = '<rect x="10" y="20" width="30" height="40" fill="#123456"/>'
  assert.equal(isNativeVectorEligible(candidate(safe)), true)
  assert.equal(isNativeVectorEligible(candidate('<path d="M0 0L10 0L0 10Z" fill="#abc"/>')), true)
  for (const [label, body] of [
    ['transform', '<rect transform="translate(10 20)" width="20" height="20" fill="#123456"/>'],
    ['group opacity', '<g opacity=".5">' + safe + '</g>'],
    ['gradient', '<rect width="20" height="20" fill="url(#gradient)"/>'],
    ['filter', '<rect filter="url(#blur)" width="20" height="20" fill="#123456"/>'],
    ['style', '<rect style="fill:#123456" width="20" height="20"/>'],
    [
      'compound path',
      '<path d="M0 0H100V100H0ZM25 25H75V75H25Z" fill="#123456" fill-rule="evenodd"/>',
    ],
    ['rounded cap', '<path d="M0 0L10 0" fill="none" stroke="#123456" stroke-linecap="round"/>'],
    ['dash', '<path d="M0 0L10 0" fill="none" stroke="#123456" stroke-dasharray="2 3"/>'],
    ['unequal corner radii', '<rect width="20" height="20" rx="5" ry="2" fill="#123456"/>'],
    ['decimal polygon', '<polygon points="0.5,0 20.5,0 10,20" fill="#123456"/>'],
    ['external image', '<image href="https://example.com/image.png"/>'],
    ['nonfinite coordinate', '<rect width="Infinity" height="20" fill="#123456"/>'],
    ['overflow path', '<path d="M0 0L1e999 20L20 0Z" fill="#123456"/>'],
    ['malformed arity', '<path d="M0 0L10Z" fill="#123456"/>'],
    ['negative geometry', '<rect width="-20" height="20" fill="#123456"/>'],
    ['implicit default fill', '<path d="M0 0L20 0L0 20Z" stroke="#123456"/>'],
    ['out of range alpha', '<rect width="20" height="20" fill="#123456" fill-opacity="2"/>'],
  ])
    assert.equal(isNativeVectorEligible(candidate(body)), false, label)
  assert.equal(
    isNativeVectorEligible(candidate(safe, { clipMask: '/backgrounds/mask.png' })),
    false,
  )
})

test('quadratic native geometry agrees with independent SVG raster interior samples', async () => {
  const { default: sharp } = await import('sharp')
  const body = '<path d="M10 50Q50 10 90 50L90 90H10Z" fill="#123456"/>'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${body}</svg>`
  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const g = draw(body)
  let checked = 0
  for (let y = 5; y < 100; y += 10)
    for (let x = 5; x < 100; x += 10) {
      const alpha = data[(y * info.width + x) * 4 + 3]
      if (alpha !== 0 && alpha !== 255) continue
      assert.equal(
        g.containsPoint(new Point(x + 0.5, y + 0.5)),
        alpha === 255,
        `quadratic coverage at ${x},${y}`,
      )
      checked++
    }
  assert.ok(checked >= 90)
  g.destroy()
})

test('real Graphics part matrix preserves all six affine coefficients and transformed coverage', () => {
  const g = draw('<rect x="0" y="0" width="20" height="10" fill="#123456"/>')
  const rotation = 0.37,
    scaleX = 2.3,
    scaleY = 0.7
  const matrix = new Matrix(
    Math.cos(rotation) * scaleX,
    Math.sin(rotation) * scaleX,
    -Math.sin(rotation) * scaleY,
    Math.cos(rotation) * scaleY,
    123,
    -45,
  )
  g.setFromMatrix(matrix)
  g.updateLocalTransform()
  for (const key of ['a', 'b', 'c', 'd', 'tx', 'ty'] as const)
    assert.ok(Math.abs(g.localTransform[key] - matrix[key]) < 1e-10, key)
  const center = matrix.apply(new Point(10, 5))
  const back = g.localTransform.applyInverse(center)
  assert.equal(g.containsPoint(back), true)
  assert.equal(
    g.containsPoint(g.localTransform.applyInverse(matrix.apply(new Point(30, 5)))),
    false,
  )
  g.destroy()
})

test('every emitted native vector is eligible and constructs finite real geometry', async () => {
  const { readdir, readFile } = await import('node:fs/promises')
  const { isNativeVectorEligible, nativeVectorParts } = await import(
    '../src/pages/focus/model/pixiScene.ts'
  )
  const root = new URL('../public/backgrounds/pixi/', import.meta.url)
  let vectors = 0,
    parts = 0,
    rooms = 0,
    vectorRooms = 0
  for (const room of await readdir(root, { withFileTypes: true })) {
    if (!room.isDirectory()) continue
    const manifest = JSON.parse(await readFile(new URL(`${room.name}/manifest.json`, root), 'utf8'))
    rooms++
    if (manifest.layers.some((layer: { vector?: unknown }) => layer.vector)) vectorRooms++
    for (const layer of manifest.layers) {
      if (layer.kind === 'animal') {
        assert.equal(typeof layer.animalId, 'string', `${room.name}: missing animal identity`)
        assert.equal(
          layer.vector,
          undefined,
          `${room.name}: animal rig must not be a static native vector`,
        )
        assert.equal(
          layer.src,
          undefined,
          `${room.name}: animal slot must not contain a static body texture`,
        )
        continue
      }
      if (!layer.vector) continue
      const label = `${room.name}/${layer.id}`
      assert.equal(isNativeVectorEligible(layer), true, label)
      for (const part of nativeVectorParts(layer)) {
        const g = new Graphics().svg(part.svg)
        g.setFromMatrix(new Matrix(...part.matrix))
        g.updateLocalTransform()
        assert.ok(g.context.instructions.length > 0, `${label}: emptygeometry`)
        const bounds = g.getBounds()
        for (const n of [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY])
          assert.ok(Number.isFinite(n), `${label}: invalidbounds`)
        for (const instruction of g.context.instructions) {
          assert.ok(
            ['fill', 'stroke'].includes(instruction.action),
            `${label}: unexpectedoperation`,
          )
          assert.equal(
            instruction.data.style.texture.label,
            'WHITE',
            `${label}: unintendedrasterpaint`,
          )
        }
        g.destroy()
        parts++
      }
      vectors++
    }
  }
  assert.equal(rooms, 68)
  assert.ok(vectorRooms > 0, 'native geometry collection must not be empty')
  assert.ok(vectors >= vectorRooms, `native geometry missing from scene collection (${vectors})`)
  assert.ok(parts >= vectors)
})
