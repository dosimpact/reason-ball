import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateShape } from './validate-catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/missions');
const levels = ['pre-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const durations = [5, 7, 10, 12, 15, 18, 20];
const researchIds = ['CEFR-2020', 'TBLT-2019', 'TBLT-CRITIQUE', 'SPACING-2022', 'RETRIEVAL-2008', 'FEEDBACK-2010', 'FOUR-STRANDS-2007'];
const serialize = value => `${JSON.stringify(value, null, 2)}\n`;
const ensure = (condition, message) => { if (!condition) throw new Error(message); };

export function missionKey(categoryId, seed) {
  if (categoryId === 'travel' && seed.subcategoryId === 'hotel' && seed.difficulty === 'A2' && seed.slug === 'check-in') return 'hotel-check-in-001';
  return `${categoryId}-${seed.subcategoryId}-${seed.difficulty.toLowerCase()}-${seed.slug}`;
}

export function compileMission(categoryId, seed, levelPolicy) {
  const key = missionKey(categoryId, seed);
  const firstGoal = seed.steps[0].goal;
  return {
    $schema: '../../../mission.schema.json', schemaVersion: 1,
    key, title: seed.title, categoryId, subcategoryId: seed.subcategoryId, difficulty: seed.difficulty,
    scenario: seed.scenario, practicalOutcome: seed.outcome,
    roles: { learner: seed.learnerRole, interlocutor: seed.interlocutorRole },
    ...(seed.caseBrief ? { caseBrief: structuredClone(seed.caseBrief) } : {}),
    opening: seed.opening, estimatedMinutes: durations[levels.indexOf(seed.difficulty)],
    prerequisites: [],
    steps: seed.steps.map((step, index) => ({
      id: `step-${index + 1}`, goal: step.goal, example: step.example,
      hints: [`의도: ${step.goal}`, `핵심 표현: ${step.cue}`, `완성 문장 예시: ${step.example} — 의미가 같은 다른 표현도 가능합니다.`],
      successCriterion: `상대가 이해할 수 있게 다음 행동을 수행한다: ${step.goal}. 예문과 단어가 같아야 하는 것은 아니다.`,
    })),
    pedagogy: {
      researchIds,
      supportFade: `${levelPolicy.scaffolding}. 먼저 상황과 첫 발화의 뜻을 확인하고 ${firstGoal}에 필요한 표현을 살핀다. 의도→핵심 표현→완성 문장 순으로 필요한 도움만 제공한다. 두 번째 시도는 완성 문장을 가리고, 세 번째는 힌트를 가린다. 막히면 도움을 다시 제공하고 도움받은 수행과 독립 수행을 구분한다.`,
      retrieval: `예문을 가린 뒤 '${seed.title}' 상황에서 ${seed.outcome} 기억한 문장을 그대로 외우기보다 상대의 질문에 맞춰 자신의 말로 응답한다.`,
      transfer: seed.transfer,
      review: { intervalDays: [1, 3, 7, 21], prompt: `복습 간격은 초기 운영 가설이며 성공과 어려움에 따라 조정한다. '${seed.title}'을 무힌트로 다시 수행한다. 이어서 조건을 바꾼다: ${seed.transfer} 결과와 도움 사용을 따로 기록한다.` },
    },
    assessment: {
      criteria: [...new Set([seed.outcome, ...seed.steps.map(step => step.goal), ...(seed.caseBrief?.resolutionCriteria ?? []), `수준별 관찰: ${levelPolicy.communicativeDemand}. 문법 오류 수나 희귀 단어만으로 판정하지 않는다.`])],
      acceptParaphrases: true,
      feedbackPolicy: '먼저 전달된 의미와 달성한 과업을 짚는다. 의미 전달을 막는 오류 한두 개에 짧은 한국어 설명과 재표현 기회를 제공한다. 초보가 막히면 예시를 보여준 뒤 다시 시도하게 한다. 도움받은 완료를 독립 숙달로 판정하지 않고 조건 변경 및 지연 수행을 별도로 확인한다. 텍스트만으로 발음·청취 성공을 판정하지 않는다.',
    },
  };
}

function validateSeed(seed, category) {
  const fields = ['subcategoryId', 'difficulty', 'slug', 'title', 'scenario', 'learnerRole', 'interlocutorRole', 'opening', 'steps', 'outcome', 'transfer'];
  ensure(seed && typeof seed === 'object', 'mission seed must be an object');
  ensure(Object.keys(seed).every(key => fields.includes(key) || key === 'caseBrief'), `unknown authoring field: ${seed.slug}`);
  for (const field of fields.filter(field => field !== 'steps')) ensure(typeof seed[field] === 'string' && seed[field].trim(), `${seed.slug}: missing ${field}`);
  ensure(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(seed.slug), `invalid slug: ${seed.slug}`);
  ensure(category.subcategories.some(item => item.id === seed.subcategoryId), `unknown subcategory: ${seed.subcategoryId}`);
  ensure(levels.includes(seed.difficulty), `unknown level: ${seed.difficulty}`);
  ensure(Array.isArray(seed.steps) && seed.steps.length >= 3, `${seed.slug}: at least three authored steps required`);
  for (const step of seed.steps) {
    ensure(Object.keys(step).length === 3 && ['goal', 'example', 'cue'].every(field => typeof step[field] === 'string' && step[field].trim()), `${seed.slug}: invalid authored step`);
  }
}

async function loadJson(file) { return JSON.parse(await readFile(join(root, file), 'utf8')); }

export function buildLearningPaths(bodies, categories, curriculum) {
  const foundationKeys = [
    'social-introductions-pre-a1-say-your-name', 'social-introductions-pre-a1-spell-short-name',
    'daily-health-pre-a1-reception-name', 'daily-health-pre-a1-repeat-question',
    'daily-services-pre-a1-help-counter', 'daily-food-drink-pre-a1-water',
    'daily-food-drink-pre-a1-point-menu', 'daily-shopping-pre-a1-price',
    'daily-shopping-pre-a1-size', 'daily-housing-pre-a1-room-number',
  ];
  const available = new Set(bodies.map(body => body.key));
  return {
    schemaVersion: 1,
    purpose: '완전 입문 진입과 관심 영역별 단계적 연습을 위한 저작용 추천 경로. 앱 잠금·CEFR 인증이 아니다.',
    entry: {
      title: '영어를 처음 만나는 사람의 첫 10개 과업',
      instructions: [
        '한국어 상황과 목표부터 읽는다. 영어를 읽을 수 없어도 힌트의 뜻을 보고 짧은 모델을 선택·복사해 시작할 수 있다.',
        '먼저 한 단어, yes/no, 부탁 표현을 사용한다. 막히면 도움·반복·속도 조절을 요청한다.',
        '이름 Min은 M(엠)·I(아이)·N(엔)으로 한 글자씩 확인한다. 숫자는 one=1, two=2, five=5, ten=10, twelve=12를 한국어 뜻과 함께 보고 시작한다. 한글 소리 표기는 시작용 보조이며 영어 발음 평가 기준이 아니다.',
        '가리키기는 실제 사진이 없다면 [가리키기: 물건 이름 또는 번호]라는 한국어 보조 행동으로 대체한다. 사진을 봤다고 판정하지 않는다.',
        '지원된 시도 후 영어 예문을 가리고 같은 의도를 다시 전달한다. 복사 성공을 독립 수행으로 기록하지 않는다.',
        '발음·알파벳 소리·듣기는 별도의 검증된 음성 자료가 필요하다. 이 텍스트 경로는 문자·소리 수업을 완전히 대신하지 않는다.',
      ],
      missionKeys: foundationKeys.filter(key => available.has(key)),
    },
    advancement: {
      method: '관심 영역에서 시작 수준을 고르고 필요한 만큼 아래 수준으로 돌아간다. 영역별 능력이 다를 수 있다.',
      recommendedEvidence: '서로 다른 과업 두 개 이상을 무힌트로 수행하고, 조건 변경과 지연 재수행에서 의미 전달을 확인한 뒤 다음 수준을 시도한다.',
      status: '진급 기준은 검증 전 운영 가설이며 자동 CEFR 판정이 아니다.',
      prerequisitesAreHardGates: false,
    },
    tracks: categories.categories.flatMap(category => category.subcategories.map(sub => ({
      id: `${category.id}-${sub.id}`, title: `${category.name} · ${sub.name}`,
      categoryId: category.id, subcategoryId: sub.id,
      stages: curriculum.levels.map(level => ({
        difficulty: level.id, goal: level.communicativeDemand,
        missionKeys: bodies.filter(body => body.categoryId === category.id && body.subcategoryId === sub.id && body.difficulty === level.id).map(body => body.key),
      })),
    }))),
    professionalTracks: (curriculum.specializationCoverage?.tracks ?? []).map(track => ({
      role: track.role, title: track.title,
      entryRequirement: '일반 영어 기초를 먼저 연습하거나 필요한 힌트를 사용한다. 직무 경험·관리자 권한을 실제로 보유할 필요는 없다.',
      stages: (curriculum.specializationCoverage?.levels ?? []).map(level => ({
        difficulty: level,
        missionKeys: bodies.filter(body => body.difficulty === level && body.caseBrief?.professionalRole === track.role).map(body => body.key),
      })),
    })),
  };
}

async function buildOutputs() {
  const [categories, curriculum, schema] = await Promise.all([loadJson('categories.json'), loadJson('curriculum.json'), loadJson('mission.schema.json')]);
  const outputs = new Map();
  const bodies = [];
  for (const category of categories.categories) {
    let source;
    try { source = await loadJson(`authoring/${category.id}.json`); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    ensure(source.schemaVersion === 1 && source.categoryId === category.id && Array.isArray(source.missions), `invalid source ${category.id}`);
    const seeds = [...source.missions];
    for (const track of curriculum.specializationCoverage?.categoryId === category.id ? curriculum.specializationCoverage.tracks : []) {
      ensure(/^authoring\/work-[a-z-]+\.json$/.test(track.source), `invalid source path ${track.source}`);
      let extra;
      try { extra = await loadJson(track.source); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      ensure(extra.schemaVersion === 1 && extra.categoryId === category.id && Array.isArray(extra.missions), `invalid source ${track.source}`);
      for (const seed of extra.missions) ensure(seed.caseBrief?.professionalRole === track.role, `${track.source}: role mismatch`);
      seeds.push(...extra.missions);
    }
    const keys = new Set();
    const entries = seeds.map(seed => {
      validateSeed(seed, category);
      const body = compileMission(category.id, seed, curriculum.levels.find(level => level.id === seed.difficulty));
      validateShape(body, schema, body.key);
      bodies.push(body);
      ensure(!keys.has(body.key), `duplicate authoring key: ${body.key}`);
      keys.add(body.key);
      const file = `content/${category.id}/${seed.subcategoryId}/${body.key}.json`;
      outputs.set(file, serialize(body));
      return { key: body.key, title: body.title, categoryId: body.categoryId, subcategoryId: body.subcategoryId, difficulty: body.difficulty, authoringStatus: 'draft', file, tags: [category.subcategories.find(item => item.id === seed.subcategoryId).name, seed.difficulty, '실생활 과업', ...(seed.caseBrief ? [seed.caseBrief.professionalRole, '문제 해결', '비즈니스 소통'] : [])] };
    });
    const existing = await loadJson(`${category.id}/catalog.json`);
    for (const item of existing.missions) ensure(keys.has(item.key), `refusing to drop existing key ${item.key}`);
    outputs.set(`${category.id}/catalog.json`, serialize({ $schema: '../category-catalog.schema.json', schemaVersion: 1, categoryId: category.id, missions: entries }));
  }
  ensure(outputs.size > 0, 'no authored missions found');
  outputs.set('learning-paths.json', serialize(buildLearningPaths(bodies, categories, curriculum)));
  return outputs;
}

async function main() {
  const check = process.argv.includes('--check');
  ensure(process.argv.slice(2).every(arg => arg === '--check'), 'usage: compile-catalog.mjs [--check]');
  const outputs = await buildOutputs();
  for (const [file, content] of outputs) {
    const target = join(root, file);
    if (check) ensure(await readFile(target, 'utf8') === content, `generated content differs: ${file}`);
    else { await mkdir(dirname(target), { recursive: true }); await writeFile(target, content); }
  }
  console.log(`${check ? 'Verified' : 'Compiled'} ${outputs.size} catalog/body files; authoring status remains draft.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
