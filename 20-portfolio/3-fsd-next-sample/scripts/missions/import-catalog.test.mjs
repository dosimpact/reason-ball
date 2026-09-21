import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mapMissionImport, importId, canonicalJson, sha256 } from './import-mapper.mjs';
import { importOne, runImport, createRemoteClient } from './import-remote.mjs';
import { loadImportPlans } from './import-catalog.mjs';

const body = JSON.parse(await readFile(new URL('../../assets/missions/content/travel/hotel/hotel-check-in-001.json', import.meta.url)));
const image = Buffer.from('test-image');
const options = { ownerId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', characterId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', rewardPrefix: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/catalog', rewardXp: 120, rewardSha256: sha256(image), visibility: 'public' };
const makePlan = source => mapMissionImport(source ?? body, options, '여행', '호텔·숙박');

function fakeRemote(plan, { failAfter } = {}) {
  const db = { mission_catalog_entries: [], missions: [], mission_versions: [], mission_version_instructions: [], mission_steps: [], mission_rewards: [] };
  const writes = [];
  let failed = false;
  const fail = stage => { if (failAfter === stage && !failed) { failed = true; throw new Error('simulated response lost'); } };
  const client = {
    async read(table) { return structuredClone(db[table]); },
    async ensureReward() { writes.push('storage'); },
    async insert(table, row) { writes.push(`insert:${table}`); db[table].push(structuredClone(row)); fail('register'); },
    async patch(table, query, changes) {
      writes.push(`patch:${table}`);
      const rows = table === 'mission_steps' ? db[table].filter(step => step.step_order === Number(query.step_order.slice(3))) : db[table];
      rows.forEach(row => Object.assign(row, structuredClone(changes)));
      fail('patch');
      return structuredClone(rows);
    },
    async rpc(name, request) {
      writes.push(name);
      if (name === 'publish_mission') {
        db.missions[0].status = 'published';
        db.mission_versions[0].published_at = '2026-09-21T00:00:00Z';
        fail('publish');
        return;
      }
      const p = request._payload;
      db.missions.push({ id: request._mission_id, owner_id: request._expected_owner_id, current_version_id: request._mission_version_id, status: 'draft', category_id: null, slug: p.slug, title: p.title, summary: p.summary, scenario_category: p.scenarioCategory, difficulty: p.difficulty, estimated_minutes: p.estimatedMinutes, visibility: p.visibility, reward_experience_points: p.rewardExperiencePoints });
      db.mission_versions.push({ learning_goals: p.learningGoals, scenario_context: p.scenarioContext, learner_role: p.learnerRole, character_role: p.characterRole, opening_instruction: p.openingInstruction, target_vocabulary: p.targetVocabulary, target_grammar: p.targetGrammar, pass_score: p.passScore, maximum_turns: p.maximumTurns, locale: p.locale });
      db.mission_version_instructions.push({ evaluator_config: structuredClone(p.evaluatorConfig), director_prompt: p.directorPrompt, evaluator_prompt: p.evaluatorPrompt, safety_instructions: p.safetyInstructions });
      db.mission_steps.push(...p.steps.map((step, index) => ({ step_order: index + 1, title: step.title, objective: step.label, learner_goal: step.learnerGoal, character_instruction: step.characterInstruction, success_criteria: step.successCriteria, hints: [step.hint], vocabulary: step.vocabulary, is_optional: false })));
      db.mission_rewards.push({ id: p.rewardAsset.missionRewardId, character_asset_id: p.rewardAsset.id, is_active: true });
      fail('create');
    },
  };
  return { client, db, writes };
}

test('mapper preserves authored source, seven-level difficulty, hints, examples, and explicit visibility without mutation', () => {
  const original = structuredClone(body);
  const plan = makePlan();
  assert.deepEqual(body, original);
  assert.equal(plan.payload.publishStatus, 'draft');
  assert.equal(plan.payload.scenarioCategory, '여행');
  assert.equal(plan.categoryId, 'hotel');
  assert.deepEqual(plan.hints, body.steps.map(step => step.hints));
  assert.deepEqual(plan.payload.targetVocabulary, body.steps.map(step => ({ english: step.example, korean: step.goal })));
  assert.deepEqual(plan.payload.evaluatorConfig.catalogImport.source, body);
  assert.equal(plan.sourceSha256, sha256(canonicalJson(body)));
  assert.equal(makePlan({ ...body, difficulty: 'pre-A1' }).payload.difficulty, 'pre-A1');
  assert.equal(mapMissionImport(body, { ...options, visibility: 'private' }, '여행').payload.visibility, 'private');
  assert.throws(() => mapMissionImport(body, { ...options, visibility: undefined }, '여행'), /visibility/);
});

test('stable identities are scoped to owner, key and entity type; source edits change hash only', () => {
  assert.equal(makePlan().missionId, makePlan().missionId);
  assert.notEqual(makePlan().missionId, makePlan().versionId);
  assert.notEqual(importId(options.characterId, body.key, 'mission'), makePlan().missionId);
  const edited = makePlan({ ...body, title: `${body.title} 수정` });
  assert.equal(edited.missionId, makePlan().missionId);
  assert.notEqual(edited.mappingSha256, makePlan().mappingSha256);
  assert.equal(sha256(canonicalJson({ a: 1, b: 2 })), sha256(canonicalJson({ b: 2, a: 1 })));
});

test('all 752 records map with bounded readable display and unique resource IDs and paths', async () => {
  const plans = await loadImportPlans(new URL('../../assets/missions', import.meta.url).pathname, options);
  assert.equal(plans.length, 752);
  for (const field of ['missionId', 'versionId', 'storagePath']) assert.equal(new Set(plans.map(plan => plan[field])).size, 752);
  for (const plan of plans) {
    const display = plan.payload.evaluatorConfig.catalogDisplay;
    assert.ok(display.location.length <= 1000);
    assert.ok(display.description.length <= 20000);
    assert.equal(Object.keys(display).length, 2);
    assert.ok(!display.description.includes('"professionalRole"'));
  }
  const professional = plans.find(plan => plan.payload.evaluatorConfig.catalogImport.source.caseBrief);
  assert.match(professional.payload.evaluatorConfig.catalogDisplay.description, /내 권한:/);
  assert.match(professional.payload.evaluatorConfig.catalogDisplay.description, /확인된 사실:/);
});

test('draft receives full hints and category before publish; exact published rerun has no writes', async () => {
  const plan = makePlan(); const remote = fakeRemote(plan);
  assert.equal(await importOne(remote.client, plan, image), 'published');
  assert.equal(remote.db.missions[0].category_id, 'hotel');
  assert.deepEqual(remote.db.mission_steps.map(step => step.hints), plan.hints);
  const writes = [...remote.writes];
  assert.equal(await importOne(remote.client, plan, image), 'unchanged');
  assert.deepEqual(remote.writes, writes);
  assert.equal(writes.at(-1), 'publish_mission');
  assert.ok(writes.indexOf('insert:mission_catalog_entries') < writes.indexOf('publish_mission'));
  assert.deepEqual(remote.db.mission_catalog_entries, [{ mission_id: plan.missionId, authoring_key: plan.key }]);
});

for (const failAfter of ['create', 'register', 'patch', 'publish']) test(`restart reconciles committed ${failAfter} after lost response without duplicate create`, async () => {
  const plan = makePlan(); const remote = fakeRemote(plan, { failAfter });
  await assert.rejects(importOne(remote.client, plan, image), /response lost/);
  assert.equal(await importOne(remote.client, plan, image), failAfter === 'publish' ? 'unchanged' : 'published');
  assert.equal(remote.writes.filter(write => write === 'create_mission_with_version').length, 1);
  assert.equal(remote.db.missions.length, 1);
});

test('changed source and conflicting identity fail before any resumed write', async () => {
  const plan = makePlan(); const remote = fakeRemote(plan);
  await importOne(remote.client, plan, image);
  const count = remote.writes.length;
  await assert.rejects(importOne(remote.client, makePlan({ ...body, scenario: `${body.scenario} 추가 조건.` }), image), /source or import configuration changed/);
  assert.equal(remote.writes.length, count);
  remote.db.missions[0].owner_id = options.characterId;
  await assert.rejects(importOne(remote.client, plan, image), /identity\/owner\/version mismatch/);
  assert.equal(remote.writes.length, count);
});

test('published category or hint drift is refused instead of modifying immutable content', async () => {
  const plan = makePlan(); const remote = fakeRemote(plan);
  await importOne(remote.client, plan, image);
  remote.db.mission_steps[0].hints = ['changed'];
  const count = remote.writes.length;
  await assert.rejects(importOne(remote.client, plan, image), /full hints/);
  assert.equal(remote.writes.length, count);
});

test('storage conflict verifies bytes and never overwrites another object', async () => {
  const methods = [];
  const client = createRemoteClient({ url: 'https://example.supabase.co', serviceKey: 'server-only-test-key-long', fetchImpl: async (_url, request) => {
    methods.push(request.method);
    return request.method === 'POST' ? new Response(JSON.stringify({ error: 'Duplicate' }), { status: 400 }) : new Response('different bytes');
  } });
  await assert.rejects(client.ensureReward(makePlan(), image), /refusing overwrite/);
  assert.deepEqual(methods, ['POST', 'GET']);
});

test('transport failures omit server body and key from errors', async () => {
  const secret = 'do-not-expose-test-service-key';
  const client = createRemoteClient({ url: 'https://example.supabase.co', serviceKey: secret, fetchImpl: async () => new Response(JSON.stringify({ code: '23505', message: secret }), { status: 400 }) });
  await assert.rejects(client.rpc('create_mission_with_version', {}), error => error.message.includes('23505') && !error.message.includes(secret));
});

test('bounded scheduler drains in-flight work and stops assigning tasks on error', async () => {
  let active = 0; let peak = 0; const visited = [];
  await assert.rejects(runImport(Array.from({ length: 12 }, (_, key) => ({ key })), async plan => {
    visited.push(plan.key); active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5)); active--;
    if (plan.key === 0) throw new Error('stop');
    return 'published';
  }, 3), /stop/);
  assert.equal(peak, 3); assert.equal(active, 0); assert.equal(visited.length, 3);
});

test('catalog entry collision prevents publication rather than relabeling another mission', async () => {
  const plan = makePlan(); const remote = fakeRemote(plan);
  remote.db.mission_catalog_entries.push({ mission_id: options.characterId, authoring_key: plan.key });
  await assert.rejects(importOne(remote.client, plan, image), /catalog entry identity mismatch/);
  assert.ok(!remote.writes.includes('publish_mission'));
  assert.equal(remote.db.missions[0].status, 'draft');
});
