import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const catalogue = JSON.parse(readFileSync(resolve('database/참가격_웨딩홀_업체별_공시원본/catalog.json'), 'utf8'));
const venueCount = catalogue.venues.length;
const pricedCount = catalogue.venues.filter(v => !v.archived && !v.duplicateOf && v.metrics.mealMin != null).length;

test.beforeEach(async ({ page }) => {
  // External provider rendering is verified separately with the browser MCP.
  // These checks isolate app behaviour from a third party's loading time.
  await page.route('https://maps.google.com/**', route => route.fulfill({ contentType:'text/html',body:'<!doctype html><html lang="ko"><body style="background:#e7ecdf;font:14px sans-serif;color:#54704b;padding:40px">Google 지도 연결</body></html>' }));
});

test('WEB-001: all venues, actual distribution, pagination and full-table view', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', {name:`모든 웨딩 공시 ${venueCount}건`})).toBeVisible();
  await expect(page.locator('#stat-priced')).toContainText(String(pricedCount));
  await expect(page.locator('#venue-rows tr')).toHaveCount(20);
  await expect(page.locator('.chart-bin')).toHaveCount(16);
  await page.getByRole('button', {name:'다음 페이지',exact:true}).click();
  await expect(page.locator('#page-summary')).toHaveText(`${venueCount}개 공시 중 21–40`);
  await page.getByLabel('페이지당 업체 수').selectOption('10000');
  await expect(page.locator('#venue-rows tr')).toHaveCount(venueCount);
  expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath('desktop.png')});
  await info.attach('desktop',{path:info.outputPath('desktop.png'),contentType:'image/png'});
});

test('WEB-002: search, conflicting filters, empty state and reset', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('searchbox', {name:'업체명 또는 주소 검색'}).fill('AW호텔');
  await expect(page.locator('#venue-rows tr')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'AW호텔웨딩 상세보기',exact:true})).toBeVisible();
  await page.getByLabel('어느 지역을 찾으세요?').selectOption('부산');
  await expect(page.getByRole('heading',{name:'조건에 맞는 공간이 없어요'})).toBeVisible();
  await page.getByRole('button',{name:'필터 초기화',exact:true}).click();
  await expect(page.locator('#result-count')).toHaveText(`${venueCount}건`);
  await page.getByLabel('어느 지역을 찾으세요?').selectOption('대구');
  await page.getByLabel('예상 하객 수').fill('200');
  const slider = page.getByRole('slider',{name:'최대 1인 식대'});
  await slider.focus(); await slider.press('Home');
  for(let i=0;i<6;i++) await slider.press('ArrowRight');
  await expect(page.locator('#budget-label')).toHaveText('60,000원 이하');
  await expect(page.getByRole('button',{name:'AW호텔웨딩 상세보기',exact:true})).toBeVisible();
  await expect(page.locator('#active-filters')).toContainText('인원 200명 이하');
});

test('WEB-002: numeric sorting and missing prices last', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('페이지당 업체 수').selectOption('10000');
  for(const direction of ['asc','desc']) {
    await page.getByLabel('업체 정렬').selectOption(`mealMin:${direction}`);
    const prices = await page.locator('#venue-rows tr').evaluateAll(rows => rows.map(row => {const text=row.children[3].querySelector('.money')?.textContent;return text ? Number(text.match(/[\d,]+/)[0].replaceAll(',','')) : null;}));
    const known = prices.filter(v=>v!==null);
    expect(known).toEqual([...known].sort((a,b)=>direction==='asc'?a-b:b-a));
    expect(prices.slice(known.length).every(v=>v===null)).toBe(true);
  }
  await page.getByLabel('식대 비교 가능한 공간만').check();
  await expect(page.locator('#venue-rows tr')).toHaveCount(pricedCount);
});

test('WEB-002: favorites survive reload and create a personal collection', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('searchbox').fill('AW호텔');
  await page.getByRole('button',{name:'AW호텔웨딩 관심 저장',exact:true}).click();
  await expect(page.locator('#favorite-count')).toHaveText('1');
  await page.reload();
  await expect(page.getByRole('button',{name:'AW호텔웨딩 관심 해제',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'관심 공간 1',exact:true}).click();
  await expect(page.locator('#venue-rows tr')).toHaveCount(1);
});

test('WEB-002: comparison uses selected venue data and enforces four-space limit', async ({ page }) => {
  await page.goto('./');
  const checks=page.getByRole('checkbox',{name:/비교 선택$/});
  for(let i=0;i<4;i++)await checks.nth(i).check();
  await expect(checks.nth(4)).toBeDisabled();
  await page.getByRole('button',{name:'나란히 비교하기 →',exact:true}).click();
  await expect(page.getByRole('heading',{name:'나의 공간 비교',exact:true})).toBeVisible();
  await expect(page.locator('.compare-column')).toHaveCount(4);
  await page.getByRole('button',{name:'비교 닫기',exact:true}).click();
  await page.getByRole('button',{name:'비우기',exact:true}).click();
  await expect(page.locator('#comparison-tray')).toBeHidden();
});

test('WEB-004/005: detail shows semantic content, conditions, provider links and real files', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('searchbox').fill('AW호텔');
  await page.getByRole('button',{name:'AW호텔웨딩 상세보기',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('heading',{name:'AW호텔웨딩',exact:true})).toBeVisible();
  await expect(dialog).toContainText('대관·장식 합계');
  await expect(dialog).toContainText('700,000');
  await expect(dialog.getByRole('heading',{name:'계약 취소·위약금·환급 규정',exact:true})).toBeVisible();
  await expect(dialog.getByRole('link',{name:'네이버 지도 ↗'})).toHaveAttribute('href',/map\.naver\.com\/p\/search\//);
  await expect(dialog.getByRole('link',{name:'Google 지도 ↗'})).toHaveAttribute('href',/api=1&query=/);
  const md=await dialog.getByRole('link',{name:'정리된 Markdown ↗'}).getAttribute('href');
  const response=await page.request.get(md!);
  expect(response.ok()).toBe(true);
  const body=await response.text();
  expect(body).toContain('## 가격 한눈에 보기');
  expect(body).not.toContain('| 행 | A |');
  await page.getByRole('button',{name:'상세 닫기',exact:true}).click();
  await expect(dialog).toBeHidden();
});

test('WEB-003: changing metric and sample leaves zero-variance charts finite', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('searchbox').fill('AW호텔');
  await page.getByLabel('가격 비교 표본').selectOption('filtered');
  await expect(page.locator('#sample-count')).toHaveText('비교 표본 1곳');
  expect(await page.locator('#price-chart').innerHTML()).not.toMatch(/NaN|Infinity/);
  await page.getByLabel('가격 비교 항목').selectOption('combinedMin');
  await expect(page.locator('#sample-count')).toHaveText('비교 표본 1곳');
  await page.getByRole('button',{name:'비교 기준 ⓘ',exact:true}).click();
  await expect(page.getByRole('heading',{name:'숫자를 읽는 방법',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('자기 자신은 제외');
});

test('WEB-002: filtered CSV can be downloaded', async ({ page }, info) => {
  await page.goto('./');
  await page.getByRole('searchbox').fill('AW호텔');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'목록 저장 ↓',exact:true}).click();
  const download=await pending;
  const destination=info.outputPath('venues.csv');await download.saveAs(destination);
  const text=readFileSync(destination,'utf8');expect(text).toContain('AW호텔웨딩');expect(text).toContain('55000');
  expect(text.split('\r\n')).toHaveLength(2);
});

test('SYS-004: direct file opening reads the static database fallback', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('index.html')).href);
  await expect(page.getByRole('heading',{name:`모든 웨딩 공시 ${venueCount}건`,exact:true})).toBeVisible();
});

test('WEB-006: mobile filters, detail and page width', async ({ page }, info) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await expect(page.locator('#result-count')).toHaveText(`${venueCount}건`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button',{name:'필터',exact:true}).click();
  await page.getByRole('searchbox').fill('AW호텔');
  await page.getByLabel('어느 지역을 찾으세요?').selectOption('대구');
  await page.getByRole('button',{name:'필터 닫기',exact:true}).click();
  await expect(page.getByRole('button',{name:'AW호텔웨딩 상세보기',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'AW호텔웨딩 상세보기',exact:true}).click();
  const box=await page.getByRole('dialog').boundingBox();expect(box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({path:info.outputPath('mobile-detail.png')});
  await info.attach('mobile-detail',{path:info.outputPath('mobile-detail.png'),contentType:'image/png'});
});

test('WEB-001/005: supplemental PDF profiles show their original without a fabricated Excel price', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('searchbox').fill('JW메리어트호텔');
  await page.getByRole('button',{name:'JW메리어트호텔 상세보기',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('heading',{name:'JW메리어트호텔',exact:true})).toBeVisible();
  await expect(dialog.getByRole('link',{name:'공시 PDF ↓',exact:true})).toHaveAttribute('href',/\.pdf$/);
  await expect(dialog.getByRole('link',{name:'공시 Excel ↓',exact:true})).toHaveCount(0);
  await expect(dialog.locator('.detail-price-grid>div').first()).toContainText('원문 확인');
  await expect(dialog).toContainText('자동 판독');
});

test('WEB-001: a post with no attachment remains searchable with its disclosed contact information', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('searchbox').fill('웨딩시그니처');
  await page.getByRole('button',{name:'웨딩시그니처 상세보기',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('02-335-5400');
  await expect(dialog).toContainText('내려받을 수 있는 가격 첨부가 없습니다');
  await expect(dialog.getByRole('link',{name:'정리된 Markdown ↗',exact:true})).toHaveAttribute('href',/post-38665\.md$/);
});

test('SYS-004: standalone server serves local data and excludes sibling applications', async ({ request }) => {
  const root=await request.get('/',{maxRedirects:0});
  expect(root.status()).toBe(200);
  const data = await request.get('/client/database/참가격_웨딩홀_업체별_공시원본/catalog.json');
  expect(data.status()).toBe(200);
  expect((await data.json()).venues).toHaveLength(venueCount);
  expect((await request.get('/app/package.json')).status()).toBe(404);
  expect((await request.get('/client/.gitignore')).status()).toBe(404);
});
