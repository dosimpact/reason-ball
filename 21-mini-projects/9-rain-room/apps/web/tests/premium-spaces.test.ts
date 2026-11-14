import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_BACKGROUNDS,
  BACKGROUNDS,
  BACKGROUND_CATEGORIES,
  getBackground,
  getBackgroundByScene,
  validateBackgrounds,
} from '../src/pages/focus/model/backgrounds.ts'
import {
  PREMIUM_SPACES,
  PREMIUM_GROUPS,
  PREMIUM_PREVIEW_POLICY,
  validatePremiumSpaces,
} from '../src/pages/focus/model/premiumSpaces.ts'
test('thirty accessible premium rooms extend the stable original catalog', () => {
  assert.equal(BACKGROUNDS.length, 38)
  assert.equal(ALL_BACKGROUNDS.length, 68)
  assert.deepEqual(validateBackgrounds(ALL_BACKGROUNDS), [])
  assert.deepEqual(validatePremiumSpaces(), [])
  assert.equal(PREMIUM_GROUPS.length, 6)
  assert.equal(PREMIUM_PREVIEW_POLICY.allAvailable, true)
  assert.equal(PREMIUM_PREVIEW_POLICY.spendCoffee, false)
  for (const space of PREMIUM_SPACES) {
    assert.equal(getBackground(space.id), space)
    assert.equal(getBackgroundByScene(space.scene), space)
    assert.equal(space.available, true)
  }
})

test('category picker orders standard, epic and legendary spaces without badges', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { Window } = await import('happy-dom')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const window = new Window()
  try {
    const { default: Picker } = await server.ssrLoadModule(
      '/src/pages/focus/ui/BackgroundPicker.tsx',
    )
    for (const category of BACKGROUND_CATEGORIES) {
      const selected = PREMIUM_SPACES.find((space) => space.category === category.id)!
      const expected = ALL_BACKGROUNDS.filter((space) => space.category === category.id)
      window.document.body.innerHTML = renderToStaticMarkup(
        createElement(Picker, { selectedId: selected.id, onSelect: () => {} }),
      )
      const cards = Array.from(
        window.document.querySelectorAll<HTMLButtonElement>('.background-card'),
      )
      assert.equal(cards.length, expected.length)
      const rank = (id: string) => PREMIUM_SPACES.find((space) => space.id === id)?.rarity
      const expectedOrder = [undefined, 'epic', 'legendary'].flatMap((rarity) =>
        expected.filter((space) => rank(space.id) === rarity).map((space) => `${space.name} 선택`),
      )
      assert.deepEqual(
        cards.map((card) => card.getAttribute('aria-label')),
        expectedOrder,
      )
      assert.equal(window.document.querySelector('.premium-card-label'), null)
      assert.ok(cards.every((card) => !card.disabled))
      assert.equal(window.document.querySelectorAll('.background-categories button').length, 6)
      assert.equal(window.document.querySelector('.background-collections'), null)
      assert.ok(cards.some((card) => !card.dataset.rarity))
      for (const space of PREMIUM_SPACES.filter((space) => space.category === category.id)) {
        const card = cards.find((item) => item.getAttribute('aria-label') === `${space.name} 선택`)!
        assert.equal(card.dataset.rarity, space.rarity)
        assert.equal(card.querySelector('.premium-card-label'), null)
      }
      assert.equal(
        window.document.querySelector('.background-card[aria-pressed="true"] .background-card-name')
          ?.textContent,
        selected.name,
      )
      assert.ok(
        window.document.querySelector('.background-card[aria-pressed="true"] .background-selected'),
      )
    }
  } finally {
    await server.close()
    await window.happyDOM.abort()
  }
})

test('all premium spaces carry rarity with six legendary compositions', () => {
  assert.equal(PREMIUM_SPACES.filter((space) => space.rarity === 'epic').length, 24)
  assert.deepEqual(
    PREMIUM_SPACES.filter((space) => space.rarity === 'legendary').map((space) => space.id),
    [
      'premium-orient-express',
      'premium-dragon-study',
      'premium-underwater-library',
      'premium-observatory',
      'premium-moon-base',
      'premium-memory-house',
    ],
  )
})

test('premium interiors retain live authored furniture and occupational casts outside rear assets', async () => {
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
    const { PREMIUM_INTERIORS: profiles } = await server.ssrLoadModule(
      '/src/pages/focus/ui/premium/PremiumInterior.tsx',
    )
    assert.equal(Object.keys(profiles).length, 30)
    for (const field of ['wall', 'floor', 'table', 'lamp', 'occupation']) {
      assert.ok(
        new Set(Object.values(profiles).map((p: any) => p[field])).size >=
          (field === 'floor' ? 8 : 12),
        `${field} uses authored structural variety`,
      )
    }
    let populated = 0
    for (const space of PREMIUM_SPACES) {
      const rear = renderToStaticMarkup(
        createElement(Scene, { spaceId: space.id, layer: 'rear', static: true }),
      )
      const front = renderToStaticMarkup(
        createElement(Scene, { spaceId: space.id, layer: 'foreground', static: true }),
      )
      assert.ok(!rear.includes('data-premium-person='))
      assert.ok(!rear.includes('data-premium-object="table"'))
      assert.ok(!rear.includes('data-premium-signature='))
      assert.ok(rear.includes(`data-premium-material="${profiles[space.id].wall}"`))
      assert.ok(front.includes('data-lamp-style='))
      if (front.includes('data-premium-person=')) populated++
      assert.ok(!front.includes('data-accessory="glasses"'))
    }
    assert.ok(populated >= 23, `distinct occupations appear in ${populated} rooms`)
  } finally {
    await server.close()
  }
})
