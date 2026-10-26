/*
 * 실행 중인 프런트엔드·Python 서버·실제 OpenAI를 연결해 문서 비교와 대화 저장을 검사합니다.
 * 검증용 대화는 남기고 폐기용 대화만 삭제하며 결과를 output/validation에 저장합니다.
 */
/** Real-provider document comparison test against running owned servers. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const base = process.env.CHAT_TEST_URL || 'http://127.0.0.1:3049';
const output = new URL('../output/validation/', import.meta.url);
await mkdir(output, {recursive:true});
async function api(path, method='GET', body) {
  const response = await fetch(`${base}/api/${path}`, {method,
    headers:{'Content-Type':'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(180000)});
  assert.ok(response.ok, `${path}: ${response.status} ${await (!response.ok ? response.text() : Promise.resolve(''))}`);
  return response;
}
const catalog = await (await api('documents')).json();
assert.equal(catalog.documents.length, 3);
assert.ok(catalog.documents.every(d=>d.passages>0));
const question = {role:'user', content:'Compare latest total revenue and revenue growth across NVIDIA, AMD and Intel. Cite pages and include a chart.'};
const thread = await (await api('threads/create','POST',{messages:[question]})).json();
async function chat(name, question, searchRequired) {
  const response = await api('chat','POST',{threadId:thread.id,messages:[question]});
  const raw=await response.text();
  await writeFile(new URL(`${name}.sse`,output), raw);
  const events=raw.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>JSON.parse(x.slice(5)));
  assert.equal(events[0]?.type,'RUN_STARTED');
  assert.ok(!events.some(x=>x.type==='RUN_ERROR'),JSON.stringify(events.filter(x=>x.type==='RUN_ERROR')));
  assert.equal(events.at(-1)?.type,'RUN_FINISHED');
  const text=events.filter(x=>x.type==='TEXT_MESSAGE_CONTENT').map(x=>x.delta).join('');
  assert.match(text,/root\s*=/);
  if(searchRequired) {
    assert.ok(events.some(x=>x.type==='TOOL_CALL_START' && x.toolCallName==='search_documents'));
    const results=events.filter(x=>x.type==='TOOL_CALL_RESULT').map(x=>JSON.parse(x.content));
    assert.ok(results.some(x=>x.results?.some(r=>r.found && r.passages[0]?.page>0)));
    assert.match(text,/#page=/);
  }
  console.log(`${name}: PASS (${text.length} chars)`);
  return text;
}
await chat('document-revenue',question,true);
const saved=await (await api(`threads/get/${thread.id}`)).json();
assert.ok(saved.some(m=>m.role==='tool'));
await chat('document-followup',{role:'user',content:'For those same companies, compare R&D spending too. Cite the pages.'},true);
const final=await (await api(`threads/get/${thread.id}`)).json();
assert.ok(final.length>saved.length);
await api(`threads/update/${thread.id}`,'PATCH',{title:'검증: 매출과 R&D 비교'});
const listed=await (await api('threads/get')).json();
assert.ok(listed.threads.some(t=>t.id===thread.id && t.title==='검증: 매출과 R&D 비교'));
// Delete only a disposable thread; retain the verified comparison for browser review.
const disposable=await (await api('threads/create','POST',{messages:[{role:'user',content:'delete test'}]})).json();
await api(`threads/delete/${disposable.id}`,'DELETE');
assert.equal((await fetch(`${base}/api/threads/get/${disposable.id}`)).status,404);
for(const body of ['{',JSON.stringify({messages:[]})]) {
 const r=await fetch(`${base}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body});
 assert.equal(r.status,400);
}
await writeFile(new URL('smoke-result.json',output),JSON.stringify({result:'PASS',threadId:thread.id,checkedAt:new Date().toISOString(),documents:catalog.documents.map(d=>({id:d.id,pages:d.pages,passages:d.passages})),savedMessages:final.length},null,2));
console.log(`PASS: document list, actual retrieval, cited response, follow-up, history, rename/delete; retained ${thread.id}`);
