import assert from "node:assert/strict";

export async function verifyArtifactRevisions(db, { ownerId, reporterId, conversationId, expectDatabaseError }) {
  const artifact = "62000000-0000-4000-8000-000000000001";
  const first = "63000000-0000-4000-8000-000000000001";
  const second = "63000000-0000-4000-8000-000000000002";
  const third = "63000000-0000-4000-8000-000000000003";
  const body = { kind: "text", title: "First title", contentText: "first", status: "draft" };
  const commit = (request, base, payload, owner = ownerId) => db.query(
    "select public.commit_artifact_revision($1,$2,$3,$4,$5,$6::jsonb) as id",
    [request, artifact, owner, conversationId, base, JSON.stringify(payload)],
  );
  await expectDatabaseError(() => commit(first, null, body, reporterId), "42501");
  assert.equal((await commit(first, null, body)).rows[0].id, first);
  await commit(first, null, body);
  await expectDatabaseError(() => commit(first, null, { ...body, title: "Changed input" }), "40001");
  assert.equal((await db.query("select count(*)::int as n from public.artifact_versions where artifact_id=$1", [artifact])).rows[0].n, 1);

  // A title mutation is rolled back when the version content is invalid.
  await expectDatabaseError(() => commit(second, first, { title: "Must roll back" }), "23514");
  assert.equal((await db.query("select title from public.artifacts where id=$1", [artifact])).rows[0].title, body.title);
  const edit = { title: "Renamed", contentText: "second", status: "draft" };
  await commit(second, first, edit);
  await commit(second, first, edit); // Lost response, same request and old base.
  await expectDatabaseError(() => commit(third, first, { ...edit, contentText: "stale edit" }), "40001");
  await expectDatabaseError(() => commit(second, second, edit), "40001");
  await expectDatabaseError(() => commit(third, second, edit, reporterId), "42501");
  const snapshot = await db.query(`select a.title, a.current_version_id,
    (select count(*)::int from public.artifact_versions v where v.artifact_id=a.id) as versions
    from public.artifacts a where a.id=$1`, [artifact]);
  assert.deepEqual(snapshot.rows[0], { title: "Renamed", current_version_id: second, versions: 2 });

  // Earlier creation can be replayed after later versions without resetting them.
  await commit(first, null, body);
  assert.equal((await db.query("select current_version_id from public.artifacts where id=$1", [artifact])).rows[0].current_version_id, second);
  await db.query("update public.artifacts set status='archived' where id=$1", [artifact]);
  await expectDatabaseError(() => commit(third, second, edit), "55000");
  await db.query("update public.artifacts set status='draft' where id=$1", [artifact]);
  await db.query("update public.conversations set status='deleted' where id=$1", [conversationId]);
  await expectDatabaseError(() => commit(third, second, edit), "42501");
  await db.query("update public.conversations set status='active' where id=$1", [conversationId]);

  const permissions = await db.query(`select
    has_function_privilege('authenticated','public.commit_artifact_revision(uuid,uuid,uuid,uuid,uuid,jsonb)','execute') as browser_commit,
    has_function_privilege('service_role','public.commit_artifact_revision(uuid,uuid,uuid,uuid,uuid,jsonb)','execute') as server_commit,
    has_table_privilege('authenticated','public.artifact_revision_requests','select') as browser_replay`);
  assert.deepEqual(permissions.rows[0], { browser_commit: false, server_commit: true, browser_replay: false });

  const imageArtifact = "62000000-0000-4000-8000-000000000002";
  const imageFirst = "64000000-0000-4000-8000-000000000001";
  const imageSecond = "64000000-0000-4000-8000-000000000002";
  const objectPath = `${ownerId}/${imageArtifact}/image.png`;
  await db.query("insert into storage.objects(bucket_id,name,owner_id) values ('artifact-images',$1,$2)", [objectPath, ownerId]);
  const saveImage = (request, base, payload) => db.query(
    "select public.commit_artifact_revision($1,$2,$3,$4,$5,$6::jsonb)",
    [request, imageArtifact, ownerId, conversationId, base, JSON.stringify(payload)],
  );
  await saveImage(imageFirst, null, { kind: "image", title: "Scene", contentText: "Prompt" });
  await saveImage(imageSecond, imageFirst, { contentText: "Prompt", storageBucket: "artifact-images", storagePath: objectPath });
  await expectDatabaseError(() => saveImage(third, imageSecond, { contentText: "Changed", contentJson: { imageUrl: "https://untrusted.example/image.png" } }), "23514");
  await expectDatabaseError(() => saveImage(third, imageSecond, { contentText: "Changed", storageBucket: "chat-attachments", storagePath: objectPath }), "23514");
  assert.equal((await db.query("select storage_path from public.artifact_versions where id=$1", [imageSecond])).rows[0].storage_path, objectPath);
  await expectDatabaseError(() => saveImage(third, imageSecond, { contentText: "Changed", storageBucket: "artifact-images", storagePath: `${reporterId}/${imageArtifact}/image.png` }), "23514");
  await expectDatabaseError(() => saveImage(third, imageSecond, { contentText: "Changed", storageBucket: "artifact-images", storagePath: `${ownerId}/${artifact}/image.png` }), "23514");
  await expectDatabaseError(() => saveImage(third, imageSecond, { contentText: "Changed", storageBucket: "artifact-images", storagePath: `${ownerId}/${imageArtifact}/missing.png` }), "23514");
  assert.equal((await db.query("select public from storage.buckets where id='artifact-images'")).rows[0].public, false);

  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: ownerId })]);
  await db.exec("set role authenticated");
  assert.equal((await db.query("select count(*)::int as n from storage.objects where bucket_id='artifact-images'")).rows[0].n, 0);
  await expectDatabaseError(() => db.query("insert into storage.objects(bucket_id,name,owner_id) values ('artifact-images',$1,$2)", [`${ownerId}/${imageArtifact}/browser.png`, ownerId]), "42501");
  assert.equal((await db.query("update storage.objects set metadata='{}' where bucket_id='artifact-images' returning id")).rows.length, 0);
  assert.equal((await db.query("delete from storage.objects where bucket_id='artifact-images' returning id")).rows.length, 0);
  await db.exec("reset role");
}
