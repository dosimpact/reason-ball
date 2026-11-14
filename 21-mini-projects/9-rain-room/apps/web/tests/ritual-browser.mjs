// Real browser engines only: one browser/context/page, serial flow, always disposed.
// A launch failure is recorded as blocked; it never produces mock GPU screenshots.
import { chromium, webkit, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const workspace = fileURLToPath(new URL('../../../', import.meta.url))
const output =
  process.env.RITUAL_BROWSER_OUTPUT ||
  path.join(workspace, 'artifacts/ritual-browser', new Date().toISOString().replaceAll(':', '-'))
await mkdir(output, { recursive: true })
const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  engine: process.env.RITUAL_BROWSER_ENGINE || 'chromium',
  baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:3000',
  screenshots: [],
  errors: [],
  cleanup: false,
}
let browser
let context
let page
let reachedPage = false
async function capture(name) {
  const filename = `${name}.png`
  await page.screenshot({
    path: path.join(output, filename),
    fullPage: false,
    animations: 'allow',
  })
  report.screenshots.push(filename)
}
const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 667, height: 375 },
  { width: 834, height: 1112 },
  { width: 1112, height: 834 },
  { width: 1280, height: 900 },
]
const languages = ['ko', 'en', 'zh']
report.cases = []
report.printFrames = []
async function assertFits(label) {
  const metrics = await page.evaluate(() => {
    const selectors = [
      'html',
      'body',
      '#root',
      '.ritual-experience',
      '.ritual-screen',
      '.ritual-menu',
      '.ritual-receipt',
      '.ritual-room-player',
      '.ritual-room-player-top',
      '.ritual-room-transport',
    ]
    return selectors.flatMap((selector) => {
      const el = document.querySelector(selector)
      if (!el || !el.getClientRects().length) return []
      return [
        {
          selector,
          width: el.clientWidth,
          scrollWidth: el.scrollWidth,
          height: el.clientHeight,
          scrollHeight: el.scrollHeight,
        },
      ]
    })
  })
  for (const metric of metrics) {
    expect(
      metric.scrollWidth,
      `${label}: ${metric.selector} horizontal overflow`,
    ).toBeLessThanOrEqual(metric.width + 1)
    expect(
      metric.scrollHeight,
      `${label}: ${metric.selector} vertical overflow`,
    ).toBeLessThanOrEqual(metric.height + 1)
  }
  report.cases.at(-1).fits.push({ label, metrics })
}
async function assertSceneFraming(room, label) {
  const scene = room.getByTestId('cafe-scene')
  await expect(scene).toHaveAttribute('data-render-status', 'ready', { timeout: 60000 })
  await expect(scene).toHaveAttribute('data-scene-fit', 'world')
  await expect(scene).toHaveAttribute('data-frame-scale', /.+/)
  const metrics = await scene.evaluate((element) => {
    const host = element.querySelector('.pixi-canvas-host').getBoundingClientRect()
    const frame = Object.fromEntries(
      ['x', 'y', 'width', 'height', 'scale'].map((key) => [
        key,
        Number(element.getAttribute(`data-frame-${key}`)),
      ]),
    )
    const world = Object.fromEntries(
      ['x', 'y', 'width', 'height'].map((key) => [
        key,
        Number(element.getAttribute(`data-world-${key}`)),
      ]),
    )
    return {
      host: { width: host.width, height: host.height },
      frame,
      world,
      ambienceCount: element.querySelectorAll('.pixi-ambience').length,
    }
  })
  report.cases.at(-1).framing ??= []
  report.cases.at(-1).framing.push({ label, ...metrics })
  const { frame: f, host } = metrics
  const diagnostic = `${label}: ${JSON.stringify(metrics)}`
  expect(Object.values(f).every(Number.isFinite), diagnostic).toBe(true)
  for (const key of ['scale', 'width', 'height']) expect(f[key], diagnostic).toBeGreaterThan(0)
  expect(f.x, diagnostic).toBeGreaterThanOrEqual(-1)
  expect(f.y, diagnostic).toBeGreaterThanOrEqual(-1)
  expect(f.x + f.width, diagnostic).toBeLessThanOrEqual(host.width + 1)
  expect(f.y + f.height, diagnostic).toBeLessThanOrEqual(host.height + 1)
  expect(Math.abs(2 * f.x + f.width - host.width), diagnostic).toBeLessThanOrEqual(1)
  expect(Math.abs(2 * f.y + f.height - host.height), diagnostic).toBeLessThanOrEqual(1)
  expect(f.width / f.height, diagnostic).toBeCloseTo(800 / 820, 5)
  expect(f.width / 800, diagnostic).toBeCloseTo(f.scale, 5)
  expect(f.height / 820, diagnostic).toBeCloseTo(f.scale, 5)
  expect(
    Math.min(Math.abs(f.width - host.width), Math.abs(f.height - host.height)),
    diagnostic,
  ).toBeLessThanOrEqual(1)
  const world = metrics.world
  expect(Object.values(world).every(Number.isFinite), diagnostic).toBe(true)
  expect(world.x, diagnostic).toBeLessThanOrEqual(1)
  expect(world.y, diagnostic).toBeLessThanOrEqual(1)
  expect(world.x + world.width, diagnostic).toBeGreaterThanOrEqual(host.width - 1)
  expect(world.y + world.height, diagnostic).toBeGreaterThanOrEqual(host.height - 1)
  expect(world.width, diagnostic).toBeCloseTo(2600 * f.scale, 4)
  expect(world.height, diagnostic).toBeCloseTo(2340 * f.scale, 4)
  expect(world.x, diagnostic).toBeCloseTo(f.x - 900 * f.scale, 4)
  expect(world.y, diagnostic).toBeCloseTo(f.y - 760 * f.scale, 4)
  expect(metrics.ambienceCount, diagnostic).toBe(0)
}
async function assertPlayerDesign(room, label) {
  const player = room.locator('.ritual-room-player')
  const toggle = player.getByTestId('room-music-toggle')
  await expect(toggle).toBeEnabled()
  const snapshot = async () =>
    player.evaluate((element) => {
      const timer = element.querySelector('[role="timer"]')
      const track = element.querySelector('.ritual-room-track strong')
      const play = element.querySelector('.ritual-room-music-toggle')
      return {
        player: element.getBoundingClientRect().toJSON(),
        timer: timer.getBoundingClientRect().toJSON(),
        track: track.getBoundingClientRect().toJSON(),
        radius: getComputedStyle(element).borderRadius,
        glass: getComputedStyle(element).backgroundColor,
        timerFont: parseFloat(getComputedStyle(timer).fontSize),
        trackFont: parseFloat(getComputedStyle(track).fontSize),
        phaseColor: getComputedStyle(element.querySelector('.ritual-room-phase')).color,
        captionColor: getComputedStyle(element.querySelector('.ritual-room-track > span')).color,
        playBackground: getComputedStyle(play).backgroundColor,
        playLabel: play.getAttribute('aria-label'),
        controls: [...element.querySelectorAll('button')].map((button) => ({
          label: button.getAttribute('aria-label'),
          width: button.getBoundingClientRect().width,
          height: button.getBoundingClientRect().height,
        })),
      }
    })
  const first = await snapshot()
  const diagnostic = `${label}: ${JSON.stringify(first)}`
  expect(
    Math.abs(first.timer.x + first.timer.width / 2 - first.player.x - first.player.width / 2),
    diagnostic,
  ).toBeLessThanOrEqual(1.5)
  expect(first.timer.bottom, diagnostic).toBeLessThanOrEqual(first.track.top + 1)
  expect(first.timerFont, diagnostic).toBeGreaterThan(first.trackFont * 2)
  expect(first.radius, diagnostic).toBe('24px')
  expect(first.playBackground, diagnostic).toBe('rgb(57, 213, 172)')
  expect(first.phaseColor, diagnostic).toBe('rgb(212, 212, 212)')
  expect(first.captionColor, diagnostic).toBe('rgb(212, 212, 212)')
  expect(first.glass, diagnostic).toBe('rgba(0, 0, 0, 0.4)')
  for (const control of first.controls) {
    expect(control.width, diagnostic).toBeGreaterThanOrEqual(44)
    expect(control.height, diagnostic).toBeGreaterThanOrEqual(44)
  }
  await toggle.click()
  // A browser may reject audio playback: record the observed state rather than invent a second one.
  await page.waitForTimeout(150)
  const second = await snapshot()
  expect(second.playBackground, `${label}: music action remains mint after activation`).toBe(
    'rgb(57, 213, 172)',
  )
  const changed = first.playLabel !== second.playLabel
  report.cases.at(-1).designSystem ??= []
  report.cases.at(-1).designSystem.push({ label, first, second, bothStatesObserved: changed })
  if (changed) await toggle.click()
}
async function assertVisibleInViewport(locator) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  const viewport = await page.evaluate(() => ({
    left: visualViewport?.offsetLeft || 0,
    top: visualViewport?.offsetTop || 0,
    width: visualViewport?.width || innerWidth,
    height: visualViewport?.height || innerHeight,
  }))
  expect(box.x).toBeGreaterThanOrEqual(viewport.left - 1)
  expect(box.y).toBeGreaterThanOrEqual(viewport.top - 1)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.left + viewport.width + 1)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.top + viewport.height + 1)
}
async function assertTouchControls(selector) {
  for (const control of await page.locator(selector).all()) {
    await assertVisibleInViewport(control)
    const box = await control.boundingBox()
    expect(box.width, 'touch target width').toBeGreaterThanOrEqual(44)
    expect(box.height, 'touch target height').toBeGreaterThanOrEqual(44)
    const clippedBy = await control.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent)
        const boundary = parent.getBoundingClientRect()
        const clipsX = /hidden|clip|scroll|auto/.test(style.overflowX)
        const clipsY = /hidden|clip|scroll|auto/.test(style.overflowY)
        if (
          (clipsX && (rect.left < boundary.left - 1 || rect.right > boundary.right + 1)) ||
          (clipsY && (rect.top < boundary.top - 1 || rect.bottom > boundary.bottom + 1))
        )
          return parent.className || parent.tagName
      }
      return null
    })
    expect(clippedBy, 'critical control clipped by overflow ancestor').toBeNull()
  }
}
async function assertStablePos(reference, label) {
  const current = await page.locator('.ritual-pos').boundingBox()
  for (const key of ['x', 'y', 'width', 'height'])
    expect(Math.abs(current[key] - reference[key]), `${label}: POS ${key}`).toBeLessThanOrEqual(1)
  report.cases.at(-1).pos.push({ label, box: current })
}
async function assertDrinkGrid() {
  const menu = page.locator('.ritual-menu')
  expect(
    await menu.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
    'four drink columns at every viewport',
  ).toBe(4)
  for (const drink of await page.locator('.ritual-menu-item').all()) {
    expect(await drink.innerText(), 'menu has only a drink image').toBe('')
    await expect(drink).toHaveAccessibleName(/\S/)
    const artwork = drink.locator('.ritual-drink-artwork svg.ritual-drink-vector')
    await expect(artwork).toHaveCount(1)
    await expect(artwork).toBeVisible()
    await expect(drink.locator('img, image')).toHaveCount(0)
    expect(
      await artwork.evaluate((svg) => {
        const bounds = svg.getBBox()
        return bounds.width > 0 && bounds.height > 0
      }),
      'inline drink illustration has visible vector geometry',
    ).toBe(true)
  }
}
try {
  if (!['chromium', 'webkit'].includes(report.engine))
    throw new Error('Unsupported RITUAL_BROWSER_ENGINE')
  browser = await { chromium, webkit }[report.engine].launch({ headless: true, timeout: 20000 })
  context = await browser.newContext({
    viewport: viewports[0],
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
    locale: 'ko-KR',
    recordVideo: { dir: path.join(output, 'video'), size: { width: 1280, height: 900 } },
  })
  page = await context.newPage()
  reachedPage = true
  page.on('pageerror', (error) => report.errors.push(error.message))
  const stage = (name) => page.locator(`[data-ritual-stage="${name}"]`)
  for (const language of languages) {
    const { readFile } = await import('node:fs/promises')
    const text = JSON.parse(
      await readFile(
        new URL(`../src/shared/i18n/locales/${language}/ritual.json`, import.meta.url),
        'utf8',
      ),
    )
    const common = JSON.parse(
      await readFile(
        new URL(`../src/shared/i18n/locales/${language}/common.json`, import.meta.url),
        'utf8',
      ),
    )
    for (const viewport of viewports) {
      const caseId = `${language}-${viewport.width}x${viewport.height}`
      report.cases.push({ id: caseId, fits: [], pos: [], drinks: [] })
      await page.setViewportSize(viewport)
      await page.goto(report.baseURL, { waitUntil: 'networkidle', timeout: 30000 })
      await page.evaluate((lang) => {
        localStorage.clear()
        localStorage.setItem('rain-room.language', lang)
      }, language)
      await page.reload({ waitUntil: 'networkidle' })
      await expect(stage('menu')).toBeVisible()
      const pageSize = viewport.height <= 480 && viewport.width > viewport.height ? 8 : 12
      await expect(page.locator('.ritual-menu-item')).toHaveCount(Math.min(pageSize, 10))
      await assertFits(`${caseId}-menu-1`)
      await assertTouchControls('.ritual-menu-item, .ritual-menu-page button, .ritual-primary')
      await assertDrinkGrid()
      const baseline = await page.locator('.ritual-pos').boundingBox()
      const readDrinks = async () =>
        page
          .locator('.ritual-menu-item')
          .evaluateAll((els) => els.map((el) => el.dataset.drinkId || el.textContent.trim()))
      const allDrinks = await readDrinks()
      let menuPage = 1
      while (
        (await page.locator('.ritual-menu-next').count()) &&
        (await page.locator('.ritual-menu-next').isEnabled())
      ) {
        await assertVisibleInViewport(page.locator('.ritual-menu-next'))
        await page.locator('.ritual-menu-next').click()
        const remaining = Math.min(pageSize, 10 - menuPage * pageSize)
        await expect(page.locator('.ritual-menu-item')).toHaveCount(remaining)
        menuPage += 1
        await assertFits(`${caseId}-menu-${menuPage}`)
        await assertTouchControls('.ritual-menu-item, .ritual-menu-page button, .ritual-primary')
        await assertDrinkGrid()
        await assertStablePos(baseline, `${caseId}-page-${menuPage}`)
        allDrinks.push(...(await readDrinks()))
      }
      expect(new Set(allDrinks).size).toBe(10)
      report.cases.at(-1).drinks = allDrinks
      await capture(`${caseId}-01-menu-final-page`)
      await page.locator('.ritual-menu-item').first().click()
      await page
        .getByRole('button', { name: text.mobile?.checkout || text.checkout, exact: true })
        .click()
      await expect(stage('checkout')).toBeVisible()
      await assertFits(`${caseId}-checkout`)
      await assertStablePos(baseline, `${caseId}-checkout`)
      await assertVisibleInViewport(page.locator('.ritual-checkout .ritual-primary'))
      await capture(`${caseId}-02-checkout`)
      await page.getByRole('button', { name: text.order, exact: true }).click()
      await expect(stage('printing')).toBeVisible()
      const printStarted = Date.now()
      const finalPaper = await page
        .locator('.ritual-receipt-print-target')
        .evaluate((element) => element.getBoundingClientRect().toJSON())
      let previousPaperTop = viewport.height + 1
      let previousVisibleHeight = 0
      for (const atMs of [600, 1400, 2300]) {
        await page.waitForTimeout(Math.max(0, atMs - (Date.now() - printStarted)))
        await assertFits(`${caseId}-printing-${atMs}`)
        await assertStablePos(baseline, `${caseId}-printing-${atMs}`)
        const frame = await page.locator('.receipt-paper-band[data-band]').evaluateAll((els) =>
          els.map((el) => ({
            segment: el.getAttribute('data-band'),
            transform: getComputedStyle(el).transform,
            origin: getComputedStyle(el).transformOrigin,
            visible: getComputedStyle(el).visibility !== 'hidden',
            box: el.getBoundingClientRect().toJSON(),
          })),
        )
        expect(frame.length, 'actual segmented paper').toBeGreaterThanOrEqual(3)
        expect(
          frame.some((part) => part.transform.startsWith('matrix3d(')),
          'actual 3D paper transform',
        ).toBe(true)
        expect(
          new Set(frame.map((part) => part.transform)).size,
          'distinct curled segment transforms',
        ).toBeGreaterThan(1)
        const visibleBands = frame.filter(
          ({ box, visible }) =>
            visible &&
            box.right > 0 &&
            box.left < viewport.width &&
            box.bottom > 0 &&
            box.top < viewport.height,
        )
        const visibleTop = Math.min(...visibleBands.map(({ box }) => Math.max(0, box.top)))
        const visibleBottom = Math.max(
          ...visibleBands.map(({ box }) => Math.min(viewport.height, box.bottom)),
        )
        expect(visibleBands.length, 'paper actually enters the viewport').toBeGreaterThan(0)
        expect(visibleTop, 'paper rises from bottom toward its final position').toBeLessThanOrEqual(
          previousPaperTop + 1,
        )
        const visibleHeight = visibleBottom - visibleTop
        expect(visibleHeight, 'progressively more paper is revealed').toBeGreaterThanOrEqual(
          previousVisibleHeight - 1,
        )
        if (atMs === 600)
          expect(
            visibleTop,
            'first printing portion starts near the screen bottom',
          ).toBeGreaterThan(viewport.height / 2)
        previousPaperTop = visibleTop
        previousVisibleHeight = visibleHeight
        if (atMs >= 1400)
          expect(
            visibleBottom - visibleTop,
            'printed paper has a meaningful visible surface, not a clipped sliver',
          ).toBeGreaterThanOrEqual(atMs >= 2300 ? 48 : 32)
        report.printFrames.push({
          caseId,
          requestedAtMs: atMs,
          actualAtMs: Date.now() - printStarted,
          printer: await page.locator('.receipt-printer').evaluate((el) => ({
            phase: el.dataset.phase,
            progress: el.dataset.progress,
            box: el.getBoundingClientRect().toJSON(),
            perspective: getComputedStyle(el).perspective,
          })),
          segments: frame,
        })
        await capture(`${caseId}-03-print-${atMs}`)
      }
      await expect(stage('receipt')).toBeVisible({ timeout: 10000 })
      const readyPaper = await page.locator('.ritual-receipt').boundingBox()
      for (const key of ['x', 'y', 'width', 'height'])
        expect(
          Math.abs(readyPaper[key] - finalPaper[key]),
          `receipt handoff ${key}`,
        ).toBeLessThanOrEqual(1)
      await assertFits(`${caseId}-receipt`)
      await assertVisibleInViewport(page.locator('.ritual-seat-button'))
      for (const button of await page.locator('.ritual-time-presets button').all()) {
        await assertVisibleInViewport(button)
        const bounds = await button.boundingBox()
        expect(bounds.height, 'quick preset touch height').toBeGreaterThanOrEqual(44)
      }
      const customEditor = page.locator('.ritual-custom-time-open')
      if (await customEditor.count()) {
        await assertVisibleInViewport(customEditor)
        await customEditor.click()
        await expect(page.locator('.ritual-custom-time-dialog')).toBeVisible()
      }
      for (const name of [text.focusCustom, text.restCustom]) {
        const input = page.getByRole('spinbutton', { name, exact: true })
        await assertVisibleInViewport(input)
        const inputBox = await input.boundingBox()
        expect(inputBox.height, 'custom time input height').toBeGreaterThanOrEqual(48)
        await input.fill('0')
        await expect(input).toHaveAttribute('aria-invalid', 'true')
        await input.press('Tab')
        await expect(input).not.toHaveValue('0')
        await input.fill('20')
        await input.press('Tab')
        await expect(input).toHaveValue('20')
      }
      if (await customEditor.count()) {
        await page.keyboard.press('Escape')
        await expect(page.locator('.ritual-custom-time-dialog')).toHaveCount(0)
      }
      await assertFits(`${caseId}-receipt-edited`)
      await capture(`${caseId}-04-receipt`)
      if (!(language === 'ko' && viewport.width === 390)) {
        await page.locator('.ritual-seat-button').click()
        const framingRoom = page.getByTestId('immersive-room')
        await expect(framingRoom).toBeVisible({ timeout: 30000 })
        await assertSceneFraming(framingRoom, `${caseId}-initial`)
        await assertPlayerDesign(framingRoom, `${caseId}-player-design`)
      }
      if (language === 'ko' && viewport.width === 390) {
        await page.locator('.ritual-seat-button').click()
        const room = page.getByTestId('immersive-room')
        await expect(room).toBeVisible({ timeout: 30000 })
        await expect(room.getByTestId('cafe-scene')).toHaveAttribute('data-renderer', 'pixi')
        await expect(room.getByTestId('cafe-scene')).toHaveAttribute(
          'data-render-status',
          'ready',
          { timeout: 60000 },
        )
        await assertSceneFraming(room, `${caseId}-ready`)
        await assertPlayerDesign(room, `${caseId}-player-design`)
        await expect(room.locator('canvas')).toHaveCount(1)
        await expect(page.locator('.ritual-seating')).toHaveCount(0, { timeout: 10000 })
        await expect(
          room.locator('.fullscreen-volume, .ritual-room-player input[type="range"]'),
        ).toHaveCount(0)
        await expect(room.locator('.ritual-room-timer-action')).toHaveCount(0)
        const cycle = room.locator('.playback-mode-cycle')
        await expect(room.locator('.playback-mode')).toHaveCount(1)
        await expect(cycle).not.toHaveAttribute('aria-pressed')
        const modes = ['repeat-one', 'shuffle', 'sequential']
        const originalMode = await cycle.getAttribute('data-mode')
        for (let i = 0; i < modes.length; i++) {
          const current = await cycle.getAttribute('data-mode')
          const next = modes[(modes.indexOf(current) + 1) % modes.length]
          await cycle.click()
          await expect(cycle).toHaveAttribute('data-mode', next)
        }
        await expect(cycle).toHaveAttribute('data-mode', originalMode)
        await assertFits(`${caseId}-room-player`)
        await assertTouchControls('.ritual-room-player button')
        await room.click({ position: { x: 180, y: 140 } })
        await assertVisibleInViewport(room.locator('.ritual-room-settings'))
        const viewportBounds = await page.evaluate(() => ({
          left: visualViewport?.offsetLeft || 0,
          top: visualViewport?.offsetTop || 0,
          width: visualViewport?.width || innerWidth,
          height: visualViewport?.height || innerHeight,
        }))
        const roomBounds = await room.boundingBox()
        expect(Math.abs(roomBounds.width - viewportBounds.width)).toBeLessThanOrEqual(1)
        expect(Math.abs(roomBounds.height - viewportBounds.height)).toBeLessThanOrEqual(1)
        const playerBounds = await room.locator('.ritual-room-player').boundingBox()
        expect(
          viewportBounds.top + viewportBounds.height - playerBounds.y - playerBounds.height,
        ).toBeGreaterThanOrEqual(12)
        await room.locator('.ritual-room-close').click()
        await assertVisibleInViewport(room.locator('.ritual-room-restore'))
        const restoreBounds = await room.locator('.ritual-room-restore').boundingBox()
        expect(
          viewportBounds.top + viewportBounds.height - restoreBounds.y - restoreBounds.height,
        ).toBeGreaterThanOrEqual(12)
        await room.locator('.ritual-room-restore').click()
        await expect(room.locator('.ritual-room-player')).toBeVisible()
        await capture(`${caseId}-05-room`)
        const beforeChange = await page.evaluate(() =>
          JSON.parse(localStorage.getItem('rain-room.v1')),
        )
        await room.click({ position: { x: 180, y: 140 } })
        await page.getByRole('button', { name: text.room.randomBackground, exact: true }).click()
        const fade = room.locator('.ritual-scene-transition')
        await expect(fade).toHaveAttribute('data-phase', 'fading-out')
        await capture(`${caseId}-05a-random-darkening`)
        await expect(fade).toHaveAttribute('data-phase', 'fading-in', { timeout: 60000 })
        await capture(`${caseId}-05b-random-brightening`)
        await expect(fade).toHaveAttribute('data-phase', 'idle', { timeout: 10000 })
        await assertSceneFraming(room, `${caseId}-ready`)
        await assertPlayerDesign(room, `${caseId}-player-design`)
        await expect(room.locator('canvas')).toHaveCount(1)
        await expect(room.getByTestId('cafe-scene')).toHaveAttribute('data-render-status', 'ready')
        const afterChange = await page.evaluate(() =>
          JSON.parse(localStorage.getItem('rain-room.v1')),
        )
        expect(afterChange.settings.background).not.toBe(beforeChange.settings.background)
        expect(afterChange.session.deadline).toBe(beforeChange.session.deadline)
        await capture(`${caseId}-05c-random-ready`)
        await room.click({ position: { x: 180, y: 140 } })
        await page.getByRole('button', { name: text.room.settings, exact: true }).click()
        const quickActions = room.locator('.header-settings-panel')
        await expect(quickActions).toBeVisible()
        await expect(quickActions.getByRole('button')).toHaveCount(7)
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await capture(`${caseId}-06-settings-actions`)
        await quickActions
          .getByRole('button', { name: common.header.actions.time.label, exact: true })
          .click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await capture(`${caseId}-07-time-settings`)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
      // A refresh must always return to the counter, even after a printed order.
      await page.reload({ waitUntil: 'networkidle' })
      await expect(stage('menu')).toBeVisible()
    }
  }
  if (report.errors.length) throw new Error(report.errors.join('\n'))
  report.status = 'passed'
} catch (error) {
  report.status = reachedPage ? 'failed' : 'blocked-before-page'
  report.errors.push(error?.stack || String(error))
  process.exitCode = 1
} finally {
  try {
    await page?.close()
    if (page?.video()) report.video = path.relative(output, await page.video().path())
  } catch (error) {
    report.errors.push(`page cleanup: ${error}`)
  }
  try {
    await context?.close()
  } catch (error) {
    report.errors.push(`context cleanup: ${error}`)
  }
  try {
    await browser?.close()
  } catch (error) {
    report.errors.push(`browser cleanup: ${error}`)
  }
  report.cleanup = !browser || !browser.isConnected()
  report.finishedAt = new Date().toISOString()
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  process.stdout.write(`${report.status}: ${output}\n`)
}
