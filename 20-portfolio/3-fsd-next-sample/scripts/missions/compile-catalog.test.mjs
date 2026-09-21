import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileMission, missionKey, buildLearningPaths } from './compile-catalog.mjs';
import { validateShape } from './validate-catalog.mjs';

const schema = JSON.parse(await readFile(new URL('../../assets/missions/mission.schema.json', import.meta.url), 'utf8'));
const seed = {
  subcategoryId: 'meetings', difficulty: 'B1', slug: 'developer-delayed-review', title: '리뷰 지연 해결하기',
  scenario: '리뷰가 늦어 출시 일정이 위험하다.', learnerRole: '개발자', interlocutorRole: '리뷰어', opening: 'I cannot review this today.',
  steps: [{ goal: '지연 영향 설명하기', example: 'The release is tomorrow.', cue: 'release = 출시' }, { goal: '가능 시간 묻기', example: 'When can you review it?', cue: 'review = 검토' }, { goal: '다음 행동 합의하기', example: 'Let us update the release owner.', cue: 'owner = 담당자' }],
  outcome: '리뷰 일정과 후속 안내를 합의한다.', transfer: '검토 범위가 커지면 출시 담당자에게 미결정을 올린다.',
  caseBrief: { professionalRole: 'developer', situation: '출시 전 리뷰 시간이 없다.', facts: ['출시는 내일이다.'], constraints: ['리뷰 없이 출시하지 않는다.'], learnerAuthority: '리뷰 요청과 상태 공유 가능', counterpartPosition: '오늘 일정이 꽉 찼다.', unresolvedQuestions: ['대체 리뷰어가 있는가?'], deliverable: '담당자와 시한이 있는 다음 행동', resolutionCriteria: ['검토 가능한 시각 확인', '출시 담당자에게 미결정 공유'], escalationPath: '일정 미합의는 출시 담당자에게 전달한다.' },
};
const level = { scaffolding: '필요할 때 핵심 표현을 제공한다', communicativeDemand: '이유를 설명하고 문제를 해결한다' };

test('professional case preserves facts and assesses agreed next actions', () => {
  const body = compileMission('work', seed, level);
  validateShape(body, schema);
  assert.deepEqual(body.caseBrief, seed.caseBrief);
  assert(body.assessment.criteria.includes(seed.caseBrief.resolutionCriteria[1]));
  assert.equal(body.assessment.acceptParaphrases, true);
});
test('case cannot omit decision authority or escalation route', () => {
  for (const field of ['learnerAuthority', 'escalationPath', 'unresolvedQuestions']) {
    const body = compileMission('work', seed, level);
    delete body.caseBrief[field];
    assert.throws(() => validateShape(body, schema), /required/);
  }
});
test('compiled case data does not mutate authoring input', () => {
  const before = JSON.stringify(seed);
  const body = compileMission('work', seed, level);
  body.caseBrief.facts.push('추가 사실');
  assert.equal(JSON.stringify(seed), before);
});
test('original hotel identity is preserved', () => {
  assert.equal(missionKey('travel', { subcategoryId: 'hotel', difficulty: 'A2', slug: 'check-in' }), 'hotel-check-in-001');
});
test('professional track routes by role and level instead of source order', () => {
  const body = compileMission('work', seed, level);
  const paths = buildLearningPaths([body], { categories: [{ id: 'work', name: '업무', subcategories: [{ id: 'meetings', name: '회의' }] }] }, { levels: [{ id: 'B1', communicativeDemand: '문제 해결' }], specializationCoverage: { levels: ['A2', 'B1'], tracks: [{ role: 'developer', title: '개발자' }, { role: 'designer', title: '디자이너' }] } });
  assert.deepEqual(paths.professionalTracks[0].stages.map(stage => stage.missionKeys), [[], [body.key]]);
  assert.deepEqual(paths.professionalTracks[1].stages.map(stage => stage.missionKeys), [[], []]);
});
