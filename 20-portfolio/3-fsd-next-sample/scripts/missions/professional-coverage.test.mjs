import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildLearningPaths, compileMission } from './compile-catalog.mjs';
import { validateCatalog } from './validate-catalog.mjs';

const levels = ['pre-A1', 'A2', 'B1'];
const roles = ['designer', 'it-operations'];
const write = (root, file, value) => writeFile(join(root, file), JSON.stringify(value));
const brief = professionalRole => ({ professionalRole, situation: '마감 전에 자료를 확인해야 한다.', facts: ['검토한 자료는 하나다.'], constraints: ['다른 자료는 아직 확인하지 못했다.'], learnerAuthority: '확인을 요청할 수 있다.', counterpartPosition: '오늘 전달하기를 원한다.', unresolvedQuestions: ['누가 확인할 수 있는가?'], deliverable: '담당자와 확인 시간을 합의한다.', resolutionCriteria: ['미확인 범위를 구분한다.', '다음 확인 시간을 정한다.'], escalationPath: '기한이 맞지 않으면 책임자에게 알린다.' });
function body(key, difficulty, professionalRole) {
  return { schemaVersion: 1, key, title: `확인 과제 ${key}`, categoryId: 'work', subcategoryId: 'collaboration', difficulty,
    scenario: `가상 확인 과제 ${key}를 맡았다.`, practicalOutcome: '담당자와 확인 시간을 정한다.', roles: { learner: '담당자', interlocutor: '동료' }, opening: 'When can you check it?', estimatedMinutes: 5, prerequisites: [],
    steps: ['ask', 'compare', 'agree'].map(id => ({ id, goal: '다음 확인을 요청한다.', example: 'Can we check this today?', hints: ['의도를 설명한다.', 'check = 확인하다', 'Can we check this today?'], successCriterion: '확인 시점에 합의한다.' })),
    pedagogy: { researchIds: ['SOURCE'], supportFade: '예문을 가린다.', retrieval: '기억해 말한다.', transfer: '기한을 바꾸어 말한다.', review: { intervalDays: [1, 3], prompt: '다시 확인을 요청한다.' } },
    assessment: { criteria: ['미확인 상태를 설명한다.', '담당과 시간을 정한다.'], acceptParaphrases: true, feedbackPolicy: '의미를 확인한다.' },
    ...(professionalRole ? { caseBrief: brief(professionalRole) } : {}),
  };
}

// A small complete curriculum exercises the same separate baseline/role gates as 672 + 80.
// The independent bodies avoid having a compiler bug silently manufacture validator fixtures.
async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'mission-professional-'));
  try {
    for (const file of ['catalog.schema.json', 'category-catalog.schema.json', 'mission.schema.json']) await copyFile(new URL(`../../assets/missions/${file}`, import.meta.url), join(root, file));
    await mkdir(join(root, 'work'));
    await mkdir(join(root, 'content/work/collaboration'), { recursive: true });
    const categories = { categories: [{ id: 'work', name: '업무', subcategories: [{ id: 'collaboration', name: '협업' }] }] };
    const curriculum = {
      levels: levels.map(id => ({ id, communicativeDemand: '확인하고 합의한다.' })),
      targetCoverage: { categoryCount: 1, subcategoryCount: 1, levels, missionsPerSubcategoryLevel: 1, baselineMissions: 3, totalMissions: 7 },
      specializationCoverage: { categoryId: 'work', levels: ['A2', 'B1'], missionsPerRoleLevel: 1, totalMissions: 4, tracks: roles.map(role => ({ role, title: role, source: `authoring/work-${role}.json` })) },
    };
    const bodies = [
      ...levels.map(level => body(`baseline-${level.toLowerCase()}`, level)),
      ...roles.flatMap(role => ['A2', 'B1'].map(level => body(`${role}-${level.toLowerCase()}`, level, role))),
    ];
    function pathsForCurrentBodies() {
      const paths = buildLearningPaths(bodies, categories, curriculum);
      // The fixture has its own pre-A1 entry rather than pretending to be the shipped first-ten list.
      paths.entry.missionKeys = ['baseline-pre-a1'];
      return paths;
    }
    const save = async (paths = pathsForCurrentBodies()) => {
      await write(root, 'catalog.json', { schemaVersion: 1, catalogs: [{ categoryId: 'work', file: 'work/catalog.json' }] });
      await write(root, 'categories.json', categories);
      await write(root, 'levels.json', { levels: levels.map((id, order) => ({ id, order })) });
      await write(root, 'research-sources.json', { sources: [{ id: 'SOURCE' }] });
      await write(root, 'curriculum.json', curriculum);
      await write(root, 'learning-paths.json', paths);
      const missions = [];
      for (const item of bodies) {
        const file = `content/work/collaboration/${item.key}.json`;
        await write(root, file, item);
        missions.push({ key: item.key, title: item.title, categoryId: item.categoryId, subcategoryId: item.subcategoryId, difficulty: item.difficulty, authoringStatus: 'draft', file, tags: [] });
      }
      await write(root, 'work/catalog.json', { schemaVersion: 1, categoryId: 'work', missions });
    };
    await save();
    await run({ root, bodies, curriculum, pathsForCurrentBodies, save });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('complete curriculum counts baseline and professional cases independently', () => fixture(async ({ root }) => {
  const result = await validateCatalog(root, { complete: true });
  assert.equal(result.missions, 7);
  assert.deepEqual(result.baselineCoverage, { 'work/collaboration/pre-A1': 1, 'work/collaboration/A2': 1, 'work/collaboration/B1': 1 });
  assert.deepEqual(result.professionalCoverage, { 'designer/A2': 1, 'designer/B1': 1, 'it-operations/A2': 1, 'it-operations/B1': 1 });
  assert.equal(result.coverage['work/collaboration/A2'], 3);
}));

test('unchanged grand total cannot hide a missing professional role-level cell', () => fixture(async ({ root, bodies, save }) => {
  bodies.find(item => item.key === 'designer-b1').caseBrief.professionalRole = 'it-operations';
  await save();
  await assert.rejects(validateCatalog(root, { complete: true }), /incomplete professional coverage designer\/B1/);
}));

test('a professional case cannot replace a baseline mission at the same category and level', () => fixture(async ({ root, bodies, save }) => {
  bodies.find(item => item.key === 'baseline-a2').caseBrief = brief('designer');
  await save();
  await assert.rejects(validateCatalog(root, { complete: true }), /incomplete coverage work\/collaboration\/A2/);
}));

test('professional paths reject a baseline key with the right category and level', () => fixture(async ({ root, pathsForCurrentBodies, save }) => {
  const paths = pathsForCurrentBodies();
  paths.professionalTracks[0].stages[0].missionKeys = ['baseline-a2'];
  await save(paths);
  await assert.rejects(validateCatalog(root, { complete: true }), /invalid professional key baseline-a2/);
}));

test('professional paths reject a case assigned to the wrong role', () => fixture(async ({ root, pathsForCurrentBodies, save }) => {
  const paths = pathsForCurrentBodies();
  paths.professionalTracks[0].stages[0].missionKeys = ['it-operations-a2'];
  await save(paths);
  await assert.rejects(validateCatalog(root, { complete: true }), /invalid professional key it-operations-a2/);
}));

test('professional paths cannot omit a case even when general paths retain it', () => fixture(async ({ root, pathsForCurrentBodies, save }) => {
  const paths = pathsForCurrentBodies();
  paths.professionalTracks[0].stages[0].missionKeys = [];
  await save(paths);
  await assert.rejects(validateCatalog(root, { complete: true }), /missing professional case/);
}));

test('professional paths cannot replay a case twice to satisfy totals', () => fixture(async ({ root, pathsForCurrentBodies, save }) => {
  const paths = pathsForCurrentBodies();
  paths.professionalTracks[0].stages[0].missionKeys.push('designer-a2');
  await save(paths);
  await assert.rejects(validateCatalog(root, { complete: true }), /professional track keys: duplicate/);
}));

test('professional stage ordering follows curriculum rather than arbitrary file order', () => fixture(async ({ root, pathsForCurrentBodies, save }) => {
  const paths = pathsForCurrentBodies();
  paths.professionalTracks[0].stages.reverse();
  await save(paths);
  await assert.rejects(validateCatalog(root, { complete: true }), /professional level order mismatch/);
}));

test('compiler preserves case authority and assessment criteria without aliasing author input', () => {
  const caseBrief = brief('designer');
  const seed = { subcategoryId: 'collaboration', difficulty: 'A2', slug: 'designer-review', title: '검토 협의', scenario: '자료 검토가 필요하다.', learnerRole: '디자이너', interlocutorRole: '동료', opening: 'When can you review it?', steps: [{ goal: '질문한다.', example: 'Can we review it?', cue: 'review = 검토하다' }], outcome: '검토 시간을 정한다.', transfer: '다음 날로 바꾸어 협의한다.', caseBrief };
  const compiled = compileMission('work', seed, { scaffolding: '질문 틀 제공', communicativeDemand: '확인과 합의' });
  assert.deepEqual(compiled.caseBrief, caseBrief);
  for (const criterion of caseBrief.resolutionCriteria) assert.ok(compiled.assessment.criteria.includes(criterion));
  caseBrief.facts.push('나중에 작성자가 추가한 사실');
  assert.equal(compiled.caseBrief.facts.length, 1);
  assert.equal(compiled.caseBrief.learnerAuthority, '확인을 요청할 수 있다.');
});
