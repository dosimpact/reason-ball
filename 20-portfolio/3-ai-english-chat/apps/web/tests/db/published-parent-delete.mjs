import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyPublishedParentDelete(db, ownerId) {
  await db.exec('begin');
  try {
    assert.equal((await db.query('select current_user as role')).rows[0].role, 'postgres');
    await db.query("select set_config('app.immutable_purge', '', true)");
    const character = randomUUID(), version = randomUUID(), mission = randomUUID(), missionVersion = randomUUID();
    async function clone(table, sourceColumn, source, changes) {
      const columns = (await db.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='NEVER' order by ordinal_position", [table])).rows.map(row => row.column_name);
      const values = [source];
      const selects = columns.map(column => {
        if (!(column in changes)) return `source.${column}`;
        values.push(changes[column]);
        return `$${values.length}`;
      });
      await db.query(`insert into public.${table} (${columns.join(',')}) select ${selects.join(',')} from public.${table} source where ${sourceColumn}=$1`, values);
    }
    await clone('characters', 'id', '11111111-1111-4111-8111-111111111111', { id: character, owner_id: ownerId, slug: `cascade-${character}`, status: 'draft', current_version_id: null, published_at: null });
    await clone('character_versions', 'id', '11111111-1111-4111-8111-111111111112', { id: version, character_id: character, published_at: null });
    await clone('character_version_instructions', 'character_version_id', '11111111-1111-4111-8111-111111111112', { character_version_id: version });
    await clone('missions', 'id', '22222222-2222-4222-8222-222222222221', { id: mission, owner_id: ownerId, slug: `cascade-${mission}`, status: 'draft', current_version_id: null, published_at: null });
    await clone('mission_versions', 'id', '22222222-2222-4222-8222-222222222222', { id: missionVersion, mission_id: mission, published_at: null });
    await clone('mission_version_instructions', 'mission_version_id', '22222222-2222-4222-8222-222222222222', { mission_version_id: missionVersion });
    await db.query('insert into public.mission_characters(mission_id,character_id) values ($1,$2)', [mission, character]);
    const reward = randomUUID();
    await db.query(`insert into public.character_assets(id,character_id,character_version_id,asset_type,access_level,storage_bucket,storage_path,mime_type)
      values ($1,$2,$3,'reward','reward','character-private',$4,'image/png')`, [reward, character, version, `${ownerId}/${reward}.png`]);
    await db.query("insert into storage.objects(bucket_id,name) values ('character-private',$1)", [`${ownerId}/${reward}.png`]);
    await db.query('insert into public.mission_rewards(mission_id,mission_version_id,character_asset_id) values ($1,$2,$3)', [mission, missionVersion, reward]);
    await db.query('update public.character_versions set published_at=now() where id=$1', [version]);
    await db.query('update public.mission_versions set published_at=now() where id=$1', [missionVersion]);
    async function denied(sql, values, code = '55000') {
      await db.exec('savepoint blocked_mutation');
      await assert.rejects(() => db.query(sql, values), error => error.code === code);
      await db.exec('rollback to savepoint blocked_mutation');
    }
    for (const [table, id] of [['character_versions',version], ['mission_versions',missionVersion]]) {
      await denied(`update public.${table} set change_summary='forbidden' where id=$1`, [id]);
      await denied(`delete from public.${table} where id=$1`, [id]);
    }
    await denied('delete from public.character_assets where id=$1', [reward]);
    // Published mission reward/assignment still protects the character parent.
    await db.exec('savepoint protected_parent');
    await assert.rejects(() => db.query('delete from public.characters where id=$1', [character]), error => ['55000','23503'].includes(error.code));
    await db.exec('rollback to savepoint protected_parent');
    const conversation = randomUUID();
    await db.query(`insert into public.conversations(id,owner_id,character_id,character_version_id,mission_id,mission_version_id,model_id)
      values ($1,$2,$3,$4,$5,$6,'test-model')`, [conversation,ownerId,character,version,mission,missionVersion]);
    // Existing paired mission snapshot CHECK rejects ON DELETE SET NULL before
    // its version FK can be removed; deleting an in-use parent stays forbidden.
    await denied('delete from public.missions where id=$1', [mission], '23514');
    await db.query('delete from public.conversations where id=$1', [conversation]);
    await db.query('delete from public.missions where id=$1', [mission]);
    assert.equal((await db.query('select id from public.mission_versions where id=$1', [missionVersion])).rows.length, 0);
    await db.query('delete from public.characters where id=$1', [character]);
    assert.equal((await db.query('select id from public.character_versions where id=$1', [version])).rows.length, 0);
    assert.equal((await db.query('select id from public.character_assets where id=$1', [reward])).rows.length, 0);
    console.log('Published parent cascade PASS: postgres FK cleanup, direct mutation blocked, surviving mission reward protected');
  } finally { await db.exec('rollback'); }
}
