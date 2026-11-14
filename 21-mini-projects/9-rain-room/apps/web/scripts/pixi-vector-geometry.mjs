// Strict adapter for Pixi 8's real SVG parser. Unsupported paint stays raster.
// Graphics.svg ignores SVG transforms/inherited-none/caps/joins: parts are flat,
// explicit leaf paints and a separate native Graphics matrix, never silent loss.
import { GraphicsContext, GraphicsPath } from 'pixi.js'

/** People are always authored raster subtrees; partial faces/limbs never enter Pixi's SVG parser. */
export const HUMAN_SELECTOR =
  '[data-character],[data-character-id],[data-pose],[data-head-view],[data-premium-character],[data-premium-person],[data-person-view]'
export function hasHumanGeometry(node) {
  return Boolean(node.closest(HUMAN_SELECTOR) || node.querySelector(HUMAN_SELECTOR))
}
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'])
const SKIP = new Set(['defs', 'title', 'desc', 'metadata', 'style'])
const PROPERTIES = [
  'fill',
  'stroke',
  'stroke-width',
  'fill-opacity',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'fill-rule',
  'vector-effect',
]
const xml = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
const number = (value) => Number.parseFloat(value)
const multiply = (l, r) => [
  l[0] * r[0] + l[2] * r[1],
  l[1] * r[0] + l[3] * r[1],
  l[0] * r[2] + l[2] * r[3],
  l[1] * r[2] + l[3] * r[3],
  l[0] * r[4] + l[2] * r[5] + l[4],
  l[1] * r[4] + l[3] * r[5] + l[5],
]
function transform(value) {
  let result = [1, 0, 0, 1, 0, 0]
  const expression = /(matrix|translate|scale|rotate|skewX|skewY)\(([^)]*)\)/g
  if ((value ?? '').replace(expression, '').replace(/[\s,]+/g, '') !== '')
    throw Error('unsupported SVG transform syntax')
  for (const match of (value ?? '').matchAll(
    /(matrix|translate|scale|rotate|skewX|skewY)\(([^)]*)\)/g,
  )) {
    const v = (match[2].match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number),
      angle = ((v[0] ?? 0) * Math.PI) / 180
    const remaining = match[2]
      .replace(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi, '')
      .replace(/[\s,]+/g, '')
    const count =
      match[1] === 'matrix'
        ? [6]
        : match[1] === 'rotate'
          ? [1, 3]
          : ['translate', 'scale'].includes(match[1])
            ? [1, 2]
            : [1]
    if (remaining || !count.includes(v.length) || v.some((n) => !Number.isFinite(n)))
      throw Error('unsupported SVG transform arguments')
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
    result = multiply(result, next)
  }
  return result
}
const paintCountCache = new WeakMap()
function paintCount(node) {
  if (paintCountCache.has(node)) return paintCountCache.get(node)
  if (SKIP.has(node.localName)) return 0
  const count = SHAPES.has(node.localName)
    ? 1
    : Array.from(node.children).reduce((n, child) => n + paintCount(child), 0)
  paintCountCache.set(node, count)
  return count
}
function pathOf(node) {
  if (node.localName === 'path') {
    // Normalize relative/smooth commands using the exact installed Pixi path parser.
    const parsed = new GraphicsPath(node.getAttribute('d') ?? '')
    return parsed.instructions
      .map(({ action, data }) => {
        const spec = {
          moveTo: ['M', 2],
          lineTo: ['L', 2],
          bezierCurveTo: ['C', 6],
          quadraticCurveTo: ['Q', 4],
          arcToSvg: ['A', 7],
          closePath: ['Z', 0],
        }[action]
        if (!spec) throw Error(`Unsupported native path instruction ${action}`)
        const [letter, count] = spec
        const values = data
          .slice(0, count)
          .map((n, index) =>
            action === 'arcToSvg' && (index === 3 || index === 4) && typeof n === 'boolean'
              ? Number(n)
              : n,
          )
        if (
          values.length !== count ||
          values.some((n) => typeof n !== 'number' || !Number.isFinite(n))
        )
          throw Error(`Invalid native path operands ${action}`)
        if (action === 'arcToSvg' && ![values[3], values[4]].every((n) => n === 0 || n === 1))
          throw Error('Invalid arc flags')
        return letter + values.join(' ')
      })
      .join(' ')
  }
  if (node.localName === 'polygon' || node.localName === 'polyline') {
    const points = node.getAttribute('points')?.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? []
    if (points.length < 4 || points.length % 2) throw Error('Invalid points')
    return (
      points.map((value, index) => (index % 2 ? value : `${index ? 'L' : 'M'}${value}`)).join(' ') +
      (node.localName === 'polygon' ? 'Z' : '')
    )
  }
  return null
}
function ancestry(node) {
  const path = []
  for (let current = node; current; current = current.parentElement) {
    path.unshift(current)
    if (current.localName === 'svg') break
  }
  return path
}
function resolveStyle(node) {
  const style = {
    fill: '#000000',
    stroke: 'none',
    'stroke-width': '1',
    'fill-opacity': '1',
    'stroke-opacity': '1',
    'stroke-linecap': 'butt',
    'stroke-linejoin': 'miter',
    'stroke-miterlimit': '4',
    'fill-rule': 'nonzero',
    'vector-effect': 'none',
  }
  let opacity = 1,
    matrix = [1, 0, 0, 1, 0, 0]
  for (const current of ancestry(node)) {
    const inline = Object.fromEntries(
      (current.getAttribute('style') ?? '')
        .split(';')
        .map((line) => {
          const at = line.indexOf(':')
          return at < 0 ? [] : [line.slice(0, at).trim(), line.slice(at + 1).trim()]
        })
        .filter((pair) => pair.length === 2),
    )
    for (const name of ['filter', 'clip-path', 'mask', 'mix-blend-mode'])
      if (current.hasAttribute(name) || inline[name]) throw Error(`unsupported ${name}`)
    if (inline.transform) throw Error('CSS transforms require raster')
    const currentOpacity = number(inline.opacity ?? current.getAttribute('opacity') ?? 1)
    if (currentOpacity !== 1 && current !== node && paintCount(current) > 1)
      throw Error('isolated group opacity')
    opacity *= currentOpacity
    for (const key of PROPERTIES)
      if (inline[key] !== undefined || current.hasAttribute(key))
        style[key] = inline[key] ?? current.getAttribute(key)
    matrix = multiply(matrix, transform(current.getAttribute('transform')))
  }
  return { style, opacity, matrix }
}
function primitive(node) {
  if (hasHumanGeometry(node)) throw Error('human raster-only subtree')
  const { style, opacity, matrix } = resolveStyle(node)
  if (
    !Number.isFinite(opacity) ||
    opacity < 0 ||
    opacity > 1 ||
    matrix.some((n) => !Number.isFinite(n))
  )
    throw Error('invalid alpha/matrix')
  if (style['vector-effect'] !== 'none') throw Error('vector-effect')
  const fill = node.localName === 'line' ? 'none' : style.fill
  const stroke = style.stroke
  for (const color of [fill, stroke])
    if (!/^(?:none|#[\da-f]{3}|#[\da-f]{6}|black|white)$/i.test(color))
      throw Error(`non-flat paint ${color}`)
  if (fill === 'none' && stroke === 'none') return null
  if (stroke !== 'none') {
    if (
      style['stroke-linecap'] !== 'butt' ||
      style['stroke-linejoin'] !== 'miter' ||
      number(style['stroke-miterlimit']) !== 4
    )
      throw Error('nondefault stroke cap/join/miter')
    for (const current of ancestry(node))
      if (
        current.hasAttribute('stroke-dasharray') ||
        current.hasAttribute('stroke-dashoffset') ||
        /stroke-dash/.test(current.getAttribute('style') ?? '')
      )
        throw Error('dashed stroke')
  }
  let geometry,
    tag = node.localName
  const d = pathOf(node)
  if (d !== null) {
    if (fill !== 'none' && (d.match(/M/g) ?? []).length > 1) throw Error('compound filled path')
    tag = 'path'
    geometry = `d="${xml(d)}"`
  } else {
    const attrs = {
      rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
      circle: ['cx', 'cy', 'r'],
      ellipse: ['cx', 'cy', 'rx', 'ry'],
      line: ['x1', 'y1', 'x2', 'y2'],
    }[tag]
    if (!attrs) throw Error(`unsupported ${tag}`)
    if (tag === 'rect') {
      const rx = number(node.getAttribute('rx') ?? node.getAttribute('ry') ?? 0),
        ry = number(node.getAttribute('ry') ?? node.getAttribute('rx') ?? 0)
      if (rx !== ry) throw Error('elliptical rounded rectangle')
    }
    for (const name of attrs)
      if (
        node.hasAttribute(name) &&
        !/^[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?(?:px)?$/i.test(node.getAttribute(name).trim())
      )
        throw Error('non-numeric geometry units')
    geometry = attrs
      .filter((name) => node.hasAttribute(name))
      .map((name) => `${name}="${number(node.getAttribute(name))}"`)
      .join(' ')
  }
  const fillAlpha = number(style['fill-opacity']) * opacity,
    strokeAlpha = number(style['stroke-opacity']) * opacity
  if (
    !Number.isFinite(fillAlpha) ||
    fillAlpha < 0 ||
    fillAlpha > 1 ||
    !Number.isFinite(strokeAlpha) ||
    strokeAlpha < 0 ||
    strokeAlpha > 1
  )
    throw Error('invalid paint alpha')
  if (!Number.isFinite(number(style['stroke-width'])) || number(style['stroke-width']) < 0)
    throw Error('invalid stroke width')
  const paint = `fill="${xml(fill)}" stroke="${xml(stroke)}" stroke-width="${number(style['stroke-width'])}" fill-opacity="${fillAlpha}" stroke-opacity="${strokeAlpha}"`
  return {
    svg: `<${tag} ${geometry} ${paint}/>`,
    matrix,
    expected: (fill === 'none' ? 0 : 1) + (stroke === 'none' ? 0 : 1),
  }
}
export function vectorBoundary(node) {
  if (node.matches(HUMAN_SELECTOR)) return true
  if (SKIP.has(node.localName)) return false
  if (['text', 'image', 'use', 'foreignObject'].includes(node.localName)) return true
  if (['filter', 'clip-path', 'mask'].some((attr) => node.hasAttribute(attr))) return true
  const opacity = number(node.style?.opacity || node.getAttribute('opacity') || 1)
  return opacity !== 1 && paintCount(node) > 1
}
/** Safe coverage is bounded to 256 primitives / 24 matrices per native layer. */
export function createVectorParts(nodes, { maxPrimitives = 256, maxParts = 24 } = {}) {
  const parts = []
  let primitiveCount = 0,
    expected = 0
  const visit = (node) => {
    if (SKIP.has(node.localName)) return
    if (SHAPES.has(node.localName)) {
      const item = primitive(node)
      if (!item) return
      primitiveCount++
      expected += item.expected
      const key = JSON.stringify(item.matrix)
      if (parts.at(-1)?.key === key) {
        parts.at(-1).body += item.svg
        parts.at(-1).primitiveCount++
      } else parts.push({ key, body: item.svg, matrix: item.matrix, primitiveCount: 1 })
      if (primitiveCount > maxPrimitives || parts.length > maxParts)
        throw Error('native layer complexity cap')
    } else if (node.localName === 'g' || node.localName === 'svg') {
      for (const child of node.children) visit(child)
    } else throw Error(`unsupported ${node.localName}`)
  }
  try {
    if (nodes.some(hasHumanGeometry)) throw Error('human raster-only subtree')
    for (const node of nodes) visit(node)
    if (!primitiveCount) return { eligible: false, reason: 'empty' }
    return {
      eligible: true,
      primitiveCount,
      parts: parts.map(({ body, matrix, primitiveCount }) => ({
        svg: `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
        matrix,
        primitiveCount,
      })),
      expectedInstructions: expected,
    }
  } catch (error) {
    return { eligible: false, reason: error.message }
  }
}
export function validateNativeParts(vector, document) {
  const previous = globalThis.document
  globalThis.document = document
  let instructions = 0
  try {
    for (const part of vector.parts) {
      const context = new GraphicsContext().svg(part.svg)
      if (context.instructions.some((item) => !['fill', 'stroke'].includes(item.action)))
        throw Error('unsupported native instruction')
      for (const item of context.instructions) {
        if (item.action === 'stroke') item.data.style.miterLimit = 4
        if (item.data.style?.fill) throw Error('non-flat native fill')
      }
      instructions += context.instructions.length
      context.destroy()
    }
    if (instructions !== vector.expectedInstructions)
      throw Error(`native instruction mismatch ${instructions}/${vector.expectedInstructions}`)
    return instructions
  } finally {
    if (previous === undefined) delete globalThis.document
    else globalThis.document = previous
  }
}
export function vectorProofSvg(vector, width = 800, height = 820) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 800 820">${vector.parts.map((part) => `<g transform="matrix(${part.matrix.join(' ')})">${part.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`).join('')}</svg>`
}
