import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('http://127.0.0.1:3045');
  await page.getByText('매출과 광고비 Canvas', { exact: true }).filter({ visible: true }).click();
  await page.getByTestId('canvas-widget').nth(1).getByRole('button', { name: '데이터 보기' }).waitFor({ timeout: 120000 });
  console.log((await page.locator('body').innerText()).slice(-5000));
  fs.mkdirSync('output/playwright', { recursive: true });
  await page.screenshot({ path: 'output/playwright/canvas-created.png', fullPage: true });
  fs.mkdirSync('output/validation', { recursive: true });
  fs.writeFileSync('output/validation/browser-storage.json', JSON.stringify(await page.evaluate(() => localStorage.getItem('canvas-ux:dashboard:v1'))));
} finally {
  await browser.close();
  console.log('Owned Chrome closed', !browser.isConnected());
}
