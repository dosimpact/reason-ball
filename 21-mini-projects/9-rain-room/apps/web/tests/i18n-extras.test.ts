import test from 'node:test'
import assert from 'node:assert/strict'

test('coffee stamps and scene clock render localized text without Korean fallback', async () => {
  const { createServer } = await import('vite')
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const server = await createServer({
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  try {
    const { i18n } = await server.ssrLoadModule('/src/shared/i18n/index.ts')
    const { default: Coffee } = await server.ssrLoadModule(
      '/src/pages/focus/ui/CoffeeCollection.tsx',
    )
    const { default: Caption } = await server.ssrLoadModule('/src/pages/focus/ui/SceneCaption.tsx')
    for (const [lang, title, currentTime] of [
      ['ko', '나의 집중 쿠폰', '현재 시각'],
      ['en', 'My focus stamp card', 'Current time'],
      ['zh', '我的专注集章卡', '当前时间'],
    ]) {
      await i18n.changeLanguage(lang)
      const html = renderToStaticMarkup(
        createElement(Coffee, {
          coffees: 12,
          remainderMs: 120000,
          error: '',
          notice: '',
          available: true,
        }),
      )
      assert.ok(html.includes(title), lang)
      assert.equal((html.match(/data-filled="true"/g) ?? []).length, 2)
      assert.ok(!html.includes('{{'), 'all interpolation values resolved')
      const caption = renderToStaticMarkup(createElement(Caption, { name: 'Rain Room' }))
      assert.ok(caption.includes(currentTime), lang)
      if (lang !== 'ko') assert.ok(!/[가-힣]/.test(html + caption), lang)
    }
    await i18n.changeLanguage('en')
    assert.equal(i18n.t('extras:coffee.earned', { count: 1 }), 'You earned 1 cup of coffee.')
    assert.equal(i18n.t('extras:coffee.earned', { count: 2 }), 'You earned 2 cups of coffee.')
  } finally {
    await server.close()
  }
})
