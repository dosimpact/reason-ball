import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Window } from 'happy-dom'
import { PREMIUM_SPACES } from '../src/pages/focus/model/premiumSpaces.ts'
import {
  PREMIUM_EXPERIENCES,
  getPremiumExperience,
} from '../src/pages/focus/model/premiumExperience.ts'

const motionCss = ['premium-signatures.css', 'premium.css'].map((file) => ({
  file,
  css: readFileSync(new URL(`../src/pages/focus/ui/premium/${file}`, import.meta.url), 'utf8'),
}))
// Read balanced top-level rules so keyframe bodies and reduced-motion overrides
// cannot be mistaken for a live class's assigned animation.
function cssBlocks(css: string) {
  const blocks: { selector: string; body: string }[] = []
  css = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (let index = 0; index < css.length; ) {
    const open = css.indexOf('{', index)
    if (open < 0) break
    let end = open + 1,
      depth = 1
    while (end < css.length && depth) {
      if (css[end] === '{') depth++
      if (css[end] === '}') depth--
      end++
    }
    blocks.push({ selector: css.slice(index, open).trim(), body: css.slice(open + 1, end - 1) })
    index = end
  }
  return blocks
}
const blocks = motionCss.flatMap(({ css }) => cssBlocks(css))
const keyframes = new Map(
  blocks
    .filter((block) => block.selector.startsWith('@keyframes '))
    .map((block) => [block.selector.split(/\s+/)[1], block.body]),
)
const assignments = blocks
  .filter((block) => !block.selector.startsWith('@'))
  .flatMap((block) => {
    const declaration = block.body.match(/(?:^|;)\s*animation(?:-name)?\s*:\s*([^;]+)/)?.[1]
    const name = declaration?.trim().split(/\s+/)[0]
    return name && name !== 'none'
      ? block.selector.split(',').map((selector) => ({ selector: selector.trim(), name }))
      : []
  })
test('all thirty premium rooms provide four distinct named physical stories', () => {
  assert.deepEqual(
    Object.keys(PREMIUM_EXPERIENCES).sort(),
    PREMIUM_SPACES.map((space) => space.id).sort(),
  )
  const ids = new Set<string>()
  for (const space of PREMIUM_SPACES) {
    const motions = getPremiumExperience(space.id)
    assert.ok(motions.length >= 4, space.id)
    assert.equal(new Set(motions.map((item) => item.kind)).size, motions.length, space.id)
    for (const item of motions) {
      assert.ok(!ids.has(item.id), item.id)
      ids.add(item.id)
      assert.ok(item.label.length > 3)
      assert.ok(item.x >= 0 && item.x <= 800 && item.y >= 0 && item.y <= 820)
      assert.ok(['background', 'foreground'].includes(item.layer))
    }
  }
  assert.deepEqual(getPremiumExperience('unknown'), [])
})
test('all subjects remain in live SVG and outdoor subjects have a geometry clip', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const window = new Window()
  try {
    const { default: Details } = await server.ssrLoadModule(
      '/src/pages/focus/ui/premium/PremiumSignatureDetails.tsx',
    )
    let subjectCount = 0
    for (const space of PREMIUM_SPACES) {
      const bg = renderToStaticMarkup(
        createElement(
          'svg',
          null,
          createElement(Details, { spaceId: space.id, layer: 'background' }),
        ),
      )
      const fg = renderToStaticMarkup(
        createElement(
          'svg',
          null,
          createElement(Details, { spaceId: space.id, layer: 'foreground' }),
        ),
      )
      window.document.body.innerHTML = bg + fg
      for (const item of getPremiumExperience(space.id)) {
        subjectCount++
        const subject = window.document.querySelector(`[data-premium-motion="${item.id}"]`)!
        assert.ok(subject, item.id)
        assert.ok(
          subject.querySelector('path,circle,ellipse,rect'),
          `${item.id}: physical geometry`,
        )
        const animated = Array.from(subject.querySelectorAll('[class]'))
          .map((node) => ({
            node,
            animations: assignments
              .filter((rule) => node.matches(rule.selector))
              .map((rule) => rule.name),
          }))
          .filter((target) => target.animations.length > 0)
        assert.ok(animated.length > 0, `${item.id}: moving part`)
        for (const { node, animations } of animated) {
          const className = node.getAttribute('class')!
          for (const animation of animations) {
            assert.ok(
              keyframes.has(animation),
              `${item.id}: ${className} assigns existing ${animation} keyframes`,
            )
            assert.match(
              keyframes.get(animation)!,
              /transform\s*:/,
              `${item.id}: physical motion in ${animation}`,
            )
          }
        }
        if (item.id === 'storm-lighthouse-beacon') {
          for (const name of [
            'premium-beacon-lens',
            'premium-beacon-sweep',
            'premium-beacon-reflection',
          ]) {
            const target = animated.find(
              ({ node, animations }) => node.classList.contains(name) && animations.includes(name),
            )
            assert.ok(target, `${item.id}: actual ${name} animation inside subject`)
            assert.ok(
              target.node.querySelector('path,circle,ellipse,rect'),
              `${item.id}: ${name} moves real geometry`,
            )
          }
          assert.match(keyframes.get('premium-beacon-lens')!, /rotate\(360deg\)/)
          assert.match(keyframes.get('premium-beacon-sweep')!, /rotate\(/)
          assert.match(keyframes.get('premium-beacon-reflection')!, /translate\(/)
        }
      }
      assert.ok(bg.includes('clip-path='))
      assert.ok(!fg.includes('clip-path='))
    }
    assert.equal(subjectCount, 120, 'all registered premium physical stories were checked')
  } finally {
    await server.close()
    await window.happyDOM.abort()
  }
})

test('signature motion preserves stationary anchors and respects every pause mode', () => {
  const css = readFileSync(
    new URL('../src/pages/focus/ui/premium/premium-signatures.css', import.meta.url),
    'utf8',
  )
  assert.match(css, /data-paused="true"/)
  assert.match(css, /data-static="true"/)
  assert.match(css, /animation-play-state:\s*paused/)
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  assert.match(css, /animation:\s*none\s*!important/)
  for (const frame of css.matchAll(
    /@keyframes\s+(signature-[\w-]+)\s*\{([\s\S]*?)(?=\n@|\n\.premium-artwork)/g,
  )) {
    assert.match(frame[2], /transform:/, frame[1])
  }
  for (const { file, css } of motionCss) {
    assert.match(css, /data-paused="true"/, file)
    assert.match(css, /data-static="true"/, file)
    assert.match(css, /animation-play-state:\s*paused/, file)
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, file)
    assert.match(css, /animation:\s*none\s*!important/, file)
  }
})
