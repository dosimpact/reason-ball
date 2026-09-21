import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyGuestMissionBrowsing(db, { expectDatabaseError }) {
  const guest = randomUUID();
  await db.query('insert into auth.users(id,is_anonymous) values($1,true)', [guest]);
  const visible = (await db.query("select id,current_version_id from public.missions where status='published' and visibility='public' order by id")).rows;
  assert.ok(visible.length > 5);
  const setClaims = (sub, extra = {}) => db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub, ...extra })]);
  async function verifyRead(role, sub) {
    await setClaims(sub, { is_anonymous: true });
    await db.exec(`set role ${role}`);
    try {
      assert.deepEqual((await db.query('select id,current_version_id from public.missions order by id')).rows, visible);
      const target = visible.find(row => row.current_version_id);
      assert.equal((await db.query('select count(*)::int n from public.mission_versions where id=$1', [target.current_version_id])).rows[0].n, 1);
      assert.ok((await db.query('select count(*)::int n from public.mission_steps where mission_version_id=$1', [target.current_version_id])).rows[0].n > 0);
      await expectDatabaseError(() => db.query('select * from public.mission_version_instructions'), '42501');
    } finally { await db.exec('reset role'); }
  }
  await verifyRead('anon', null);
  await verifyRead('authenticated', guest);
  // Browsing must not create assignments or grant a guest membership/management.
  assert.equal((await db.query('select count(*)::int n from public.mission_assignments where user_id=$1', [guest])).rows[0].n, 0);
  await expectDatabaseError(() => db.query("insert into public.conversations(owner_id,mission_id,mission_version_id,model_id) values($1,$2,$3,'test')", [guest,visible[0].id,visible[0].current_version_id]), '42501');
  // Conversion must close full browsing immediately, even with a stale guest JWT.
  await db.query('update auth.users set is_anonymous=false where id=$1', [guest]);
  await setClaims(guest, { is_anonymous: true, user_metadata: { is_anonymous: true } });
  await db.exec('set role authenticated');
  try { assert.equal((await db.query('select count(*)::int n from public.missions')).rows[0].n, 0); }
  finally { await db.exec('reset role'); }
  console.log('Guest mission browsing PASS: public-only anon/anonymous access, child visibility, private instructions denied, start guard preserved, converted member cannot use stale claims');
}
