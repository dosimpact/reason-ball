import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyMissionCatalogProjection(db, { ownerId, expectDatabaseError }) {
  const id = randomUUID();
  const version = randomUUID();
  await db.query("insert into public.missions(id,owner_id,slug,title,scenario_category) values($1,$2,$3,'Projection','daily')", [id,ownerId,`projection-${id}`]);
  await db.query(`insert into public.mission_versions(id,mission_id,version_number,learning_goals,scenario_context,learner_role,character_role,opening_instruction)
    values($1,$2,1,'["Ask"]','Context','Learner','Partner','Hello')`, [version,id]);
  await db.query("insert into public.mission_version_instructions(mission_version_id,director_prompt,evaluator_prompt) values($1,'private-director','private-evaluator')", [version]);
  const read = async () => (await db.query('select evaluator_config from public.mission_catalog_instruction_fields where mission_version_id=$1', [version])).rows[0].evaluator_config;
  const write = (config) => db.query('update public.mission_version_instructions set evaluator_config=$1 where mission_version_id=$2', [JSON.stringify(config),version]);
  const hidden = { catalogImport: { source: { private: 'x'.repeat(100_000) } }, secretPolicy: 'Private rules' };
  await write(hidden);
  assert.deepEqual(await read(), {});
  await write({ ...hidden, prerequisites: null, objectives: null, catalogDisplay: null });
  assert.deepEqual(await read(), { prerequisites: null, objectives: null, catalogDisplay: null });
  const publicFields = { prerequisites: ['mission-key'], objectives: [{ id: 'ask', label: 'Ask', hint: 'Hint' }], catalogDisplay: { location: '일상 · 쇼핑', description: '문제\n다음 행동' } };
  await write({ ...hidden, ...publicFields });
  assert.deepEqual(await read(), publicFields);
  for (const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    try { await expectDatabaseError(() => db.query('select * from public.mission_catalog_instruction_fields'), '42501'); }
    finally { await db.exec('reset role'); }
  }
  const privileges = (await db.query("select has_table_privilege('service_role','public.mission_catalog_instruction_fields','select') as readable, has_table_privilege('service_role','public.mission_catalog_instruction_fields','insert') as writable")).rows[0];
  assert.deepEqual(privileges, { readable: true, writable: false });
  const options = (await db.query("select reloptions from pg_class where oid='public.mission_catalog_instruction_fields'::regclass")).rows[0].reloptions;
  assert.ok(options.includes('security_invoker=true'));
  console.log('Mission catalog projection PASS: three-field whitelist, missing/null distinction, source exclusion, invoker view and browser grants');
}
