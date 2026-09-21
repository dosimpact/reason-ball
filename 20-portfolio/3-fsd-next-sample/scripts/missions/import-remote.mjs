import { canonicalJson, sha256 } from './import-mapper.mjs';

const equal = (left, right) => canonicalJson(left) === canonicalJson(right);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };

export function createRemoteClient({ url, serviceKey, fetchImpl = fetch }) {
  const origin = new URL(url);
  requireThat(origin.protocol === 'https:' && !origin.username && !origin.password && origin.pathname === '/', 'HTTPS Supabase project origin required');
  requireThat(typeof serviceKey === 'string' && serviceKey.length > 20, 'Server service key required');
  async function request(path, { method = 'GET', body, binary = false, allowConflict = false } = {}) {
    let response;
    try {
      response = await fetchImpl(`${origin.origin}${path}`, {
        method, headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...(body ? { 'Content-Type': binary ? 'image/png' : 'application/json' } : {}), ...((method === 'PATCH' || (method === 'POST' && !binary)) ? { Prefer: 'return=representation' } : {}) },
        ...(body ? { body: binary ? body : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60_000),
      });
    } catch { throw new Error(`Remote ${method} request failed or timed out; rerun to reconcile committed state`); }
    if (!response.ok) {
      let code;
      try { const detail = await response.json(); code = detail.code ?? detail.error ?? detail.statusCode; } catch { /* Do not expose response bodies or headers. */ }
      if (allowConflict && (response.status === 409 || code === 'Duplicate' || code === '409')) return { conflict: true };
      throw new Error(`Remote ${method} failed: HTTP ${response.status}${/^[A-Za-z0-9_]{1,40}$/.test(String(code)) ? ` (${code})` : ''}`);
    }
    if (binary && method === 'GET') return Buffer.from(await response.arrayBuffer());
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  return {
    read: (table, query) => request(`/rest/v1/${table}?${new URLSearchParams(query)}`),
    insert: (table, body) => request(`/rest/v1/${table}`, { method: 'POST', body }),
    patch: (table, query, body) => request(`/rest/v1/${table}?${new URLSearchParams(query)}`, { method: 'PATCH', body }),
    rpc: (name, body) => request(`/rest/v1/rpc/${name}`, { method: 'POST', body }),
    async ensureReward(plan, image) {
      const path = `/storage/v1/object/character-private/${plan.storagePath.split('/').map(encodeURIComponent).join('/')}`;
      const uploaded = await request(path, { method: 'POST', body: image, binary: true, allowConflict: true });
      if (uploaded?.conflict) {
        const existing = await request(path, { binary: true });
        requireThat(sha256(existing) === sha256(image), `${plan.key}: existing reward image differs; refusing overwrite`);
      }
    },
  };
}

async function readState(client, plan) {
  const rows = await client.read('missions', { select: '*', or: `(id.eq.${plan.missionId},slug.eq.${plan.key})` });
  requireThat(rows.length <= 1, `${plan.key}: conflicting mission identity/slug`);
  if (!rows.length) return null;
  const mission = rows[0];
  requireThat(mission.id === plan.missionId && mission.owner_id === plan.ownerId && mission.current_version_id === plan.versionId, `${plan.key}: existing mission identity/owner/version mismatch`);
  const [instructions, versions, steps, rewards] = await Promise.all([
    client.read('mission_version_instructions', { select: '*', mission_version_id: `eq.${plan.versionId}` }),
    client.read('mission_versions', { select: '*', id: `eq.${plan.versionId}` }),
    client.read('mission_steps', { select: '*', mission_version_id: `eq.${plan.versionId}`, order: 'step_order.asc' }),
    client.read('mission_rewards', { select: 'id,character_asset_id,is_active', mission_version_id: `eq.${plan.versionId}` }),
  ]);
  requireThat(instructions.length === 1 && versions.length === 1, `${plan.key}: missing immutable version/instructions`);
  return { mission, instructions: instructions[0], version: versions[0], steps, rewards };
}

export function verifyState(state, plan, { completed = false } = {}) {
  const { mission, version, instructions, steps, rewards } = state;
  const p = plan.payload;
  requireThat(['draft', 'published'].includes(mission.status), `${plan.key}: unsupported existing status`);
  requireThat(equal(instructions.evaluator_config, p.evaluatorConfig), `${plan.key}: source or import configuration changed; create a reviewed new version instead`);
  const fields = { slug: p.slug, title: p.title, summary: p.summary, scenario_category: p.scenarioCategory, difficulty: p.difficulty, estimated_minutes: p.estimatedMinutes, visibility: p.visibility, reward_experience_points: p.rewardExperiencePoints };
  for (const [key, value] of Object.entries(fields)) requireThat(equal(mission[key], value), `${plan.key}: mission ${key} differs`);
  const versionFields = { learning_goals: p.learningGoals, scenario_context: p.scenarioContext, learner_role: p.learnerRole, character_role: p.characterRole, opening_instruction: p.openingInstruction, target_vocabulary: p.targetVocabulary, target_grammar: p.targetGrammar, pass_score: p.passScore, maximum_turns: p.maximumTurns, locale: p.locale };
  for (const [key, value] of Object.entries(versionFields)) requireThat(equal(version[key], value), `${plan.key}: version ${key} differs`);
  for (const [key, value] of Object.entries({ director_prompt: p.directorPrompt, evaluator_prompt: p.evaluatorPrompt, safety_instructions: p.safetyInstructions })) requireThat(instructions[key] === value, `${plan.key}: ${key} differs`);
  requireThat(rewards.length === 1 && rewards[0].id === p.rewardAsset.missionRewardId && rewards[0].character_asset_id === p.rewardAsset.id && rewards[0].is_active, `${plan.key}: reward mismatch`);
  requireThat(steps.length === p.steps.length, `${plan.key}: step count differs`);
  steps.forEach((step, index) => {
    const expected = p.steps[index];
    requireThat(step.step_order === index + 1, `${plan.key}: step order differs`);
    for (const [key, value] of Object.entries({ title: expected.title, objective: expected.label, learner_goal: expected.learnerGoal, character_instruction: expected.characterInstruction, success_criteria: expected.successCriteria, vocabulary: expected.vocabulary, is_optional: false })) requireThat(equal(step[key], value), `${plan.key}: step ${index + 1} ${key} differs`);
    if (completed) requireThat(equal(step.hints, plan.hints[index]), `${plan.key}: full hints not preserved`);
    else requireThat(equal(step.hints, [expected.hint]) || equal(step.hints, plan.hints[index]), `${plan.key}: unexpected draft hints`);
  });
  if (completed) requireThat(mission.category_id === plan.categoryId, `${plan.key}: category not preserved`);
  else requireThat(mission.category_id === null || mission.category_id === plan.categoryId, `${plan.key}: unexpected draft category`);
}

async function ensureCatalogEntry(client, plan) {
  const query = { select: 'mission_id,authoring_key', or: `(mission_id.eq.${plan.missionId},authoring_key.eq.${plan.key})` };
  let entries = await client.read('mission_catalog_entries', query);
  if (!entries.length) {
    await client.insert('mission_catalog_entries', { mission_id: plan.missionId, authoring_key: plan.key });
    entries = await client.read('mission_catalog_entries', query);
  }
  requireThat(entries.length === 1 && entries[0].mission_id === plan.missionId && entries[0].authoring_key === plan.key, `${plan.key}: catalog entry identity mismatch`);
}

// Each stage is recoverable by reading remote state. No automatic retries can create
// another identity; an uncertain response fails and the next run reconciles it.
export async function importOne(client, plan, image) {
  let state = await readState(client, plan);
  if (!state) {
    await client.ensureReward(plan, image);
    await client.rpc('create_mission_with_version', { _mission_id: plan.missionId, _mission_version_id: plan.versionId, _expected_owner_id: plan.ownerId, _payload: plan.payload });
    state = await readState(client, plan);
    requireThat(state, `${plan.key}: created mission unavailable`);
  }
  verifyState(state, plan, { completed: state.mission.status === 'published' });
  await ensureCatalogEntry(client, plan);
  if (state.mission.status === 'published') return 'unchanged';
  const updated = await client.patch('missions', { id: `eq.${plan.missionId}`, owner_id: `eq.${plan.ownerId}`, status: 'eq.draft', current_version_id: `eq.${plan.versionId}` }, { category_id: plan.categoryId });
  requireThat(updated?.length === 1, `${plan.key}: draft changed before category update`);
  for (let index = 0; index < plan.hints.length; index++) {
    const rows = await client.patch('mission_steps', { mission_version_id: `eq.${plan.versionId}`, step_order: `eq.${index + 1}` }, { hints: plan.hints[index] });
    requireThat(rows?.length === 1, `${plan.key}: missing step during hint update`);
  }
  state = await readState(client, plan);
  verifyState(state, plan, { completed: true });
  await client.rpc('publish_mission', { _mission_id: plan.missionId, _expected_owner_id: plan.ownerId });
  state = await readState(client, plan);
  verifyState(state, plan, { completed: true });
  requireThat(state.mission.status === 'published' && state.version.published_at, `${plan.key}: publish not confirmed`);
  return 'published';
}

export async function runImport(plans, task, concurrency = 4) {
  requireThat(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 6, 'concurrency must be 1..6');
  let next = 0;
  let failure;
  const results = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (!failure && next < plans.length) {
      const plan = plans[next++];
      try { results.push({ key: plan.key, status: await task(plan) }); }
      catch (error) { failure ??= new Error(`${plan.key}: ${error.message}`); }
    }
  }));
  if (failure) throw failure;
  return results;
}
