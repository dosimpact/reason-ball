import test from 'node:test';
import assert from 'node:assert/strict';
await import('../statistics.js');
const { summarize, compare, histogram, normalDensity, sortVenues } = globalThis.WeddingStats;

test('missing prices are excluded and a genuine zero remains in the population', () => {
  const stats = summarize([null, undefined, NaN, '50000', 0, 50000, 100000]);
  assert.equal(stats.count, 3);
  assert.equal(stats.mean, 50000);
  assert.equal(stats.median, 50000);
  assert.equal(summarize([]).mean, null);
});
test('average savings and empirical cheaper-than percentage remain different', () => {
  const result = compare(50000, [50000, 50000, 100000, 200000]);
  assert.ok(Math.abs(result.cheaperThanPct - 200 / 3) < 1e-9);
  assert.ok(Math.abs(result.savingsPct - 50) < 1e-9);
  assert.equal(result.rank, 1);
  assert.equal(compare(0, [0]).cheaperThanPct, null);
  assert.equal(compare(null, [50000]), null);
});
test('histogram accounts for every observation including domain maximum and repeated prices', () => {
  for (const values of [[100, 100, 100], [0, 1, 1000, 10000000], []]) {
    const graph = histogram(values);
    assert.equal(graph.bins.reduce((sum, bin) => sum + bin.count, 0), values.length);
    assert.ok(graph.upper > graph.lower);
  }
  assert.equal(normalDensity(10, 10, 0), 0);
});
test('unknown prices sort last in either direction', () => {
  const entries = [{name:'unknown',metrics:{mealMin:null}},{name:'low',metrics:{mealMin:1}},{name:'high',metrics:{mealMin:9}}];
  assert.deepEqual(sortVenues(entries,'mealMin').map(v=>v.name),['low','high','unknown']);
  assert.deepEqual(sortVenues(entries,'mealMin','desc').map(v=>v.name),['high','low','unknown']);
});
