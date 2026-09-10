import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, test } from '@playwright/test';

// Execute the production adapter against real browser Storage, without claiming
// that this exercises a Supabase-authenticated composer.
const compiled = ts.transpileModule(readFileSync(resolve('src/entities/chat/api/draft-storage.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const script = `(() => { const exports = {}; ${compiled}; window.draftModule = exports; })();`;
type DraftWindow = Window & { draftModule: typeof import('../../src/entities/chat/api/draft-storage') };

test('keeps scoped unsent text across a real reload and removes only draft keys', async ({ page }) => {
  await page.goto('/');
  await page.addScriptTag({ content: script });
  await page.evaluate(() => {
    const store = (window as unknown as DraftWindow).draftModule.createDraftStorage(localStorage);
    localStorage.setItem('draft-test-unrelated', 'retain');
    store.write('alice', 'one', 'Hello\n안녕하세요');
    store.write('bob', 'one', 'Another account');
  });
  await page.reload();
  await page.addScriptTag({ content: script });
  expect(await page.evaluate(() => {
    const store = (window as unknown as DraftWindow).draftModule.createDraftStorage(localStorage);
    return [store.read('alice', 'one'), store.read('bob', 'one'), store.read('alice', 'two')];
  })).toEqual(['Hello\n안녕하세요', 'Another account', '']);
  expect(await page.evaluate(() => {
    const store = (window as unknown as DraftWindow).draftModule.createDraftStorage(localStorage);
    store.write('alice', 'one', '');
    const cleared = store.read('alice', 'one');
    store.clearAll();
    return [cleared, store.read('bob', 'one'), localStorage.getItem('draft-test-unrelated')];
  })).toEqual(['', '', 'retain']);
});
