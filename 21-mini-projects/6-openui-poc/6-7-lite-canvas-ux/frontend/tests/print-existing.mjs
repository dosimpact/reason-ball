import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const id = process.argv[2];
if (!id) throw new Error('Pass a published report ID');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:3048/reports/${id}`);
  await page.getByRole('button', { name: 'PDF 저장' }).waitFor();
  await page.locator('.iui-chart svg').first().waitFor();
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  const overflow = await page.locator('.iui-chart-plot svg').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().width > node.parentElement.getBoundingClientRect().width + 1).length);
  if (overflow || errors.length) throw new Error(JSON.stringify({ overflow, errors }));
  mkdirSync('output/pdf', { recursive: true });
  await page.pdf({ path: 'output/pdf/supplier-report.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.screenshot({ path: 'output/playwright/production-public-report.png', fullPage: true });
  writeFileSync('output/validation/production-print.json', JSON.stringify({ reportId: id, errors, overflow, title: await page.title(), passed: true }, null, 2));
  console.log(JSON.stringify({ reportId: id, errors, overflow, passed: true }));
} finally { await browser.close(); }
