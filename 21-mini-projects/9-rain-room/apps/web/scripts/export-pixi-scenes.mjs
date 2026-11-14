import { writeCachedPng } from './pixi-export-assets.mjs'
import { extractAnimalSlots } from './pixi-animal-slots.mjs'
import {
  createVectorParts,
  validateNativeParts,
  vectorBoundary,
  vectorProofSvg,
  HUMAN_SELECTOR,
} from './pixi-vector-geometry.mjs'
// Build-time React SVG -> ordered Pixi textures. Runtime never receives SVG markup.
// Proofs are deterministic Sharp renders, not browser screenshots or animation captures.
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, stat, rename } from 'node:fs/promises'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const out = `${root}/public/backgrounds/pixi`
const proof = fileURLToPath(new URL('../../../artifacts/pixi-compiler/', import.meta.url))
const vectorProof = fileURLToPath(new URL('../../../artifacts/pixi-vector/', import.meta.url))
const metadataOnly = process.argv.includes('--metadata-only')
const only = process.argv
  .find((arg) => arg.startsWith('--only='))
  ?.slice(7)
  .split(',')
const W = 800,
  H = 820
const window = new Window()
const doc = window.document
const server = await createServer({
  root,
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
})
const checksum = (data) => createHash('sha256').update(data).digest('hex')
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`
const esc = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
const num = (value, fallback = 0) => Number.parseFloat(value) || fallback
const seconds = (value) => (value?.trim().endsWith('ms') ? num(value) / 1000 : num(value))

// Balanced CSS blocks preserve nested keyframes; no browser/CSS animation engine is used.
function blocks(css) {
  const result = []
  for (let index = 0; index < css.length; ) {
    const open = css.indexOf('{', index)
    if (open < 0) break
    let depth = 1,
      end = open + 1
    while (end < css.length && depth) {
      if (css[end] === '{') depth++
      if (css[end] === '}') depth--
      end++
    }
    result.push({ selector: css.slice(index, open).trim(), body: css.slice(open + 1, end - 1) })
    index = end
  }
  return result
}
const declarations = (body) =>
  Object.fromEntries(
    body
      .split(';')
      .map((line) => {
        const i = line.indexOf(':')
        return i < 0
          ? []
          : [
              line.slice(0, i).trim(),
              line
                .slice(i + 1)
                .replace(/!important/g, '')
                .trim(),
            ]
      })
      .filter((entry) => entry.length === 2),
  )
const cssPaths = [
  'backgrounds.css',
  'scene-effects.css',
  'premium/premium.css',
  'premium/premium-signatures.css',
]
const rules = [],
  frames = new Map()
for (const path of cssPaths) {
  const css = (await readFile(`${root}/src/pages/focus/ui/${path}`, 'utf8')).replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  )
  for (const block of blocks(css)) {
    if (block.selector.startsWith('@keyframes'))
      frames.set(block.selector.split(/\s+/)[1], blocks(block.body))
    else if (
      !block.selector.startsWith('@') &&
      !/data-paused|data-static|animation-play-state|scene-thumbnail/.test(block.selector)
    ) {
      const decl = declarations(block.body)
      if (decl.animation || decl['animation-name'] || decl['transform-origin'])
        for (const selector of block.selector.split(','))
          rules.push({ selector: selector.trim(), decl })
    }
  }
}
function valueFromAncestors(node, name, fallback) {
  for (let current = node; current; current = current.parentElement) {
    const value = current.style?.getPropertyValue(name)
    if (value) return value
  }
  return fallback
}
function resolveVariables(value, node) {
  return value?.replace(/var\((--[\w-]+)(?:,\s*([^)]*))?\)/g, (_, name, fallback) =>
    valueFromAncestors(node, name, fallback ?? '0s'),
  )
}
function transformFields(value) {
  const result = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 }
  for (const match of (value ?? '').matchAll(
    /(translate(?:X|Y)?|rotate|scale(?:X|Y)?|skew(?:X|Y))\(([^)]*)\)/g,
  )) {
    const values = match[2]
      .split(/[ ,]+/)
      .filter(Boolean)
      .map((v) => num(v))
    switch (match[1]) {
      case 'translate':
        result.x = values[0]
        result.y = values[1] ?? 0
        break
      case 'translateX':
        result.x = values[0]
        break
      case 'translateY':
        result.y = values[0]
        break
      case 'rotate':
        result.rotation = (values[0] * Math.PI) / 180
        break
      case 'scale':
        result.scaleX = values[0]
        result.scaleY = values[1] ?? values[0]
        break
      case 'scaleX':
        result.scaleX = values[0]
        break
      case 'scaleY':
        result.scaleY = values[0]
        break
      case 'skewX':
        result.skewX = (values[0] * Math.PI) / 180
        break
      case 'skewY':
        result.skewY = (values[0] * Math.PI) / 180
        break
    }
  }
  return result
}
const multiply = (l, r) => [
  l[0] * r[0] + l[2] * r[1],
  l[1] * r[0] + l[3] * r[1],
  l[0] * r[2] + l[2] * r[3],
  l[1] * r[2] + l[3] * r[3],
  l[0] * r[4] + l[2] * r[5] + l[4],
  l[1] * r[4] + l[3] * r[5] + l[5],
]
function svgMatrix(value) {
  let matrix = [1, 0, 0, 1, 0, 0]
  for (const match of (value ?? '').matchAll(
    /(matrix|translate|scale|rotate|skewX|skewY)\(([^)]*)\)/g,
  )) {
    const v = (match[2].match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number),
      angle = ((v[0] ?? 0) * Math.PI) / 180
    let next = [1, 0, 0, 1, 0, 0]
    if (match[1] === 'matrix') next = v
    if (match[1] === 'translate') next = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0]
    if (match[1] === 'scale') next = [v[0], 0, 0, v[1] ?? v[0], 0, 0]
    if (match[1] === 'rotate') {
      next = [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]
      if (v.length === 3)
        next = multiply(multiply([1, 0, 0, 1, v[1], v[2]], next), [1, 0, 0, 1, -v[1], -v[2]])
    }
    if (match[1] === 'skewX') next = [1, 0, Math.tan(angle), 1, 0, 0]
    if (match[1] === 'skewY') next = [1, Math.tan(angle), 0, 1, 0, 0]
    matrix = multiply(matrix, next)
  }
  return matrix
}
function ancestorMatrix(node) {
  const path = []
  for (
    let parent = node.parentElement;
    parent && parent.localName !== 'svg';
    parent = parent.parentElement
  )
    path.unshift(parent)
  return path.reduce(
    (matrix, parent) => multiply(matrix, svgMatrix(parent.getAttribute('transform'))),
    [1, 0, 0, 1, 0, 0],
  )
}
let motionSerial = 0
function animation(node) {
  const decl = {}
  for (const rule of rules) {
    try {
      if (node.matches(rule.selector)) Object.assign(decl, rule.decl)
    } catch {}
  }
  const shorthand = resolveVariables(decl.animation, node)
  let name = decl['animation-name'] ?? shorthand?.split(/\s+/)[0]
  if (!name || name === 'none' || !frames.has(name)) return null
  const times = shorthand?.match(/-?(?:\d*\.)?\d+m?s\b/g) ?? []
  const inheritedDuration = node.getAttribute('class')?.startsWith('signature-')
    ? valueFromAncestors(node, '--signature-duration')
    : valueFromAncestors(node, '--detail-duration')
  const inheritedDelay = node.getAttribute('class')?.startsWith('signature-')
    ? valueFromAncestors(node, '--signature-delay')
    : valueFromAncestors(node, '--detail-delay')
  const duration = seconds(
    resolveVariables(
      node.style.animationDuration ||
        inheritedDuration ||
        decl['animation-duration'] ||
        times[0] ||
        '8s',
      node,
    ),
  )
  const delay = seconds(
    resolveVariables(
      node.style.animationDelay || inheritedDelay || decl['animation-delay'] || times[1] || '0s',
      node,
    ),
  )
  const keyframes = []
  const world = ancestorMatrix(node)
  const determinant = world[0] * world[3] - world[1] * world[2]
  for (const frame of frames.get(name)) {
    const values = declarations(frame.body)
    for (const offsetText of frame.selector.split(',')) {
      const offset =
        offsetText.trim() === 'from' ? 0 : offsetText.trim() === 'to' ? 1 : num(offsetText) / 100
      const local = values.transform ? transformFields(values.transform) : {}
      if (values.transform) {
        const x = local.x,
          y = local.y
        local.x = world[0] * x + world[2] * y
        local.y = world[1] * x + world[3] * y
        if (determinant < 0) {
          local.rotation *= -1
          local.skewX *= -1
          local.skewY *= -1
        }
      }
      keyframes.push({
        offset,
        ...local,
        ...(values.opacity !== undefined ? { alpha: num(values.opacity) } : {}),
      })
    }
  }
  const owner = node.closest('[data-premium-motion]')
  return {
    id: `motion-${++motionSerial}`,
    kind: name,
    cssName: name,
    ancestorMatrix: world,
    className: node.getAttribute('class') ?? '',
    duration: duration || 8,
    delay,
    keyframes: keyframes.sort((a, b) => a.offset - b.offset),
    easing: shorthand?.includes('linear')
      ? 'linear'
      : shorthand?.includes('ease-in-out')
        ? 'ease-in-out'
        : shorthand?.includes('ease-in')
          ? 'ease-in'
          : 'ease-in-out',
    alternate: shorthand?.includes('alternate') ?? false,
    baseAlpha: node.hasAttribute('opacity') ? num(node.getAttribute('opacity'), 1) : 1,
    origin: node.style.transformOrigin || decl['transform-origin'] || 'center',
    sourceMotionId: owner?.getAttribute('data-premium-motion') ?? undefined,
  }
}
const ignored = new Set(['defs', 'title', 'desc', 'metadata', 'style'])
function buildPaintRuns(source) {
  const motions = new Map(),
    contains = new Map()
  // `.some` short-circuits, so inspect each child explicitly.
  const scan = (node) => {
    if (ignored.has(node.localName)) return false
    if (node.hasAttribute('data-pixi-animal-slot')) {
      contains.set(node, true)
      return true
    }
    const m = animation(node)
    if (m) motions.set(node, m)
    let nested = false
    for (const child of node.children) nested = scan(child) || nested
    contains.set(node, Boolean(m) || nested)
    return Boolean(m) || nested
  }
  scan(source)
  const atoms = []
  const candidates = new WeakMap()
  const candidate = (node) => {
    if (!candidates.has(node)) candidates.set(node, createVectorParts([node]))
    return candidates.get(node)
  }
  function visit(node, stack) {
    if (ignored.has(node.localName)) return
    if (node.hasAttribute('data-pixi-animal-slot')) {
      atoms.push({
        node,
        motions: [],
        animalId: node.getAttribute('data-pixi-animal-slot'),
        vector: { eligible: false },
      })
      return
    }
    const next = motions.has(node) ? [...stack, motions.get(node)] : stack
    const nested = Array.from(node.children).some((child) => contains.get(child))
    if (node !== source && !nested) {
      const vector = candidate(node)
      if (vector.eligible || !node.children.length || vectorBoundary(node)) {
        atoms.push({ node, motions: next, vector })
        return
      }
    }
    for (const child of node.children) visit(child, next)
  }
  visit(source, [])
  const runs = []
  for (const atom of atoms) {
    const key =
      (atom.animalId ? `animal:${atom.animalId}` : atom.motions.map((m) => m.id).join(',')) +
      '|' +
      (atom.vector.eligible ? 'vector' : 'raster')
    const previous = runs.at(-1)
    const count = atom.vector.primitiveCount ?? 0,
      parts = atom.vector.parts?.length ?? 0
    if (
      previous?.key === key &&
      previous.primitiveCount + count <= 256 &&
      previous.partCount + parts <= 24
    ) {
      previous.nodes.push(atom.node)
      previous.primitiveCount += count
      previous.partCount += parts
    } else
      runs.push({
        key,
        animalId: atom.animalId,
        motions: atom.motions,
        nodes: [atom.node],
        vectorEligible: atom.vector.eligible,
        primitiveCount: count,
        partCount: parts,
      })
  }
  let originalGroup = -1,
    lastOriginalKey = null
  for (const run of runs) {
    const key = run.animalId ? `animal:${run.animalId}` : run.motions.map((m) => m.id).join(',')
    if (key !== lastOriginalKey) {
      originalGroup++
      lastOriginalKey = key
    }
    run.originalGroup = originalGroup
  }
  const definitions = Array.from(source.querySelectorAll('defs'))
    .map((node) => node.innerHTML)
    .join('')
  function isolated(nodes, unclip = false) {
    const selected = new Set(nodes)
    const ancestors = new Set()
    for (const node of nodes)
      for (
        let current = node.parentElement;
        current && current !== source;
        current = current.parentElement
      )
        ancestors.add(current)
    const copy = (node) => {
      if (ignored.has(node.localName)) return ''
      if (selected.has(node)) {
        const clone = node.cloneNode(true)
        for (const def of clone.querySelectorAll('defs')) def.remove()
        return clone.outerHTML
      }
      if (!ancestors.has(node)) return ''
      const clone = node.cloneNode(false)
      if (unclip) {
        clone.removeAttribute('clip-path')
        clone.removeAttribute('mask')
      }
      clone.innerHTML = Array.from(node.children).map(copy).join('')
      return clone.outerHTML
    }
    return svg(`<defs>${definitions}</defs>${Array.from(source.children).map(copy).join('')}`)
  }
  function clipping(nodes) {
    const groups = []
    for (const node of nodes) {
      const ancestors = []
      for (
        let current = node.parentElement;
        current && current !== source;
        current = current.parentElement
      )
        ancestors.unshift(current)
      if (!ancestors.some((n) => n.hasAttribute('clip-path') || n.hasAttribute('mask'))) continue
      let body = '<rect x="-10000" y="-10000" width="20000" height="20000" fill="white"/>'
      for (const ancestor of ancestors.reverse()) {
        const attrs = ['transform', 'clip-path', 'mask']
          .filter((name) => ancestor.hasAttribute(name))
          .map((name) => `${name}="${esc(ancestor.getAttribute(name))}"`)
          .join(' ')
        body = `<g ${attrs}>${body}</g>`
      }
      groups.push(body)
    }
    return groups.length ? svg(`<defs>${definitions}</defs>${groups.join('')}`) : null
  }
  return { runs, isolated, clipping }
}
function parseSvgs(markup) {
  const holder = doc.createElement('div')
  holder.innerHTML = markup
  return Array.from(holder.querySelectorAll('svg')).filter(
    (node) => !node.parentElement?.closest('svg'),
  )
}
const render = (Component, props, prefix) =>
  renderToStaticMarkup(createElement(Component, props), { identifierPrefix: prefix })
async function raster(source) {
  return sharp(Buffer.from(source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
}
function bounds(data, width, height) {
  let left = width,
    top = height,
    right = -1,
    bottom = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3]) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
  return right < left ? null : { left, top, width: right - left + 1, height: bottom - top + 1 }
}
const HIGH_RESOLUTION = 3
const highTextureCache = new Map()
const nativePartBudgets = new Map()
/** Rasterize the original vector at 216 DPI; existing 1x PNGs are never enlarged. */
async function exportHigh(source, box, roomPath, assetCache, prefix = 'high') {
  const key = `${roomPath}:${prefix}:${checksum(source)}:${JSON.stringify(box)}`
  if (highTextureCache.has(key)) return highTextureCache.get(key)
  let pipeline = sharp(Buffer.from(source), { density: 72 * HIGH_RESOLUTION })
  if (box)
    pipeline = pipeline.extract({
      left: box.left * HIGH_RESOLUTION,
      top: box.top * HIGH_RESOLUTION,
      width: box.width * HIGH_RESOLUTION,
      height: box.height * HIGH_RESOLUTION,
    })
  const png = await pipeline.png().toBuffer()
  const hash = checksum(png).slice(0, 20),
    name = `${prefix}-${hash}.png`
  await writeCachedPng(roomPath, name, png, assetCache)
  const path = `/backgrounds/pixi/${roomPath.split('/').at(-1)}/${name}`
  highTextureCache.set(key, path)
  return path
}
function sourceRole(nodes) {
  const markers = HUMAN_SELECTOR
  if (nodes.some((node) => node.closest(markers) || node.querySelector(markers))) return 'character'
  const soft =
    '.effect-lamp,.effect-steam,.lamp-sparkle,.premium-atmosphere-drawing,.premium-steam,.premium-light-breathe,.premium-motes,.steam'
  const softShape = (node) => {
    if (node.closest(soft)) return true
    const opacity = Number(node.getAttribute('opacity') ?? 1)
    const d = (node.getAttribute('d') ?? '').replace(/\s+/g, '')
    if (opacity <= 0.2 && (d === 'M00h800v820H0z' || d === 'M00h800v820H0Z')) return true
    const reference = node.getAttribute('fill')?.match(/^url\(#([^)]*)\)$/)?.[1]
    if (reference) {
      const gradient = node.ownerSVGElement?.querySelector(`[id="${reference}"]`)
      if (gradient?.localName === 'radialGradient') {
        const stops = Array.from(gradient.querySelectorAll('stop'))
        if (
          stops.length &&
          stops.every((stop) => Number(stop.getAttribute('stop-opacity') ?? 1) <= 0.5)
        )
          return true
      }
    }
    return false
  }
  if (nodes.every(softShape)) return 'soft-effect'
  return 'structural'
}
async function compileTree(tree, roomPath, assetCache, conditions = {}) {
  const { runs, isolated, clipping } = buildPaintRuns(tree)
  const result = []
  async function compileRun(run) {
    const source = isolated(run.nodes, Boolean(run.motions.length))
    const { data, info } = await raster(source)
    const box = bounds(data, info.width, info.height)
    if (!box) return null
    const png = await sharp(data, { raw: info }).extract(box).png().toBuffer()
    const hash = checksum(png).slice(0, 20),
      name = `${hash}.png`
    await writeCachedPng(roomPath, name, png, assetCache)
    const layer = {
      id: `layer-${result.length}`,
      src: `/backgrounds/pixi/${roomPath.split('/').at(-1)}/${name}`,
      srcHigh: metadataOnly ? undefined : await exportHigh(source, box, roomPath, assetCache),
      resolutionHigh: HIGH_RESOLUTION,
      x: box.left,
      y: box.top,
      width: box.width,
      height: box.height,
      ...conditions,
      sourceTag: run.nodes[0].localName,
      sourceRole: sourceRole(run.nodes),
      rasterOnlyReason: sourceRole(run.nodes) === 'character' ? 'human-subtree' : undefined,
      sourceClasses: [
        ...new Set(
          run.nodes
            .flatMap((n) =>
              Array.from(n.querySelectorAll('[class]')).map((c) => c.getAttribute('class')),
            )
            .concat(run.nodes.map((n) => n.getAttribute('class')))
            .filter(Boolean),
        ),
      ],
    }
    if (metadataOnly) {
      return { layer, png, box, source }
    }
    if (run.motions.length) {
      layer.motions = run.motions.map((m) => ({ ...m }))
      const maskSource = clipping(run.nodes)
      if (maskSource) {
        const mask = await sharp(Buffer.from(maskSource)).png().toBuffer()
        const maskHash = checksum(mask).slice(0, 20),
          maskName = `clip-${maskHash}.png`
        await writeCachedPng(roomPath, maskName, mask, assetCache)
        layer.clipMask = `/backgrounds/pixi/${roomPath.split('/').at(-1)}/${maskName}`
        layer.clipMaskHigh = await exportHigh(maskSource, null, roomPath, assetCache, 'clip-high')
      }
    }
    let vectorPng = null
    const budgetKey = roomPath + JSON.stringify(conditions)
    if (!nativePartBudgets.has(budgetKey)) nativePartBudgets.set(budgetKey, 128)
    if (run.vectorEligible && !layer.clipMask) {
      const vector = createVectorParts(run.nodes)
      if (vector.eligible) {
        try {
          const nativeInstructions = validateNativeParts(vector, doc)
          const vectorSource = vectorProofSvg(vector)
          const normalized = await sharp(Buffer.from(vectorSource))
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true })
          let sum = 0,
            changed = 0,
            localSum = 0
          for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
              for (let channel = 0; channel < 4; channel++) {
                const i = (y * W + x) * 4 + channel,
                  d = Math.abs(data[i] - normalized.data[i])
                sum += d
                if (d > 2) changed++
                if (
                  x >= box.left &&
                  x < box.left + box.width &&
                  y >= box.top &&
                  y < box.top + box.height
                )
                  localSum += d
              }
          const error = sum / data.length,
            localError = localSum / (box.width * box.height * 4)
          if (
            error <= 0.02 &&
            changed / data.length <= 0.0001 &&
            localError <= 0.15 &&
            vector.parts.length <= nativePartBudgets.get(budgetKey)
          ) {
            vectorPng = await sharp(normalized.data, { raw: normalized.info }).png().toBuffer()
            nativePartBudgets.set(budgetKey, nativePartBudgets.get(budgetKey) - vector.parts.length)
            layer.vector = {
              version: 1,
              parts: vector.parts,
              primitiveCount: vector.primitiveCount,
              nativeInstructions,
              sourceBounds: { x: box.left, y: box.top, width: box.width, height: box.height },
              proof: {
                meanAbsoluteError: error,
                localMeanAbsoluteError: localError,
                channelFractionAbove2: changed / data.length,
              },
              parserPolicy: 'flat-explicit-leaves-native-matrix-miter4',
            }
          } else layer.vectorFallbackReason = `normalization-diff:${error.toFixed(6)}`
        } catch (error) {
          layer.vectorFallbackReason = `native-parser:${error.message}`
        }
      } else layer.vectorFallbackReason = vector.reason
    }
    return { layer, png, box, source, vectorPng }
  }
  const groups = []
  for (const run of runs) {
    if (groups.at(-1)?.id === run.originalGroup) groups.at(-1).runs.push(run)
    else groups.push({ id: run.originalGroup, runs: [run] })
  }
  for (const group of groups) {
    const animalRun = group.runs.find((run) => run.animalId)
    if (animalRun) {
      const layer = {
        id: `animal-${result.length}`,
        kind: 'animal',
        animalId: animalRun.animalId,
        sourceMotionId: animalRun.nodes[0].getAttribute('data-animal-source-motion') || undefined,
        ...conditions,
      }
      const maskSource = clipping(animalRun.nodes)
      if (maskSource) {
        const mask = await sharp(Buffer.from(maskSource)).png().toBuffer()
        const name = `animal-clip-${checksum(mask).slice(0, 20)}.png`
        await writeCachedPng(roomPath, name, mask, assetCache)
        layer.clipMask = `/backgrounds/pixi/${roomPath.split('/').at(-1)}/${name}`
        layer.clipMaskHigh = await exportHigh(
          maskSource,
          null,
          roomPath,
          assetCache,
          'animal-clip-high',
        )
      }
      const png = await sharp({
        create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .png()
        .toBuffer()
      result.push({ layer, png, box: { left: 0, top: 0, width: 1, height: 1 }, source: svg('') })
      continue
    }
    const nodes = group.runs.flatMap((run) => run.nodes),
      wholeVector = createVectorParts(nodes)
    const whole = { nodes, motions: group.runs[0].motions, vectorEligible: wholeVector.eligible }
    const original = await compileRun(whole)
    if (!original) continue
    if (metadataOnly) {
      result.push(original)
      for (const run of group.runs) {
        const item = await compileRun(run)
        if (item) result.push(item)
      }
      continue
    }
    const budgetKey = roomPath + JSON.stringify(conditions),
      budgetBefore = nativePartBudgets.get(budgetKey)
    let chosen = [original],
      decision = original.layer.vector ? 'whole-native' : 'original-composite'
    const estimatedRaster = group.runs.filter((run) => !run.vectorEligible).length
    const estimatedParts = group.runs.reduce(
      (n, run) => n + (run.vectorEligible ? run.partCount : 0),
      0,
    )
    if (
      !original.layer.vector &&
      group.runs.length > 1 &&
      estimatedRaster <= 2 &&
      estimatedParts + estimatedRaster <= 8
    ) {
      const proposed = []
      for (const run of group.runs) {
        const item = await compileRun(run)
        if (item) proposed.push(item)
      }
      const remaining = proposed.filter((item) => !item.layer.vector)
      const rasterArea = remaining.reduce((n, item) => n + item.box.width * item.box.height, 0)
      const nativeParts = proposed.reduce(
        (n, item) => n + (item.layer.vector?.parts.length ?? 0),
        0,
      )
      if (
        nativeParts > 0 &&
        (remaining.length <= 1 ||
          (remaining.length === 2 &&
            rasterArea <= original.box.width * original.box.height * 0.8)) &&
        rasterArea <= original.box.width * original.box.height &&
        nativeParts + remaining.length <= 8
      ) {
        chosen = proposed
        decision = 'cost-saving-split'
      } else nativePartBudgets.set(budgetKey, budgetBefore)
    }
    for (const item of chosen) {
      item.layer.costGuard = {
        originalGroup: `${checksum(tree.outerHTML).slice(0, 10)}-${group.id}`,
        decision,
        originalSrc: original.layer.src,
        originalSrcHigh: original.layer.srcHigh,
        originalWidth: original.box.width,
        originalHeight: original.box.height,
        originalArea: original.box.width * original.box.height,
        retainedRasterCount: chosen.filter((part) => !part.layer.vector).length,
        retainedRasterArea: chosen
          .filter((part) => !part.layer.vector)
          .reduce((n, part) => n + part.box.width * part.box.height, 0),
        nativeParts: chosen.reduce((n, part) => n + (part.layer.vector?.parts.length ?? 0), 0),
        originalClipMask: original.layer.clipMask,
        originalClipMaskHigh: original.layer.clipMaskHigh,
      }
      result.push(item)
    }
  }
  // The union bounds of every paint run belonging to a CSS target gives its fill-box in world coordinates.
  const targets = new Map()
  for (const { layer } of result)
    for (const motion of layer.motions ?? []) {
      const old = targets.get(motion.id)
      targets.set(
        motion.id,
        old
          ? {
              left: Math.min(old.left, layer.x),
              top: Math.min(old.top, layer.y),
              right: Math.max(old.right, layer.x + layer.width),
              bottom: Math.max(old.bottom, layer.y + layer.height),
            }
          : {
              left: layer.x,
              top: layer.y,
              right: layer.x + layer.width,
              bottom: layer.y + layer.height,
            },
      )
    }
  for (const { layer } of result)
    if (layer.motions) {
      for (const motion of layer.motions) {
        const b = targets.get(motion.id),
          origin = motion.origin
        motion.pivotX = origin.includes('left')
          ? b.left
          : origin.includes('right')
            ? b.right
            : (b.left + b.right) / 2
        motion.pivotY = origin.includes('top')
          ? b.top
          : origin.includes('bottom')
            ? b.bottom
            : (b.top + b.bottom) / 2
        delete motion.origin
      }
      layer.motion = layer.motions[0]
    }
  return result
}
async function maskFor(room, { Overlay, geometry }, scale = 1) {
  if (room.id.startsWith('premium-')) {
    const g = geometry(room.id)
    return sharp(
      Buffer.from(
        svg(
          `<defs><mask id="weather-visible"><path d="${esc(g.opening)}" fill="white"/><path d="${esc(g.frames)}" fill="none" stroke="black" stroke-width="12"/></mask></defs><rect width="800" height="820" fill="white" mask="url(#weather-visible)"/>`,
        ),
      ),
      { density: 72 * scale },
    )
      .png()
      .toBuffer()
  }
  const element = parseSvgs(
    render(Overlay, { backgroundId: room.id, static: true }, `mask-${room.scene}-`),
  )[0]
  const clipped = element.querySelector('g[clip-path]')
  clipped.innerHTML = '<rect width="800" height="820" fill="white"/>'
  return sharp(Buffer.from(svg(element.innerHTML)), { density: 72 * scale })
    .png()
    .toBuffer()
}
function removeWeather(tree) {
  for (const node of tree.querySelectorAll('.scene-weather-drawing')) node.remove()
}
async function compare(reference, compiled) {
  const a = await sharp(reference).ensureAlpha().raw().toBuffer(),
    b = await sharp(compiled).ensureAlpha().raw().toBuffer()
  let total = 0,
    max = 0,
    changed = 0
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i])
    total += d
    max = Math.max(max, d)
    if (d > 2) changed++
  }
  return {
    meanAbsoluteError: total / a.length,
    maxChannelDifference: max,
    channelFractionAbove2: changed / a.length,
  }
}
async function sourceEvidence() {
  const pending = [
      fileURLToPath(import.meta.url),
      `${root}/src/pages/focus/model/animalHabitats.ts`,
      `${root}/src/pages/focus/model/animalSpecies.ts`,
      ...[
        'Cafe.tsx',
        'SceneAtmosphere.tsx',
        'RainOverlay.tsx',
        'premium/PremiumScene.tsx',
        'premium/PremiumAtmosphere.tsx',
      ].map((path) => `${root}/src/pages/focus/ui/${path}`),
    ],
    seen = new Map()
  while (pending.length) {
    const path = pending.pop()
    if (seen.has(path)) continue
    const contents = await readFile(path, 'utf8')
    seen.set(path, checksum(contents))
    for (const match of contents.matchAll(
      /\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g,
    )) {
      if (!match[1].startsWith('.')) continue
      const target = resolve(dirname(path), match[1])
      for (const candidate of [
        target,
        `${target}.ts`,
        `${target}.tsx`,
        `${target}.css`,
        `${target}/index.ts`,
      ]) {
        try {
          if ((await stat(candidate)).isFile()) {
            pending.push(candidate)
            break
          }
        } catch {}
      }
    }
  }
  const files = [...seen.entries()]
    .map(([path, sha256]) => ({ path: relative(root, path), sha256 }))
    .sort((a, b) => a.path.localeCompare(b.path))
  return { sourceDigest: checksum(JSON.stringify(files)), sourceHashes: files }
}
const evidence = await sourceEvidence()
const report = []
try {
  await Promise.all([out, proof, vectorProof].map((path) => mkdir(path, { recursive: true })))
  const { ALL_BACKGROUNDS } = await server.ssrLoadModule('/src/pages/focus/model/backgrounds.ts')
  const { getAnimalHabitat } = await server.ssrLoadModule(
    '/src/pages/focus/model/animalHabitats.ts',
  )
  const { getSceneWeather } = await server.ssrLoadModule('/src/pages/focus/model/sceneWeather.ts')
  const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
  const { default: Premium } = await server.ssrLoadModule(
    '/src/pages/focus/ui/premium/PremiumScene.tsx',
  )
  const { default: Atmosphere } = await server.ssrLoadModule(
    '/src/pages/focus/ui/SceneAtmosphere.tsx',
  )
  const { PremiumAtmosphereDrawing } = await server.ssrLoadModule(
    '/src/pages/focus/ui/premium/PremiumAtmosphere.tsx',
  )
  const { default: Overlay } = await server.ssrLoadModule('/src/pages/focus/ui/RainOverlay.tsx')
  const { premiumGeometry: geometry } = await server.ssrLoadModule(
    '/src/pages/focus/ui/premium/premiumGeometry.ts',
  )
  if (metadataOnly) {
    let matched = 0
    for (const room of ALL_BACKGROUNDS) {
      const path = `${out}/${room.id}/manifest.json`,
        manifest = JSON.parse(await readFile(path, 'utf8')),
        roles = new Map()
      const premium = room.id.startsWith('premium-'),
        levels = ['premium-personal-roastery', 'premium-memory-house'].includes(room.id)
          ? [0, 1, 5, 10, 25]
          : [0]
      const changed = manifest.provenance.sourceHashes
        .filter(
          (old) =>
            evidence.sourceHashes.find((next) => next.path === old.path)?.sha256 !== old.sha256,
        )
        .map((source) => source.path)
      if (changed.some((path) => path !== 'scripts/export-pixi-scenes.mjs'))
        throw Error(`Metadata-only cannot refresh changed authoring: ${changed.join(',')}`)
      for (const coffeeCount of levels) {
        const trees = []
        if (premium) {
          const atmosphere = parseSvgs(
            render(
              'svg',
              {
                children: createElement(PremiumAtmosphereDrawing, {
                  spaceId: room.id,
                  static: true,
                }),
              },
              `atmo-${room.scene}-`,
            ),
          )[0]
          removeWeather(atmosphere)
          trees.push(atmosphere)
          trees.push(
            parseSvgs(
              render(
                Premium,
                { spaceId: room.id, layer: 'foreground', static: true, coffeeCount },
                `front-${room.scene}-`,
              ),
            )[0],
          )
        } else {
          trees.push(
            parseSvgs(
              render(
                Cafe,
                { backgroundId: room.id, layer: 'foreground', artOnly: true, paused: true },
                `front-${room.scene}-`,
              ),
            )[0],
          )
          const effects = parseSvgs(
            render(
              Atmosphere,
              {
                backgroundId: room.id,
                paused: true,
                preview: { yawn: true, gust: false, lightning: false },
              },
              `effects-${room.scene}-`,
            ),
          ).find((node) => node.classList.contains('scene-effects-overlay'))
          if (effects) trees.push(effects)
        }
        for (const tree of trees)
          for (const { layer } of await compileTree(tree, `${out}/${room.id}`, new Set())) {
            if (roles.get(layer.src) !== 'character') roles.set(layer.src, layer.sourceRole)
          }
      }
      for (const layer of manifest.layers) {
        if (layer.kind === 'weather') continue
        if (layer.id === 'rear') layer.sourceRole = 'structural'
        else if (layer.restHidden) layer.sourceRole = 'structural'
        else {
          const role = roles.get(layer.src)
          if (!role) throw Error(`Unmatched metadata layer ${room.id}/${layer.id}`)
          layer.sourceRole = role
          matched++
        }
        if (layer.sourceRole === 'character') layer.rasterOnlyReason = 'human-subtree'
        else delete layer.rasterOnlyReason
      }
      Object.assign(manifest.provenance, evidence)
      await writeFile(path, JSON.stringify(manifest, null, 2) + '\n')
      console.log(`Metadata ${room.id}`)
    }
    console.log(`Refreshed source roles/hash for 68 manifests: ${matched} matched layers`)
  }
  for (const room of (metadataOnly ? [] : ALL_BACKGROUNDS).filter(
    (room) => !only || only.includes(room.id),
  )) {
    const animalPlan = getAnimalHabitat(room.id)
    const roomPath = `${out}/${room.id}`
    await mkdir(roomPath, { recursive: true })
    const premium = room.id.startsWith('premium-'),
      cache = new Set(),
      layers = [],
      variants = []
    const coffeeLevels = ['premium-personal-roastery', 'premium-memory-house'].includes(room.id)
      ? [0, 1, 5, 10, 25]
      : [0]
    const rearPath = `/backgrounds/pixi/${room.id}/rear-base.png`
    const rearTree = parseSvgs(
      render(
        premium ? Premium : Cafe,
        premium
          ? { spaceId: room.id, layer: 'rear', static: true }
          : { backgroundId: room.id, layer: 'rear', artOnly: true, paused: true },
        `rear-${room.scene}-`,
      ),
    )[0]
    const rearAnimalIds = extractAnimalSlots(rearTree, animalPlan)
    await sharp(Buffer.from(svg(rearTree.innerHTML)))
      .png()
      .toFile(`${roomPath}/rear-base.png`)
    const rearHigh = await sharp(Buffer.from(svg(rearTree.innerHTML)), {
      density: 72 * HIGH_RESOLUTION,
    })
      .png()
      .toBuffer()
    await writeFile(`${roomPath}/rear-high.png`, rearHigh)
    if (rearAnimalIds.length) {
      const empty = await sharp({
        create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .png()
        .toBuffer()
      await writeFile(`${roomPath}/rear-empty.png`, empty)
      await sharp(empty).resize(3, 3).png().toFile(`${roomPath}/rear-empty-high.png`)
      layers.push({
        id: 'rear',
        sourceRole: 'structural',
        src: `/backgrounds/pixi/${room.id}/rear-empty.png`,
        srcHigh: `/backgrounds/pixi/${room.id}/rear-empty-high.png`,
        resolutionHigh: 3,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      })
      const rearCompiled = await compileTree(rearTree, roomPath, cache)
      layers.push(...rearCompiled.map(({ layer }, index) => ({ ...layer, id: `rear-${index}` })))
    } else {
      layers.push({
        id: 'rear',
        sourceRole: 'structural',
        src: rearPath,
        srcHigh: `/backgrounds/pixi/${room.id}/rear-high.png`,
        resolutionHigh: HIGH_RESOLUTION,
        x: 0,
        y: 0,
        width: W,
        height: H,
      })
    }
    if (premium) layers.push({ id: 'weather', kind: 'weather' })
    for (const [variantIndex, coffeeCount] of coffeeLevels.entries()) {
      const conditions =
        coffeeLevels.length > 1
          ? {
              ifCoffeeMin: coffeeCount,
              ...(coffeeLevels[variantIndex + 1] !== undefined
                ? { ifCoffeeMax: coffeeLevels[variantIndex + 1] - 1 }
                : {}),
            }
          : {}
      const trees = []
      if (premium) {
        const atmosphere = parseSvgs(
          render(
            'svg',
            {
              children: createElement(PremiumAtmosphereDrawing, { spaceId: room.id, static: true }),
            },
            `atmo-${room.scene}-`,
          ),
        )[0]
        removeWeather(atmosphere)
        trees.push(atmosphere)
        trees.push(
          parseSvgs(
            render(
              Premium,
              { spaceId: room.id, layer: 'foreground', static: true, coffeeCount },
              `front-${room.scene}-`,
            ),
          )[0],
        )
      } else {
        trees.push(
          parseSvgs(
            render(
              Cafe,
              { backgroundId: room.id, layer: 'foreground', artOnly: true, paused: true },
              `front-${room.scene}-`,
            ),
          )[0],
        )
      }
      for (const tree of trees) extractAnimalSlots(tree, animalPlan)
      const compiled = []
      for (const tree of trees)
        compiled.push(...(await compileTree(tree, roomPath, cache, conditions)))
      if (!premium) {
        // Weather paints over foreground with the original WindowExclusions mask; detail effects paint last.
        if (!variantIndex) {
          layers.push(...compiled.map(({ layer }, index) => ({ ...layer, id: `art-${index}` })))
          layers.push({ id: 'weather', kind: 'weather' })
        }
        const effect = parseSvgs(
          render(
            Atmosphere,
            {
              backgroundId: room.id,
              paused: true,
              preview: { yawn: false, gust: false, lightning: false },
            },
            `effects-${room.scene}-`,
          ),
        ).find((node) => node.classList.contains('scene-effects-overlay'))
        if (effect) {
          extractAnimalSlots(effect, animalPlan)
          for (const yawn of effect.querySelectorAll('[data-effect="cat-yawn"]')) yawn.remove()
          trees.push(effect)
          compiled.push(...(await compileTree(effect, roomPath, cache, conditions)))
        }
        layers.push(
          ...compiled
            .slice(layers.filter((l) => l.id.startsWith('art-')).length)
            .map(({ layer }, index) => ({ ...layer, id: `effect-${index}` })),
        )
      } else
        layers.push(
          ...compiled.map(({ layer }, index) => ({ ...layer, id: `v${variantIndex}-${index}` })),
        )
      const rear = await readFile(`${root}/public${rearPath}`)
      const reference = await sharp(
        Buffer.from(
          svg(
            `<image href="data:image/png;base64,${rear.toString('base64')}" width="800" height="820"/>${trees.map((tree) => tree.innerHTML).join('')}`,
          ),
        ),
      )
        .png()
        .toBuffer()
      const compositeInputs = []
      for (const item of compiled) {
        let input = item.png,
          left = item.box.left,
          top = item.box.top
        if (item.layer.clipMask) {
          input = await sharp({
            create: {
              width: W,
              height: H,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
          })
            .composite([{ input: item.png, left, top }])
            .png()
            .toBuffer()
          input = await sharp(input)
            .composite([
              { input: await readFile(`${root}/public${item.layer.clipMask}`), blend: 'dest-in' },
            ])
            .png()
            .toBuffer()
          left = 0
          top = 0
        }
        compositeInputs.push({ input, left, top })
      }
      const combined = await sharp(rear).composite(compositeInputs).png().toBuffer()
      const comparison = await compare(reference, combined)
      const vectorInputs = []
      for (const item of compiled) {
        if (item.vectorPng) vectorInputs.push({ input: item.vectorPng, left: 0, top: 0 })
        else {
          let input = item.png,
            left = item.box.left,
            top = item.box.top
          if (item.layer.clipMask) {
            input = await sharp({
              create: {
                width: W,
                height: H,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
              },
            })
              .composite([{ input, left, top }])
              .png()
              .toBuffer()
            input = await sharp(input)
              .composite([
                { input: await readFile(`${root}/public${item.layer.clipMask}`), blend: 'dest-in' },
              ])
              .png()
              .toBuffer()
            left = 0
            top = 0
          }
          vectorInputs.push({ input, left, top })
        }
      }
      const nativeComposite = await sharp(rear).composite(vectorInputs).png().toBuffer()
      const vectorComparison = await compare(reference, nativeComposite)
      if (coffeeCount === 0) {
        const onlyVector = compiled
          .filter((item) => item.vectorPng)
          .map((item) => ({ input: item.vectorPng, left: 0, top: 0 }))
        await sharp({
          create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
        })
          .composite(onlyVector)
          .png()
          .toFile(`${vectorProof}/${room.id}-native-only.png`)
      }

      await writeFile(
        `${vectorProof}/${room.id}${coffeeCount ? `-coffee${coffeeCount}` : ''}-vector.png`,
        nativeComposite,
      )

      await writeFile(
        `${proof}/${room.id}${coffeeCount ? `-coffee${coffeeCount}` : ''}-reference.png`,
        reference,
      )
      await writeFile(
        `${proof}/${room.id}${coffeeCount ? `-coffee${coffeeCount}` : ''}-compiled.png`,
        combined,
      )
      if (
        coffeeCount === 0 &&
        ['cafe-rain', 'premium-neon-loft', 'premium-underwater-library'].includes(room.id)
      ) {
        const highInputs = []
        for (const item of compiled) {
          if (item.layer.kind === 'animal') continue
          let input = await readFile(`${root}/public${item.layer.srcHigh}`),
            left = item.box.left * HIGH_RESOLUTION,
            top = item.box.top * HIGH_RESOLUTION
          if (item.layer.clipMaskHigh) {
            input = await sharp({
              create: {
                width: W * HIGH_RESOLUTION,
                height: H * HIGH_RESOLUTION,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
              },
            })
              .composite([{ input, left, top }])
              .png()
              .toBuffer()
            input = await sharp(input)
              .composite([
                {
                  input: await readFile(`${root}/public${item.layer.clipMaskHigh}`),
                  blend: 'dest-in',
                },
              ])
              .png()
              .toBuffer()
            left = 0
            top = 0
          }
          highInputs.push({ input, left, top })
        }
        const high = await sharp(rearHigh).composite(highInputs).png().toBuffer()
        await writeFile(`${proof}/${room.id}-3x.png`, high)
        const crop = {
          left: 280 * HIGH_RESOLUTION,
          top: 380 * HIGH_RESOLUTION,
          width: 240 * HIGH_RESOLUTION,
          height: 240 * HIGH_RESOLUTION,
        }
        const native = await sharp(high).extract(crop).png().toBuffer()
        const enlarged = await sharp(combined)
          .resize(W * HIGH_RESOLUTION, H * HIGH_RESOLUTION, { kernel: 'cubic' })
          .extract(crop)
          .png()
          .toBuffer()
        await sharp({ create: { width: 1440, height: 760, channels: 4, background: '#18211f' } })
          .composite([
            { input: enlarged, left: 0, top: 40 },
            { input: native, left: 720, top: 40 },
            {
              input: Buffer.from(
                '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="40"><text x="15" y="26" fill="#e1e6dc" font-family="sans-serif" font-size="18">1x PNG enlarged (before)</text><text x="735" y="26" fill="#e1e6dc" font-family="sans-serif" font-size="18">Original SVG rasterized at 3x (after)</text></svg>',
              ),
              left: 0,
              top: 0,
            },
          ])
          .png()
          .toFile(`${proof}/${room.id}-resolution-detail.png`)
      }
      variants.push({ coffeeCount, ...comparison, vectorComparison })
    }
    if (!premium && !animalPlan.actors.some((actor) => actor.species === 'cat')) {
      const yawnSource = parseSvgs(
        render(
          Atmosphere,
          {
            backgroundId: room.id,
            paused: true,
            preview: { yawn: true, gust: false, lightning: false },
          },
          `yawn-${room.scene}-`,
        ),
      ).find((node) => node.classList.contains('scene-effects-overlay'))
      const yawn = yawnSource?.querySelector('[data-effect="cat-yawn"]')
      if (yawn) {
        const tree = parseSvgs(
          svg(
            `<defs>${Array.from(yawnSource.querySelectorAll('defs'))
              .map((n) => n.innerHTML)
              .join('')}</defs>${yawn.outerHTML}`,
          ),
        )[0]
        const exported = await compileTree(tree, roomPath, cache)
        for (const { layer } of exported) {
          for (const motion of layer.motions ?? []) {
            motion.keyframes = [
              { offset: 0, alpha: 0 },
              { offset: 0.9, alpha: 0 },
              ...motion.keyframes.map((frame) => ({ ...frame, offset: 0.9 + frame.offset * 0.04 })),
              { offset: 0.96, alpha: 0 },
              { offset: 1, alpha: 0 },
            ].sort((a, b) => a.offset - b.offset)
            motion.duration = 60
            motion.delay = 0
            motion.alternate = false
            motion.sourceMotionId = `${room.id}-cat-yawn`
          }
          layer.id = `cat-yawn-${layers.length}`
          layer.restHidden = true
          layer.motion = layer.motions?.[0]
          layers.push(layer)
        }
      }
    }
    const animalIds = new Set(
      layers.filter((layer) => layer.kind === 'animal').map((layer) => layer.animalId),
    )
    for (const actor of animalPlan.actors)
      if (!animalIds.has(actor.id)) throw Error(`Missing living animal slot ${room.id}/${actor.id}`)
    const weatherMask = await maskFor(room, { Overlay, geometry })
    await writeFile(`${roomPath}/weather-mask.png`, weatherMask)
    await writeFile(
      `${roomPath}/weather-mask-high.png`,
      await maskFor(room, { Overlay, geometry }, HIGH_RESOLUTION),
    )
    const vectorCoverage = []
    for (const coffeeCount of coffeeLevels) {
      const active = layers.filter(
        (layer) =>
          (layer.ifCoffeeMin ?? 0) <= coffeeCount && (layer.ifCoffeeMax ?? Infinity) >= coffeeCount,
      )
      const all = new Map(),
        remaining = new Map()
      for (const layer of active)
        if (layer.srcHigh) {
          const entry = { bytes: layer.width * layer.height * 36, src: layer.srcHigh }
          all.set(layer.srcHigh, entry)
          if (!layer.vector) remaining.set(layer.srcHigh, entry)
        }
      const avoided = [...all.values()].filter((item) => !remaining.has(item.src))
      let compressedBytesAvoided = 0
      for (const item of avoided)
        compressedBytesAvoided += (await stat(`${root}/public${item.src}`)).size
      const baselineTextures = new Map(),
        hybridTextures = new Map()
      const add = (map, src, width, height) => {
        if (src) map.set(src, { width, height })
      }
      add(baselineTextures, `/backgrounds/pixi/${room.id}/weather-mask-high.png`, W, H)
      add(hybridTextures, `/backgrounds/pixi/${room.id}/weather-mask-high.png`, W, H)
      for (const layer of active) {
        const guard = layer.costGuard
        add(
          baselineTextures,
          guard?.originalSrcHigh ?? layer.srcHigh,
          guard?.originalWidth ?? layer.width,
          guard?.originalHeight ?? layer.height,
        )
        add(baselineTextures, guard?.originalClipMaskHigh ?? layer.clipMaskHigh, W, H)
        if (!layer.vector) add(hybridTextures, layer.srcHigh, layer.width, layer.height)
        add(hybridTextures, layer.clipMaskHigh, W, H)
      }
      const inventory = (map) => ({
        uniquePNGCount: map.size,
        logicalArea: [...map.values()].reduce((n, item) => n + item.width * item.height, 0),
        decoded1xBytes: [...map.values()].reduce((n, item) => n + item.width * item.height * 4, 0),
        decoded3xBytes: [...map.values()].reduce((n, item) => n + item.width * item.height * 36, 0),
      })
      vectorCoverage.push({
        originalRunBaseline: inventory(baselineTextures),
        guardedHybrid: inventory(hybridTextures),
        coffeeCount,
        nativeLayers: active.filter((layer) => layer.vector).length,
        nativePrimitives: active.reduce((n, layer) => n + (layer.vector?.primitiveCount ?? 0), 0),
        nativeParts: active.reduce((n, layer) => n + (layer.vector?.parts.length ?? 0), 0),
        textureDecodedBytesBefore: [...all.values()].reduce((n, item) => n + item.bytes, 0),
        textureDecodedBytesAfter: [...remaining.values()].reduce((n, item) => n + item.bytes, 0),
        compressedHighTextureBytesAvoided: compressedBytesAvoided,
      })
    }
    const manifest = {
      version: 1,
      animalLifeVersion: 1,
      animalPolicy: {
        staticBodiesRemoved: true,
        supportsPreserved: true,
        actorIds: [...animalIds],
        proof: 'bodyless static textures; live pose proof generated separately',
      },
      id: room.id,
      width: W,
      height: H,
      weather: getSceneWeather(room.id),
      weatherMask: `/backgrounds/pixi/${room.id}/weather-mask.png`,
      weatherMaskHigh: `/backgrounds/pixi/${room.id}/weather-mask-high.png`,
      resolutionHigh: HIGH_RESOLUTION,
      humanRasterPolicy: {
        version: 1,
        selector: HUMAN_SELECTOR,
        qualityResolution: 3,
        scope: 'complete human ancestry; no native face, limb, clothing or held prop fragments',
      },
      layers,
      provenance: {
        method:
          'Build-time bodyless React SVG/Sharp decomposition; live animals in ordered native slots',
        source: 'authoring Cafe/PremiumScene',
        cssKeyframes: true,
        highResolutionSource:
          'original authoring SVG rasterized at 216 DPI, never enlarged from PNG',
        ...evidence,
      },
      proof: {
        variants,
        vectorCoverage,
        staticBodiesRemoved: true,
        liveAnimalsExcludedFromStaticProof: true,
      },
    }
    await writeFile(`${roomPath}/manifest.pending.json`, JSON.stringify(manifest, null, 2) + '\n')
    await rename(`${roomPath}/manifest.pending.json`, `${roomPath}/manifest.json`)
    report.push({
      id: room.id,
      layers: layers.length,
      dynamicLayers: layers.filter((l) => l.motion).length,
      textures: cache.size,
      vectorCoverage,
      vectorLayers: layers.filter((layer) => layer.vector).length,
      vectorPrimitives: layers.reduce((n, layer) => n + (layer.vector?.primitiveCount ?? 0), 0),
      vectorParts: layers.reduce((n, layer) => n + (layer.vector?.parts.length ?? 0), 0),
      estimatedHighTextureBytesAvoided: layers
        .filter((layer) => layer.vector)
        .reduce((n, layer) => n + layer.width * layer.height * 9 * 4, 0),
      variants,
    })
    console.log(
      `Compiled ${report.length}/${only?.length ?? 68} ${room.id}: ${layers.length} layers, ${cache.size} textures; MAE ${variants[0].meanAbsoluteError.toFixed(5)}`,
    )
  }
  if (!only && !metadataOnly) {
    const tiles = []
    for (const [index, entry] of report.entries()) {
      for (const [column, name] of ['reference', 'compiled'].entries()) {
        const input = await sharp(`${proof}/${entry.id}-${name}.png`)
          .resize(200, 205)
          .png()
          .toBuffer()
        tiles.push({
          input,
          left: (index % 4) * 400 + column * 200,
          top: Math.floor(index / 4) * 240,
        })
      }
      const label = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="35"><rect width="400" height="35" fill="#172120"/><text x="8" y="14" fill="#d5ddd4" font-family="sans-serif" font-size="10">${entry.id}</text><text x="8" y="28" fill="#aebfb7" font-family="sans-serif" font-size="10">SVG reference | layered PNG — MAE ${entry.variants[0].meanAbsoluteError.toFixed(4)}</text></svg>`,
      )
      tiles.push({ input: label, left: (index % 4) * 400, top: Math.floor(index / 4) * 240 + 205 })
    }
    const nativeTiles = []
    for (const [index, entry] of report.entries()) {
      for (const [column, path] of [
        `${proof}/${entry.id}-reference.png`,
        `${vectorProof}/${entry.id}-vector.png`,
      ].entries())
        nativeTiles.push({
          input: await sharp(path).resize(200, 205).png().toBuffer(),
          left: (index % 4) * 400 + column * 200,
          top: Math.floor(index / 4) * 240,
        })
      const c = entry.vectorCoverage[0]
      const label = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="35"><rect width="400" height="35" fill="#172120"/><text x="8" y="14" fill="#d5ddd4" font-family="sans-serif" font-size="10">${entry.id}</text><text x="8" y="28" fill="#aebfb7" font-family="sans-serif" font-size="10">Source | native ${c.nativePrimitives} primitives / ${c.nativeParts} parts</text></svg>`,
      )
      nativeTiles.push({
        input: label,
        left: (index % 4) * 400,
        top: Math.floor(index / 4) * 240 + 205,
      })
    }
    await sharp({
      create: {
        width: 1600,
        height: Math.ceil(report.length / 4) * 240,
        channels: 4,
        background: '#172120',
      },
    })
      .composite(nativeTiles)
      .png()
      .toFile(`${vectorProof}/comparison-contact-sheet.png`)
    await sharp({
      create: {
        width: 1600,
        height: Math.ceil(report.length / 4) * 240,
        channels: 4,
        background: '#172120',
      },
    })
      .composite(tiles)
      .png()
      .toFile(`${proof}/comparison-contact-sheet.png`)
  }
  if (!metadataOnly)
    await writeFile(
      `${vectorProof}/coverage.json`,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          method:
            'Strict native Pixi Graphics parser validation plus independent normalized-vector SVG recomposite vs source SVG; not browser screenshots',
          rooms: report,
        },
        null,
        2,
      ) + '\n',
    )
  if (!metadataOnly)
    await writeFile(
      `${proof}/report.json`,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          method: 'Static SVG baseline vs ordered PNG recomposite; weather excluded from both',
          rooms: report,
        },
        null,
        2,
      ) + '\n',
    )
} finally {
  await window.happyDOM.abort()
  await server.close()
}
