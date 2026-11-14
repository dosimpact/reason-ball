// Opt-in: publishes selected modeling stages for the three agreed real filings.
// Preserves all source rows, previous generations, and run history.
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const base = process.env.SEC_MODELING_BFF_URL || 'http://127.0.0.1:3980/api/sec/modeling';
const stages = (process.env.SEC_MODELING_STAGES || '1,3').split(',').map(Number);
if (stages.some(stage => ![1, 2, 3].includes(stage))) throw new Error('This live verification supports stages 1, 2, and 3 only');
const waitSeconds = Number(process.env.SEC_MODELING_WAIT_SECONDS || (stages.includes(2) ? 3600 : 600));
if (!Number.isInteger(waitSeconds) || waitSeconds < 1 || waitSeconds > 7200) throw new Error('SEC_MODELING_WAIT_SECONDS must be 1..7200');
const knownFilings = [['0000320193','0000320193-26-000026'],['0001834584','0001834584-26-000024'],['0001045810','0001045810-26-000021']];
const selectedCiks = process.env.SEC_MODELING_CIKS?.split(',').map(cik => cik.padStart(10, '0'));
if (selectedCiks?.some(cik => !knownFilings.some(([known]) => known === cik))) throw new Error('SEC_MODELING_CIKS must select the three agreed fixtures');
const filings = knownFilings.filter(([cik]) => !selectedCiks || selectedCiks.includes(cik));
async function request(route, body) {
  const res = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  return data;
}
async function wait(id) {
  for (let i = 0; i < Math.ceil(waitSeconds / 2); i++) {
    const run = await request(`/runs/${id}`);
    if (!['QUEUED', 'RUNNING'].includes(run.status)) return run;
    await delay(2000);
  }
  throw new Error(`Run ${id} did not settle within ${waitSeconds} seconds`);
}
(async () => {
  for (const stage of stages) for (const [cik, accession] of filings) {
    const history = await request(`/runs?cik=${cik}&accessionNo=${accession}`);
    let run = history.items.find(item => item.stage === stage && ['QUEUED', 'RUNNING'].includes(item.status));
    if (!run) run = await request(`/filings/${cik}/${accession}/model-${stage}/runs`, {});
    run = await wait(run.runId);
    if (['FAILED', 'CANCELLED'].includes(run.status)) run = await wait((await request(`/runs/${run.id}/retry`, {})).runId);
    assert.equal(run.status, 'SUCCEEDED', JSON.stringify(run.error));
    if (stage === 2) {
      const expectedChunks = { '0000320193': 163, '0001834584': 516, '0001045810': 194 };
      assert.equal(run.counts.Source, 23);
      assert.equal(run.counts.Chunk, expectedChunks[cik]);
      for (const kind of ['Topic','Statement','Fact','Entity']) assert.ok(run.counts[kind] > 0);
      assert.ok(run.inputGenerationId);
      assert.equal(run.workUnitsTotal, expectedChunks[cik] + 23);
      assert.equal(run.workUnits.length, run.workUnitsTotal);
      assert.equal(run.workUnitsTruncated, false);
      assert.ok(run.workUnits.every(unit => unit.status === 'SUCCEEDED'), 'No unfinished units under a successful run');
    }
    const result = await request(`/filings/${cik}/${accession}/results/${stage}?limit=1`);
    assert.ok(result.total > 0); assert.equal(result.generationId, run.outputGenerationId);
    console.log(JSON.stringify({ cik, accession, stage, runId: run.id, generationId: result.generationId, counts: run.counts, total: result.total }));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
