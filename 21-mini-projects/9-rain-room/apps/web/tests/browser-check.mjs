import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { BACKGROUNDS, BACKGROUND_CATEGORIES } from '../src/pages/focus/model/backgrounds.ts'
import { AMBIENT_SOUNDS } from '../src/pages/focus/model/ambient.ts'
import { MUSIC_TRACKS } from '../src/pages/focus/model/music.ts'

const runId = new Date().toISOString().replaceAll(':', '-')
const output = `../../artifacts/design-verification/${runId}`
await mkdir(output, { recursive: true })
let browser
let page
const evidence = {
  startedAt: new Date().toISOString(),
  status: 'running',
  browser: null,
  screenshots: [],
  errors: [],
}
const errors = []
const capture = async (name) => {
  const filename = `${name}.png`
  await page.screenshot({ path: `${output}/${filename}`, fullPage: true })
  evidence.screenshots.push({
    filename,
    viewport: page.viewportSize(),
    capturedAt: new Date().toISOString(),
    url: page.url(),
  })
}
try {
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? {} : { channel: 'chrome' }),
    headless: true,
  })
  evidence.browser = browser.version()
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  await context.addInitScript(() => {
    window.testAudio = []
    const OriginalAudio = window.Audio
    window.Audio = class extends OriginalAudio {
      constructor(...args) {
        super(...args)
        window.testAudio.push(this)
      }
    }
    window.testContexts = []
    const OriginalContext = window.AudioContext
    window.AudioContext = class extends OriginalContext {
      testKind = 'unknown'
      cueOscillators = 0
      constructor(...args) {
        super(...args)
        window.testContexts.push(this)
      }
      createDynamicsCompressor() {
        this.testKind = 'ambient'
        return super.createDynamicsCompressor()
      }
      createOscillator() {
        this.testKind = 'completion'
        this.cueOscillators++
        return super.createOscillator()
      }
    }
  })
  page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'
  await page.goto(base)
  await expect(page.getByRole('timer')).toHaveText('35:00')
  await expect(page.getByRole('button', { name: '집중 시작하기', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await capture('01-mobile-idle')

  // The player belongs to the document flow and releases the bottom edge above the mixer.
  const stickyPlayer = page.locator('.now-playing')
  await expect(stickyPlayer).toHaveCSS('position', 'sticky')
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(page.locator('.ambient-summary')).toBeInViewport()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const player = document.querySelector('.now-playing').getBoundingClientRect()
        const ambient = document.querySelector('.ambient-summary').getBoundingClientRect()
        return player.bottom < innerHeight - 20 && ambient.top >= player.bottom
      }),
    )
    .toBe(true)
  await capture('01b-mobile-sticky-mixer-revealed')
  await page.evaluate(() => window.scrollTo(0, 0))

  // App viewport mode on every platform, exact idle delay, reveal and keyboard exit.
  await page.evaluate(() => {
    window.nativeFullscreenCalls = 0
    window.nativeFullscreenExits = 0
    HTMLElement.prototype.requestFullscreen = () => {
      window.nativeFullscreenCalls++
      return Promise.reject(new Error('Native fullscreen must not be requested'))
    }
    document.exitFullscreen = () => {
      window.nativeFullscreenExits++
      return Promise.resolve()
    }
  })
  await page.clock.install()
  await page.clock.pauseAt(new Date())
  await page.getByRole('button', { name: '배경 전체화면', exact: true }).click()
  const fullscreen = page.getByTestId('scene-fullscreen')
  const chrome = page.getByTestId('fullscreen-controls')
  await expect(fullscreen).toBeVisible()
  expect(await page.evaluate(() => window.nativeFullscreenCalls)).toBe(0)
  expect(await page.evaluate(() => document.fullscreenElement)).toBe(null)
  await expect(page.getByTestId('cafe-scene')).toHaveCount(1)
  await expect(chrome).toHaveAttribute('data-visible', 'true')
  expect(
    await fullscreen.evaluate(
      (el) => Math.abs(el.getBoundingClientRect().height - innerHeight) < 2,
    ),
  ).toBe(true)
  await capture('fullscreen-mobile-controls')
  await page.clock.fastForward(2499)
  await expect(chrome).toHaveAttribute('data-visible', 'true')
  await page.clock.fastForward(1)
  await expect(chrome).toHaveAttribute('data-visible', 'false')
  await expect(chrome).toHaveAttribute('inert', '')
  await capture('fullscreen-mobile-hidden')
  await fullscreen.click({ position: { x: 100, y: 180 } })
  await expect(chrome).toHaveAttribute('data-visible', 'true')
  expect(await page.evaluate(() => window.testAudio.filter((a) => !a.paused).length)).toBe(0)
  await fullscreen.getByRole('slider', { name: '전체화면 음악 볼륨' }).fill('0.4')
  await page.clock.fastForward(2500)
  await expect(chrome).toHaveAttribute('data-visible', 'false')
  await page.keyboard.press('Tab')
  await expect(fullscreen.getByRole('button', { name: '전체화면 나가기' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(fullscreen).toHaveCount(0)
  expect(await page.evaluate(() => window.nativeFullscreenExits)).toBe(0)
  await expect(page.getByRole('button', { name: '배경 전체화면', exact: true })).toBeFocused()
  await expect(page.getByRole('timer')).toHaveText('35:00')
  await page.clock.uninstall()
  await page.reload()

  await page.getByRole('button', { name: '집중 시작하기', exact: true }).click()
  await expect(page.getByRole('button', { name: '잠시 멈추기', exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => window.testAudio.filter((a) => !a.paused && a.currentTime > 0).length),
    )
    .toBe(1)
  expect(await page.evaluate(() => window.testAudio.find((a) => !a.paused)?.loop)).toBe(true)
  await capture('02-mobile-running')
  await page.getByRole('button', { name: '잠시 멈추기', exact: true }).click()
  const paused = await page.getByRole('timer').textContent()
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText(paused)
  await expect(page.getByRole('button', { name: '이어서 집중하기', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.testAudio.filter((a) => !a.paused).length)).toBe(0)
  await capture('03-mobile-paused-restored')

  // Every selection immediately closes the picker and exposes its chosen scene.
  for (const category of BACKGROUND_CATEGORIES) {
    const scenes = BACKGROUNDS.filter((item) => item.category === category.id)
    for (const scene of scenes) {
      await page.getByRole('button', { name: '공간 바꾸기', exact: true }).click()
      const picker = page.getByRole('dialog')
      await picker.getByRole('button', { name: category.name, exact: true }).click()
      await expect(picker.getByRole('button', { name: / 선택$/ })).toHaveCount(scenes.length)
      await expect(picker.locator('.background-preview svg')).toHaveCount(0)
      await expect(picker.locator('.background-preview img[loading=lazy]')).toHaveCount(
        scenes.length,
      )
      await picker.getByRole('button', { name: `${scene.name} 선택`, exact: true }).click()
      await expect(picker).not.toBeVisible()
      await expect(page.getByTestId('cafe-scene')).toHaveAttribute('aria-label', scene.description)
      await expect(
        page.getByTestId('cafe-scene').locator('.scene-foreground > .cafe > svg'),
      ).toHaveCount(1)
      await expect(
        page.getByTestId('cafe-scene').locator('.scene-foreground [data-scene-layer=rear]'),
      ).toHaveCount(0)
      const artwork = page.getByTestId('cafe-scene').locator('img.scene-artwork')
      await expect(artwork).toHaveAttribute('src', `/backgrounds/rear/normal/${scene.id}.png`)
      await expect
        .poll(() => artwork.evaluate((image) => image.complete && image.naturalWidth === 800))
        .toBe(true)
      await expect(page.getByRole('timer')).toHaveText(paused)
    }
    await capture(`background-main-${category.id}`)
  }
  await page.reload()
  await expect(page.getByTestId('cafe-scene')).toHaveAttribute(
    'aria-label',
    BACKGROUNDS.at(-1).description,
  )
  await expect(page.getByRole('timer')).toHaveText(paused)

  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByRole('button', { name: '시간 설정', exact: true }).click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  await capture('04-mobile-time-settings')
  await page.getByRole('spinbutton', { name: '집중 시간 직접 입력' }).fill('0')
  await page.getByRole('button', { name: '시간 저장하기' }).click()
  await expect(modal).toBeVisible()
  await page.getByRole('spinbutton', { name: '집중 시간 직접 입력' }).fill('1')
  await page.getByRole('spinbutton', { name: '휴식 시간 직접 입력' }).fill('1')
  await page.getByRole('button', { name: '시간 저장하기' }).click()
  await expect(modal).not.toBeVisible()
  await expect(page.getByRole('timer')).toHaveText('01:00')
  await expect(page.getByRole('button', { name: '이어서 집중하기', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('01:00')
  await page.getByRole('button', { name: '현재 타이머 초기화' }).click()
  await expect(page.getByRole('timer')).toHaveText('01:00')
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByRole('button', { name: '음악 선택', exact: true }).click()
  const shuffleButton = modal.getByRole('button', { name: '플레이리스트 재생', exact: true })
  await expect(modal.getByRole('tablist')).toHaveCount(0)
  await expect(modal.getByRole('searchbox')).toHaveCount(0)
  const preferred = MUSIC_TRACKS[2]
  const draftTrack = modal.locator(`li[data-track-id="${preferred.id}"] button`)
  const titleBeforeDraft = await page.locator('.track-info strong').textContent()
  await draftTrack.click()
  await expect(draftTrack).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.track-info strong')).toHaveText(titleBeforeDraft)
  await shuffleButton.click()
  const queuePanel = modal.getByTestId('music-playlist')
  await expect(queuePanel.locator('li[aria-current="true"]')).toHaveAttribute(
    'data-track-id',
    preferred.id,
  )
  await expect(queuePanel.locator('li[data-track-id]')).toHaveCount(MUSIC_TRACKS.length)
  const musicFooter = modal.locator('.music-settings-footer')
  expect(await musicFooter.evaluate((el) => getComputedStyle(el).position)).toBe('sticky')
  await modal.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await expect(shuffleButton).toBeInViewport()
  expect(
    await musicFooter.evaluate((el) => {
      const footer = el.getBoundingClientRect()
      const dialog = el.closest('.settings-dialog').getBoundingClientRect()
      return footer.top >= dialog.top && footer.bottom <= dialog.bottom
    }),
  ).toBe(true)
  await modal.evaluate((el) => {
    el.scrollTop = 0
  })

  const queueOrder = await queuePanel
    .locator('li[data-track-id]')
    .evaluateAll((rows) => rows.map((row) => row.dataset.trackId))
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.testAudio.some((a) => !a.paused && Number.isFinite(a.duration) && a.duration > 0),
      ),
    )
    .toBe(true)
  await page.evaluate(() => {
    const a = window.testAudio.find((a) => !a.paused)
    a.currentTime = a.duration - 0.05
  })
  await expect(queuePanel.locator('[aria-current="true"]')).toHaveAttribute(
    'data-track-id',
    queueOrder[1],
  )
  const queueViewport = queuePanel.getByRole('region', { name: '플레이리스트 곡 목록' })
  expect(
    await queueViewport.evaluate(
      (el) => el.clientHeight <= 333 && el.scrollHeight > el.clientHeight,
    ),
  ).toBe(true)
  await modal
    .getByRole('group', { name: '음악 카테고리' })
    .getByRole('button', { name: '포근한 쉼', exact: true })
    .click()
  await expect(queuePanel).toHaveAttribute('data-order', 'catalog')
  await expect(queuePanel.locator('li[data-track-id]')).toHaveCount(
    MUSIC_TRACKS.filter((track) => track.categoryId === 'cozy-rest').length,
  )
  await shuffleButton.click()
  await expect(queuePanel.locator('li[data-track-id]')).toHaveCount(
    MUSIC_TRACKS.filter((track) => track.categoryId === 'cozy-rest').length,
  )
  await capture('category-shuffle')
  await modal.getByRole('slider', { name: '음악 볼륨', exact: true }).fill('0.4')
  await page.keyboard.press('Escape')
  const sequentialButton = page
    .getByRole('group', { name: '메인 재생 방식' })
    .getByRole('button', { name: '순차 재생', exact: true })
  await sequentialButton.hover()
  await expect(page.locator('.playback-tooltip')).toContainText('순서대로')
  await sequentialButton.click()
  const previousTitle = await page.locator('.track-info strong').textContent()
  await page.getByRole('button', { name: '다음 곡', exact: true }).click()
  await expect(page.locator('.track-info strong')).not.toHaveText(previousTitle)
  await page.getByRole('button', { name: '음악 일시정지', exact: true }).click()
  await page
    .getByRole('group', { name: '메인 재생 방식' })
    .getByRole('button', { name: '한곡반복', exact: true })
    .click()
  await page.getByRole('button', { name: '다음 곡', exact: true }).click()
  expect(await page.evaluate(() => window.testAudio.filter((a) => !a.paused).length)).toBe(0)

  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByRole('button', { name: '환경음 설정', exact: true }).click()
  await expect(modal.getByRole('searchbox', { name: '음악 검색' })).toHaveCount(0)
  await expect(modal.getByRole('slider', { name: '음악 볼륨' })).toHaveCount(0)
  for (const sound of AMBIENT_SOUNDS) {
    await modal.getByRole('checkbox', { name: sound.name, exact: true }).check()
    await modal.getByRole('slider', { name: `${sound.name} 볼륨`, exact: true }).fill('0.12')
  }
  await expect(modal.getByRole('checkbox', { checked: true })).toHaveCount(AMBIENT_SOUNDS.length)
  await modal.getByRole('button', { name: '환경음 재생', exact: true }).click()
  await expect(modal.getByRole('button', { name: '환경음 일시정지', exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.testContexts.filter((c) => c.testKind === 'ambient' && c.state === 'running')
            .length,
      ),
    )
    .toBe(1)
  expect(await page.evaluate(() => window.testAudio.filter((a) => !a.paused).length)).toBe(0)
  await capture('ambient-all-selected')
  await modal.getByRole('checkbox', { name: '카페 사람들', exact: true }).uncheck()
  await expect(modal.getByRole('checkbox', { checked: true })).toHaveCount(
    AMBIENT_SOUNDS.length - 1,
  )
  await expect(modal.getByRole('button', { name: '환경음 일시정지', exact: true })).toBeVisible()
  await modal.getByRole('button', { name: '환경음 일시정지', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.testContexts.filter((c) => c.testKind === 'ambient' && c.state === 'running')
            .length,
      ),
    )
    .toBe(0)
  const persistedTitle = await page.locator('.track-info strong').textContent()
  await page.reload()
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByRole('button', { name: '음악 선택', exact: true }).click()
  const restoredTrack = modal.getByRole('button', {
    name: `${persistedTitle} · 첫 곡으로 선택`,
    exact: true,
  })
  await expect(restoredTrack).toHaveAttribute('aria-pressed', 'false')
  await expect(restoredTrack.locator('..')).toHaveAttribute('aria-current', 'true')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByRole('button', { name: '환경음 설정', exact: true }).click()
  await expect(modal.getByRole('checkbox', { checked: true })).toHaveCount(
    AMBIENT_SOUNDS.length - 1,
  )
  await expect(modal.getByRole('slider', { name: '귀뚜라미 볼륨', exact: true })).toHaveValue(
    '0.12',
  )
  await expect(modal.getByRole('button', { name: '환경음 재생', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.clock.install()
  await page.getByRole('button', { name: '집중 시작하기', exact: true }).click()
  await page.clock.fastForward(20000)
  await expect(page.getByRole('timer')).toHaveText(/00:(39|40)/)
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText(/00:(39|40)/)
  // Restored running sessions unlock their independent cue on the first real interaction.
  await page.getByRole('timer').click()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.testContexts.filter((c) => c.testKind !== 'ambient' && c.state === 'running')
            .length,
      ),
    )
    .toBe(1)
  await page.clock.fastForward(45000)
  await expect(page.getByRole('button', { name: '휴식 시작하기', exact: true })).toBeVisible()
  await expect(page.getByRole('timer')).toHaveText('00:00')
  await expect
    .poll(() =>
      page.evaluate(() => window.testContexts.reduce((sum, c) => sum + c.cueOscillators, 0)),
    )
    .toBe(4)
  await capture('06-mobile-focus-complete')
  await page.getByRole('button', { name: '휴식 시작하기', exact: true }).click()
  await page.clock.fastForward(65000)
  await expect(page.getByRole('button', { name: '다시 집중하기', exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => window.testContexts.reduce((sum, c) => sum + c.cueOscillators, 0)),
    )
    .toBe(8)
  await page.getByRole('button', { name: '다시 집중하기', exact: true }).click()
  await expect(page.getByRole('timer')).toHaveText(/00:59|01:00/)

  // Restore the default presentation in this isolated test context.
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole('timer')).toHaveText('35:00')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await capture('07-desktop-idle')
  await page.setViewportSize({ width: 320, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await capture('08-small-mobile-idle')
  await page.goto(`${base}/design-system`)
  await expect(
    page.getByRole('heading', { name: '조용하고, 명료하게.', exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await capture('09-small-mobile-design-system')
  await page.setViewportSize({ width: 1440, height: 900 })
  await capture('10-desktop-design-system')
  expect(errors).toEqual([])
  evidence.status = 'passed'
  console.log(
    'PASS: mobile/desktop layout, real audio playback/switch/volume/loop, pause and reload, input validation, settings, focus/rest transitions, no runtime errors.',
  )
  await context.close()
  // This exercises the iOS compatibility branch in Chromium, not real iOS rendering.
  const iosContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
    reducedMotion: 'reduce',
  })
  try {
    page = await iosContext.newPage()
    await page.addInitScript(() => {
      window.nativeFullscreenCalls = 0
      HTMLElement.prototype.requestFullscreen = () => {
        window.nativeFullscreenCalls++
        return Promise.reject(new Error('iOS must use viewport mode'))
      }
    })
    await page.goto(base)
    await page.getByRole('button', { name: '배경 전체화면', exact: true }).click()
    const image = page.getByTestId('cafe-scene').locator('img.scene-artwork')
    await expect(page.getByTestId('scene-fullscreen')).toHaveAttribute(
      'data-render-mode',
      'layered-viewport',
    )
    await expect.poll(() => image.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true)
    expect(await page.evaluate(() => window.nativeFullscreenCalls)).toBe(0)
    await expect(page.getByTestId('scene-fullscreen').getByTestId('rain-overlay')).toHaveCount(1)
    await capture('ios-compatibility-branch-artwork')
    await page.getByRole('button', { name: '전체화면 나가기' }).click()
    await expect(page.getByTestId('scene-fullscreen')).toHaveCount(0)
  } finally {
    await iosContext.close()
  }
} catch (error) {
  evidence.status = browser ? 'failed' : 'blocked'
  evidence.errors.push(String(error))
  if (page && !page.isClosed()) {
    try {
      await capture('failure-state')
    } catch {
      /* Page may be unavailable after a crash. */
    }
  }
  throw error
} finally {
  try {
    await browser?.close()
  } finally {
    evidence.errors.push(...errors)
    evidence.finishedAt = new Date().toISOString()
    await writeFile(`${output}/manifest.json`, JSON.stringify(evidence, null, 2))
    console.log(browser ? 'Test browser closed.' : 'Test browser could not launch.')
    console.log(`Evidence: ${output}`)
  }
}
