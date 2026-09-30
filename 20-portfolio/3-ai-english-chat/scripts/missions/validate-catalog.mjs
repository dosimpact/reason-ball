import { readFile, readdir } from 'node:fs/promises';
import { resolve, join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/missions');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };

// Deliberately bounded interpreter for the checked-in schemas, not a general JSON Schema engine.
export function validateShape(value, schema, path = '$') {
  const allowed = new Set(['$schema', 'title', 'description', 'type', 'additionalProperties', 'required', 'properties', 'items', 'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'const', 'enum', 'oneOf', 'allOf', 'if', 'then']);
  for (const keyword of Object.keys(schema)) requireThat(allowed.has(keyword), `${path}: unsupported schema keyword ${keyword}`);
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(branch => { try { validateShape(value, branch, path); return true; } catch { return false; } });
    requireThat(matches.length === 1, `${path}: must match exactly one shape`);
  }
  for (const branch of schema.allOf ?? []) validateShape(value, branch, path);
  if (schema.if) {
    let matches = true;
    try { validateShape(value, schema.if, path); } catch { matches = false; }
    if (matches && schema.then) validateShape(value, schema.then, path);
  }
  if ('const' in schema) requireThat(same(value, schema.const), `${path}: unexpected constant`);
  if (schema.enum) requireThat(schema.enum.some(item => same(value, item)), `${path}: invalid enum value`);
  if (schema.type) {
    const matches = schema.type === 'null' ? value === null : schema.type === 'array' ? Array.isArray(value) : schema.type === 'integer' ? Number.isInteger(value) : schema.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) : typeof value === schema.type;
    requireThat(matches, `${path}: expected ${schema.type}`);
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) requireThat(Object.hasOwn(value, key), `${path}.${key}: required`);
    for (const [key, child] of Object.entries(value)) {
      if (schema.additionalProperties === false) requireThat(Object.hasOwn(schema.properties ?? {}, key), `${path}.${key}: unknown property`);
      if (schema.properties?.[key]) validateShape(child, schema.properties[key], `${path}.${key}`);
    }
  }
  if (typeof value === 'string') {
    requireThat(schema.minLength === undefined || value.trim().length >= schema.minLength, `${path}: empty/short text`);
    requireThat(schema.maxLength === undefined || value.length <= schema.maxLength, `${path}: text too long`);
    requireThat(!schema.pattern || new RegExp(schema.pattern).test(value), `${path}: invalid format`);
  }
  if (typeof value === 'number') {
    requireThat(schema.minimum === undefined || value >= schema.minimum, `${path}: below minimum`);
    requireThat(schema.maximum === undefined || value <= schema.maximum, `${path}: above maximum`);
  }
  if (Array.isArray(value)) {
    requireThat(schema.minItems === undefined || value.length >= schema.minItems, `${path}: too few items`);
    requireThat(schema.maxItems === undefined || value.length <= schema.maxItems, `${path}: too many items`);
    if (schema.uniqueItems) requireThat(new Set(value.map(item => JSON.stringify(item))).size === value.length, `${path}: duplicate items`);
    if (schema.items) value.forEach((child, index) => validateShape(child, schema.items, `${path}[${index}]`));
  }
}

async function readJson(root, file) {
  try { return JSON.parse(await readFile(join(root, file), 'utf8')); }
  catch (error) { throw new Error(`${file}: ${error.message}`); }
}
const unique = (values, label) => requireThat(new Set(values).size === values.length, `${label}: duplicate identifiers`);
async function jsonFiles(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const files = [];
  for (const entry of entries) {
    requireThat(!entry.isSymbolicLink(), `${entry.name}: symlinks are not allowed in content`);
    if (entry.isDirectory()) files.push(...await jsonFiles(join(directory, entry.name)));
    else if (entry.name.endsWith('.json')) files.push(join(directory, entry.name));
  }
  return files;
}

export async function validateCatalog(root = defaultRoot, { complete = false } = {}) {
  const [index, indexSchema, categorySchema, bodySchema, categoriesDoc, levelsDoc] = await Promise.all(['catalog.json', 'catalog.schema.json', 'category-catalog.schema.json', 'mission.schema.json', 'categories.json', 'levels.json'].map(file => readJson(root, file)));
  validateShape(index, indexSchema);
  requireThat(Array.isArray(categoriesDoc.categories) && categoriesDoc.categories.length > 0, 'categories: missing categories');
  requireThat(Array.isArray(levelsDoc.levels) && levelsDoc.levels.length > 0, 'levels: missing levels');
  const categories = new Map(categoriesDoc.categories.map(category => [category.id, category]));
  const levels = new Map(levelsDoc.levels.map(level => [level.id, level.order]));
  unique(categoriesDoc.categories.map(category => category.id), 'categories');
  unique(levelsDoc.levels.map(level => level.id), 'levels');
  unique(levelsDoc.levels.map(level => level.order), 'level order');
  unique(categoriesDoc.categories.flatMap(category => category.subcategories.map(sub => sub.id)), 'subcategories');
  unique(index.catalogs.map(entry => entry.categoryId), 'root categories');
  requireThat(index.catalogs.length === categories.size, 'root catalog must include every category');
  const missions = new Map();
  const referencedFiles = new Set();
  const fingerprints = new Map();
  let researchIds;
  const coverage = {};
  const baselineCoverage = {};
  const professionalCoverage = {};
  for (const entry of index.catalogs) {
    requireThat(categories.has(entry.categoryId), `unknown category ${entry.categoryId}`);
    requireThat(entry.file === `${entry.categoryId}/catalog.json`, `wrong catalog path ${entry.file}`);
    const catalog = await readJson(root, entry.file);
    validateShape(catalog, categorySchema, entry.file);
    requireThat(catalog.categoryId === entry.categoryId, `${entry.file}: category mismatch`);
    for (const item of catalog.missions) {
      requireThat(!missions.has(item.key), `duplicate key ${item.key}`);
      requireThat(item.categoryId === entry.categoryId, `${item.key}: parent mismatch`);
      requireThat(categories.get(item.categoryId).subcategories.some(sub => sub.id === item.subcategoryId), `${item.key}: invalid subcategory`);
      requireThat(levels.has(item.difficulty), `${item.key}: unknown level`);
      const record = { item, body: null };
      missions.set(item.key, record);
      if (item.file === null) continue;
      const expectedPath = `content/${item.categoryId}/${item.subcategoryId}/${item.key}.json`;
      requireThat(item.file === expectedPath, `${item.key}: expected path ${expectedPath}`);
      requireThat(!referencedFiles.has(item.file), `${item.file}: referenced twice`);
      referencedFiles.add(item.file);
      const body = await readJson(root, item.file);
      validateShape(body, bodySchema, item.file);
      record.body = body;
      for (const field of ['key', 'title', 'categoryId', 'subcategoryId', 'difficulty']) requireThat(body[field] === item[field], `${item.key}: ${field} metadata mismatch`);
      unique(body.steps.map(step => step.id), `${item.key} steps`);
      requireThat(body.difficulty === 'pre-A1' || body.steps.length >= 3, `${item.key}: at least three steps required`);
      for (const text of [body.scenario, body.practicalOutcome, ...body.steps.flatMap(step => [step.goal, step.successCriterion, ...step.hints.slice(0, 2)])]) requireThat(/[가-힣]/u.test(text), `${item.key}: learner guidance must include Korean`);
      for (const text of [body.opening, ...body.steps.map(step => step.example)]) requireThat(/[A-Za-z]/u.test(text), `${item.key}: English example required`);
      const days = body.pedagogy.review.intervalDays;
      requireThat(days.every((day, i) => i === 0 || day > days[i - 1]), `${item.key}: review intervals must increase`);
      if (!researchIds) {
        const research = await readJson(root, 'research-sources.json');
        requireThat(Array.isArray(research.sources), 'research-sources.json: sources array required');
        unique(research.sources.map(source => source.id), 'research sources');
        researchIds = new Set(research.sources.map(source => source.id));
      }
      for (const id of body.pedagogy.researchIds) requireThat(researchIds.has(id), `${item.key}: unknown research ID ${id}`);
      const fingerprint = JSON.stringify([body.scenario, body.practicalOutcome, body.opening, body.steps]);
      requireThat(!fingerprints.has(fingerprint), `${item.key}: duplicate substantive body of ${fingerprints.get(fingerprint)}`);
      fingerprints.set(fingerprint, item.key);
      const cell = `${item.categoryId}/${item.subcategoryId}/${item.difficulty}`;
      coverage[cell] = (coverage[cell] ?? 0) + 1;
      if (body.caseBrief) {
        requireThat(body.categoryId === 'work', `${item.key}: professional case must belong to work`);
        const roleCell = `${body.caseBrief.professionalRole}/${body.difficulty}`;
        professionalCoverage[roleCell] = (professionalCoverage[roleCell] ?? 0) + 1;
      } else baselineCoverage[cell] = (baselineCoverage[cell] ?? 0) + 1;
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(key) {
    requireThat(!visiting.has(key), `${key}: prerequisite cycle`);
    if (visited.has(key)) return;
    visiting.add(key);
    const { body } = missions.get(key);
    for (const prerequisite of body?.prerequisites ?? []) {
      requireThat(missions.has(prerequisite), `${key}: missing prerequisite ${prerequisite}`);
      const dependency = missions.get(prerequisite);
      requireThat(dependency.body && dependency.item.authoringStatus !== 'retired', `${key}: prerequisite ${prerequisite} has no usable body`);
      requireThat(levels.get(dependency.item.difficulty) <= levels.get(body.difficulty), `${key}: higher-level prerequisite ${prerequisite}`);
      visit(prerequisite);
    }
    visiting.delete(key);
    visited.add(key);
  }
  for (const key of missions.keys()) visit(key);
  for (const file of await jsonFiles(join(root, 'content'))) requireThat(referencedFiles.has(relative(root, file)), `orphan body ${relative(root, file)}`);
  let paths;
  try { paths = JSON.parse(await readFile(join(root, 'learning-paths.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error(`learning-paths.json: ${error.message}`); }
  if (paths) {
    requireThat(paths.schemaVersion === 1 && Array.isArray(paths.entry?.missionKeys) && Array.isArray(paths.tracks), 'learning paths: invalid structure');
    unique(paths.entry.missionKeys, 'entry mission keys');
    for (const key of paths.entry.missionKeys) requireThat(missions.get(key)?.body?.difficulty === 'pre-A1', `learning paths: invalid beginner key ${key}`);
    const expectedTracks = categoriesDoc.categories.flatMap(category => category.subcategories.map(sub => `${category.id}-${sub.id}`));
    unique(paths.tracks.map(track => track.id), 'track IDs');
    requireThat(same(paths.tracks.map(track => track.id).sort(), expectedTracks.sort()), 'learning paths: missing tracks');
    const trackKeys = [];
    for (const track of paths.tracks) {
      requireThat(track.id === `${track.categoryId}-${track.subcategoryId}`, 'learning paths: track identity mismatch');
      requireThat(same(track.stages.map(stage => stage.difficulty), [...levels.keys()].sort((a, b) => levels.get(a) - levels.get(b))), 'learning paths: level order mismatch');
      for (const stage of track.stages) for (const key of stage.missionKeys) {
        const body = missions.get(key)?.body;
        requireThat(body && body.categoryId === track.categoryId && body.subcategoryId === track.subcategoryId && body.difficulty === stage.difficulty, `learning paths: invalid track key ${key}`);
        trackKeys.push(key);
      }
    }
    unique(trackKeys, 'track mission keys');
    requireThat(trackKeys.length === referencedFiles.size, 'learning paths: missing authored mission');
    const professionalKeys = [];
    for (const track of paths.professionalTracks ?? []) for (const stage of track.stages) for (const key of stage.missionKeys) {
      const body = missions.get(key)?.body;
      requireThat(body?.caseBrief?.professionalRole === track.role && body?.difficulty === stage.difficulty, `learning paths: invalid professional key ${key}`);
      professionalKeys.push(key);
    }
    unique(professionalKeys, 'professional track keys');
    requireThat(professionalKeys.length === Object.values(professionalCoverage).reduce((total, count) => total + count, 0), 'learning paths: missing professional case');
  }
  if (complete) {
    const { targetCoverage: target, specializationCoverage: specialization } = await readJson(root, 'curriculum.json');
    requireThat(target && Number.isInteger(target.totalMissions) && target.totalMissions > 0 && Number.isInteger(target.missionsPerSubcategoryLevel) && target.missionsPerSubcategoryLevel > 0, 'curriculum: invalid coverage target');
    requireThat(categories.size === target.categoryCount && categoriesDoc.categories.flatMap(category => category.subcategories).length === target.subcategoryCount, 'curriculum: category coverage mismatch');
    requireThat(same([...levels.keys()].sort(), [...target.levels].sort()), 'curriculum: level coverage mismatch');
    requireThat(missions.size === target.totalMissions && referencedFiles.size === target.totalMissions, 'curriculum: full mission/body count not reached');
    for (const category of categories.values()) for (const sub of category.subcategories) for (const level of target.levels) {
      const cell = `${category.id}/${sub.id}/${level}`;
      requireThat(baselineCoverage[cell] === target.missionsPerSubcategoryLevel, `curriculum: incomplete coverage ${cell}`);
    }
    const baselineCount = Object.values(baselineCoverage).reduce((total, count) => total + count, 0);
    requireThat(baselineCount === (target.baselineMissions ?? target.totalMissions), 'curriculum: baseline count mismatch');
    if (specialization) {
      const roles = specialization.tracks.map(track => track.role);
      unique(roles, 'professional roles');
      for (const role of roles) for (const level of specialization.levels) requireThat(professionalCoverage[`${role}/${level}`] === specialization.missionsPerRoleLevel, `curriculum: incomplete professional coverage ${role}/${level}`);
      requireThat(Object.values(professionalCoverage).reduce((total, count) => total + count, 0) === specialization.totalMissions, 'curriculum: professional count mismatch');
      requireThat(paths && same((paths.professionalTracks ?? []).map(track => track.role).sort(), [...roles].sort()), 'learning paths: missing professional tracks');
      for (const track of paths.professionalTracks) requireThat(same(track.stages.map(stage => stage.difficulty), specialization.levels), 'learning paths: professional level order mismatch');
    }
    for (const { item, body } of missions.values()) requireThat(body && !['planned', 'retired'].includes(item.authoringStatus), `${item.key}: not an active authored mission`);
    requireThat(paths && paths.entry.missionKeys.length > 0, 'learning paths: complete curriculum requires beginner entry and tracks');
  }
  return { missions: missions.size, bodies: referencedFiles.size, complete, warnings: referencedFiles.size < missions.size ? ['Some catalog entries have no mission body; authoring is incomplete.'] : [], coverage, baselineCoverage, professionalCoverage };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const args = process.argv.slice(2); const rootArg = args.find(arg => arg !== '--complete'); console.log(JSON.stringify(await validateCatalog(rootArg ? resolve(rootArg) : defaultRoot, { complete: args.includes('--complete') }), null, 2)); }
  catch (error) { console.error(`Mission catalog validation failed: ${error.message}`); process.exitCode = 1; }
}
