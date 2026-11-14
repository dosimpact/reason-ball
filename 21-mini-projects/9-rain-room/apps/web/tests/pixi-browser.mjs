// One browser/page, serial scenes, always closed. This is real GPU verification, not SSR proof.
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { ALL_BACKGROUNDS, BACKGROUND_CATEGORIES } from '../src/pages/focus/model/backgrounds.ts'
const output = '../../artifacts/pixi-browser'
await mkdir(output, { recursive: true })
const report = { startedAt: new Date().toISOString(), status: 'running', rooms: [], errors: [] }
let browser
try {
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (error) => report.errors.push(error.message))
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:3000')
  const scene = page.getByTestId('cafe-scene')
  for (const room of ALL_BACKGROUNDS) {
    await page.locator('.change-background').click()
    await page
      .getByRole('group', { name: '배경 카테고리' })
      .getByRole('button', {
        name: BACKGROUND_CATEGORIES.find((c) => c.id === room.category).name,
        exact: true,
      })
      .click()
    await page.getByRole('button', { name: `${room.name} 선택`, exact: true }).click()
    await expect(scene).toHaveAttribute('data-render-status', 'ready', { timeout: 30000 })
    await expect(scene.locator('canvas')).toHaveCount(1)
    await expect(scene.locator('svg')).toHaveCount(0)
    await expect(scene).toHaveAttribute('aria-label', room.description)
    await scene.screenshot({ path: `${output}/${room.id}-mobile.png` })
    report.rooms.push({ id: room.id, renderer: 'pixi', screenshot: `${room.id}-mobile.png` })
  }
  await page.locator('.scene-expand').click()
  await expect(page.getByTestId('scene-fullscreen')).toBeVisible()
  await expect(page.getByTestId('scene-fullscreen').locator('canvas')).toHaveCount(1)
  await expect(page.getByTestId('scene-fullscreen').getByTestId('cafe-scene')).toHaveAttribute(
    'data-render-status',
    'ready',
  )
  await page.screenshot({ path: `${output}/fullscreen-mobile.png` })
  await page.getByRole('button', { name: '플레이어 접기', exact: true }).click()
  await expect(page.getByRole('button', { name: '플레이어 열기', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.screenshot({ path: `${output}/fullscreen-desktop.png` })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('scene-fullscreen')).toHaveCount(0)
  await expect(scene).toHaveAttribute('data-render-status', 'ready')
  if (report.errors.length) throw Error(report.errors.join('\n'))
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.errors.push(String(error))
  process.exitCode = 1
} finally {
  await browser?.close()
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n')
}
