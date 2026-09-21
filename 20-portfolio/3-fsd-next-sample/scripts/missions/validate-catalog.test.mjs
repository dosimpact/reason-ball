import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCatalog, validateShape } from './validate-catalog.mjs';

const write = (root, file, value) => writeFile(join(root, file), JSON.stringify(value));
async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'mission-validator-'));
  try {
    for (const name of ['catalog.schema.json', 'category-catalog.schema.json', 'mission.schema.json']) await copyFile(new URL(`../../assets/missions/${name}`, import.meta.url), join(root, name));
    await mkdir(join(root, 'daily'));
    await mkdir(join(root, 'content/daily/food-drink'), { recursive: true });
    await write(root, 'catalog.json', { schemaVersion: 1, catalogs: [{ categoryId: 'daily', file: 'daily/catalog.json' }] });
    await write(root, 'categories.json', { categories: [{ id: 'daily', subcategories: [{ id: 'food-drink' }] }] });
    await write(root, 'levels.json', { levels: [{ id: 'A1', order: 1 }, { id: 'A2', order: 2 }] });
    await write(root, 'research-sources.json', { sources: [{ id: 'SOURCE' }] });
    const item = { key: 'request-water', title: '물 요청', categoryId: 'daily', subcategoryId: 'food-drink', difficulty: 'A1', authoringStatus: 'draft', file: 'content/daily/food-drink/request-water.json', tags: [] };
    const body = { schemaVersion: 1, key: item.key, title: item.title, categoryId: item.categoryId, subcategoryId: item.subcategoryId, difficulty: item.difficulty, scenario: '물을 요청한다.', practicalOutcome: '물을 받는다.', roles: { learner: '손님', interlocutor: '직원' }, opening: 'Hello.', estimatedMinutes: 5, prerequisites: [], steps: ['ask', 'confirm', 'thanks'].map(id => ({ id, goal: '요청한다.', example: 'Water, please.', hints: ['요청해요', '물 water', 'Water, please.'], successCriterion: '의도가 전달된다.' })), pedagogy: { researchIds: ['SOURCE'], supportFade: '힌트를 가린다', retrieval: '떠올린다', transfer: '두 잔 요청', review: { intervalDays: [1, 3], prompt: '다시 요청' } }, assessment: { criteria: ['물을 요청', '감사를 전달'], acceptParaphrases: true, feedbackPolicy: '의미 중심' } };
    const save = async () => { await write(root, 'daily/catalog.json', { schemaVersion: 1, categoryId: 'daily', missions: [item] }); await write(root, item.file, body); };
    await save();
    await run({ root, item, body, save });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('valid full body produces coverage', () => fixture(async ({ root }) => { const result = await validateCatalog(root); assert.equal(result.bodies, 1); assert.equal(result.coverage['daily/food-drink/A1'], 1); }));
for (const [name, mutate, error] of [
  ['unknown research', b => b.pedagogy.researchIds.push('MISSING'), /unknown research/],
  ['missing prerequisite', b => b.prerequisites.push('missing'), /missing prerequisite/],
  ['cyclic prerequisite', b => b.prerequisites.push(b.key), /cycle/],
  ['metadata drift', b => b.title = '다른 제목', /metadata mismatch/],
  ['empty guidance', b => b.steps[0].goal = ' ', /empty\/short/],
  ['unexpected fields', b => b.hidden = true, /unknown property/],
  ['review order', b => b.pedagogy.review.intervalDays = [7, 1], /must increase/],
]) test(name, () => fixture(async ({ root, body, save }) => { mutate(body); await save(); await assert.rejects(validateCatalog(root), error); }));
test('malformed JSON fails', () => fixture(async ({ root, item }) => { await writeFile(join(root, item.file), '{'); await assert.rejects(validateCatalog(root), /request-water.json/); }));
test('orphan content fails', () => fixture(async ({ root, body }) => { await write(root, 'content/daily/food-drink/orphan.json', body); await assert.rejects(validateCatalog(root), /orphan body/); }));
test('schema interpreter rejects unsupported keywords', () => assert.throws(() => validateShape('x', { format: 'email' }), /unsupported/));
test('complete gate enforces every curriculum cell', () => fixture(async ({ root }) => {
  await write(root, 'curriculum.json', { targetCoverage: { categoryCount: 1, subcategoryCount: 1, levels: ['A1', 'A2'], missionsPerSubcategoryLevel: 1, totalMissions: 2 } });
  await assert.rejects(validateCatalog(root, { complete: true }), /count not reached/);
}));
test('complete gate rejects missing cells even at target count', () => fixture(async ({ root }) => {
  await write(root, 'curriculum.json', { targetCoverage: { categoryCount: 1, subcategoryCount: 1, levels: ['A1', 'A2'], missionsPerSubcategoryLevel: 1, totalMissions: 1 } });
  await assert.rejects(validateCatalog(root, { complete: true }), /incomplete coverage/);
}));
test('catalog path cannot escape content boundary', () => fixture(async ({ root, item }) => {
  item.file = 'content/daily/shopping/request-water.json';
  await write(root, 'daily/catalog.json', { schemaVersion: 1, categoryId: 'daily', missions: [item] });
  await assert.rejects(validateCatalog(root), /expected path/);
}));
test('catalog duplicate keys fail', () => fixture(async ({ root, item }) => {
  await write(root, 'daily/catalog.json', { schemaVersion: 1, categoryId: 'daily', missions: [item, item] });
  await assert.rejects(validateCatalog(root), /duplicate key/);
}));
const pathFixture = key => ({ schemaVersion: 1, entry: { missionKeys: [] }, tracks: [{ id: 'daily-food-drink', categoryId: 'daily', subcategoryId: 'food-drink', stages: [{ difficulty: 'A1', missionKeys: [key] }, { difficulty: 'A2', missionKeys: [] }] }] });
test('learning paths include every authored mission in its level', () => fixture(async ({ root, item }) => {
  await write(root, 'learning-paths.json', pathFixture(item.key));
  assert.equal((await validateCatalog(root)).bodies, 1);
}));
test('learning paths reject nonexistent mission references', () => fixture(async ({ root }) => {
  await write(root, 'learning-paths.json', pathFixture('missing'));
  await assert.rejects(validateCatalog(root), /invalid track key/);
}));
test('learning paths reject level mismatches', () => fixture(async ({ root, item }) => {
  const paths = pathFixture(item.key);
  paths.tracks[0].stages[0].missionKeys = [];
  paths.tracks[0].stages[1].missionKeys = [item.key];
  await write(root, 'learning-paths.json', paths);
  await assert.rejects(validateCatalog(root), /invalid track key/);
}));
