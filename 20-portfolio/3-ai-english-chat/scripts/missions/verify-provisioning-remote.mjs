#!/usr/bin/env node
// Creates and removes only its own temporary Auth fixture. Uses the real remote DB.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SECRET_KEY, options);
const learner = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const check = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.code ?? result.error.status ?? 'request failed'}`); return result.data; };
let fixtureId;
let report;
try {
  const state = check(await admin.from('mission_catalog_state').select('is_ready').single(), 'catalog state');
  assert.equal(state.is_ready, true, 'Complete catalog verification before this test.');
  const email = `catalog-provision-${randomUUID()}@example.test`;
  const password = `${randomBytes(32).toString('base64url')}Aa1!`;
  const created = check(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { testFixture: 'mission-provisioning' } }), 'create fixture');
  fixtureId = created.user.id;
  check(await learner.auth.signInWithPassword({ email, password }), 'fixture sign-in');
  assert.deepEqual(check(await learner.rpc('provision_my_missions'), 'before profile'), { mode: 'needs-profile', assignedCount: 0 });
  const settings = { displayName: '검증 학습자', learnerLevel: 'PRE_A1', dailyGoal: 10, learningGoal: '', interests: ['여행'], correctionMode: 'gentle', voice: 'marin', rate: 1, autoplay: false, koreanExplanation: 'brief', responseLength: 'short' };
  check(await learner.rpc('save_learning_preferences', { _expected_revision: 0, _settings: settings }), 'save profile');
  const simultaneous = await Promise.all(Array.from({ length: 8 }, () => learner.rpc('provision_my_missions')));
  for (const result of simultaneous) assert.deepEqual(check(result, 'simultaneous initial provisioning'), { mode: 'assigned', assignedCount: 5 });
  const visible = check(await learner.from('missions').select('id,current_version_id,difficulty,scenario_category,category_id').order('id'), 'visible missions');
  assert.equal(visible.length, 5);
  assert.ok(visible.every(row => row.difficulty === 'pre-A1' && row.scenario_category === '여행'));
  assert.equal(new Set(visible.map(row => row.category_id)).size, 5);
  const ids = visible.map(row => row.id);
  const assignments = check(await learner.from('mission_assignments').select('mission_id,profile_snapshot'), 'assignment evidence');
  assert.equal(assignments.length, 5);
  for (const row of assignments) assert.deepEqual(row.profile_snapshot, { learnerLevel: 'PRE_A1', interests: ['여행'] });
  check(await learner.rpc('save_learning_preferences', { _expected_revision: 1, _settings: { ...settings, learnerLevel: 'C2', interests: ['직장'] } }), 'change profile');
  assert.deepEqual(check(await learner.rpc('provision_my_missions'), 'repeat after profile change'), { mode: 'assigned', assignedCount: 5 });
  assert.deepEqual(check(await learner.from('missions').select('id').order('id'), 'same assignments').map(row => row.id), ids);
  const unassigned = check(await admin.from('missions').select('id,current_version_id').eq('status', 'published').not('id', 'in', `(${ids.join(',')})`).limit(1).single(), 'unassigned candidate');
  assert.deepEqual(check(await learner.from('missions').select('id').eq('id', unassigned.id), 'direct unassigned read'), []);
  assert.deepEqual(check(await learner.from('mission_versions').select('id').eq('id', unassigned.current_version_id), 'direct unassigned version'), []);
  assert.deepEqual(check(await learner.from('mission_steps').select('id').eq('mission_version_id', unassigned.current_version_id), 'direct unassigned steps'), []);
  assert.equal((await learner.from('mission_assignments').insert({ user_id: fixtureId, mission_id: unassigned.id })).error?.code, '42501');
  assert.equal((await learner.from('mission_catalog_managers').insert({ user_id: fixtureId })).error?.code, '42501');
  const blocked = await admin.rpc('start_mission_run', { _expected_owner_id: fixtureId, _mission_id: unassigned.id, _mission_version_id: unassigned.current_version_id, _character_id: '11111111-1111-4111-8111-111111111111', _character_version_id: '11111111-1111-4111-8111-111111111112' });
  assert.equal(blocked.error?.code, '42501', 'Service start must enforce the supplied learner assignment.');
  assert.equal(check(await admin.from('conversations').select('id').eq('owner_id', fixtureId), 'no failed-start residue').length, 0);
  report = { status: 'PASS', verifiedAt: new Date().toISOString(), scope: 'real remote Supabase; isolated temporary account', concurrentInitialRequests: 8, assigned: 5, level: 'pre-A1', category: 'travel', distinctSubcategories: 5, checks: ['profile required', 'concurrent initial requests yield only five assignments', 'saved CEFR and interests select five distinct areas', 'profile edits and retries preserve assignments', 'unassigned mission/version/steps hidden through direct Data API', 'browser cannot self-assign or self-promote', 'service start enforces NEW.owner assignment and rolls back fully'], fixtureCleanup: 'pending' };
} finally {
  if (fixtureId) {
    check(await admin.auth.admin.deleteUser(fixtureId), 'delete owned fixture');
    if (report) report.fixtureCleanup = 'deleted';
  }
}
if (report) {
  await writeFile(new URL('../../docs/flow/2026-09-21-mission-provisioning-remote-validation.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}
