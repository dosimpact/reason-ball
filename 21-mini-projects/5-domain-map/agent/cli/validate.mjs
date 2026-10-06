export function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const string = (v) => typeof v === 'string' && v.trim().length > 0;
const date = (v) => string(v) && Number.isFinite(Date.parse(v));
const sha256 = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v);
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const statuses = ['pending', 'inspected', 'partial', 'inaccessible', 'excluded'];
export const roles = ['repo-scout', 'domain-modeler', 'relationship-auditor', 'change-reviewer', 'renderer'];
export const modes = ['bootstrap', 'continue', 'deepen', 'refresh'];

function records(value, label) {
  ensure(Array.isArray(value), `${label}: array required`);
  const ids = new Set();
  for (const row of value) {
    ensure(object(row) && string(row.id) && idPattern.test(row.id), `${label}: valid id required`);
    ensure(!ids.has(row.id), `${label}: duplicate id ${row.id}`);
    ids.add(row.id);
  }
  return ids;
}

function refs(value, ids, label, nonempty = false) {
  ensure(Array.isArray(value) && (!nonempty || value.length > 0), `${label}: references required`);
  ensure(value.every((id) => ids.has(id)), `${label}: unknown reference`);
  ensure(new Set(value).size === value.length, `${label}: duplicate reference`);
}

export function validateInput(input) {
  ensure(object(input) && string(input.project), 'input.project required');
  ensure(modes.includes(input.mode), 'input.mode invalid');
  records(input.repositories, 'input.repositories');
  ensure(input.repositories.length > 0, 'at least one repository required');
  for (const repo of input.repositories) {
    ensure((Object.hasOwn(repo, 'path') && string(repo.path) && !Object.hasOwn(repo, 'url')) ||
      (Object.hasOwn(repo, 'url') && string(repo.url) && !Object.hasOwn(repo, 'path')), `${repo.id}: exactly one path or url required`);
  }
  if (input.budget !== undefined) {
    ensure(object(input.budget), 'input.budget must be an object');
    for (const value of Object.values(input.budget)) ensure(Number.isInteger(value) && value > 0, 'budget must be positive integers');
  }
  return input;
}

export function validateAnalysis(data, input, previous) {
  ensure(object(data) && data.schemaVersion === 1, 'analysis.schemaVersion must be 1');
  const repos = records(data.repositories, 'repositories');
  if (input) {
    ensure(input.repositories.length === repos.size, 'every input repository needs a status');
    for (const row of input.repositories) {
      const actual = data.repositories.find((repo) => repo.id === row.id);
      ensure(actual && actual.source === (row.path ?? row.url), `${row.id}: missing or mismatched source`);
    }
  }
  for (const repo of data.repositories) {
    ensure(string(repo.source) && statuses.includes(repo.status), `${repo.id}: source/status required`);
    ensure(repo.revision === null || string(repo.revision), `${repo.id}: revision must be string/null`);
    ensure(repo.dirty === null || typeof repo.dirty === 'boolean', `${repo.id}: dirty must be boolean/null`);
    ensure(Array.isArray(repo.inspectedPaths) && Array.isArray(repo.excludedPaths), `${repo.id}: inspected/excluded paths required`);
    ensure(repo.purpose === null || string(repo.purpose), `${repo.id}: purpose must be string/null`);
    ensure(repo.lastInspectedAt === null || date(repo.lastInspectedAt), `${repo.id}: lastInspectedAt required`);
    if (['partial', 'inaccessible', 'excluded'].includes(repo.status)) ensure(string(repo.reason), `${repo.id}: reason required`);
    if (repo.status === 'inspected') ensure(date(repo.lastInspectedAt) && repo.inspectedPaths.length > 0, `${repo.id}: inspected requires observations`);
    for (const file of repo.inspectedPaths) {
      ensure(object(file) && string(file.path) && string(file.locator) && sha256(file.contentHash), `${repo.id}: inspected path/locator/SHA-256 hash required`);
    }
  }
  const evidence = records(data.evidence, 'evidence');
  const historicalEvidence = new Set(previous?.evidence.map((row) => row.id) ?? []);
  const claims = records(data.claims, 'claims');
  const model = data.domainModel;
  ensure(object(model) && model.schemaVersion === 1, 'domainModel.schemaVersion must be 1');
  const domains = records(model.domains, 'domains');
  const systems = records(model.systems, 'systems');
  const nodes = new Set([...domains, ...systems]);
  ensure(nodes.size === domains.size + systems.size, 'domain/system ids must be unique');
  const relationships = records(model.relationships, 'relationships');
  const entities = new Set([...nodes, ...relationships, ...repos]);
  ensure(entities.size === nodes.size + relationships.size + repos.size, 'entity ids must be globally unique');
  ensure(Array.isArray(model.idAliases), 'idAliases must be an array');
  const historicalEntities = new Set([...entities, ...model.idAliases.map((alias) => alias.from)]);
  const modelRepos = records(model.repositories, 'domainModel.repositories');
  ensure(modelRepos.size === repos.size, 'model repository coverage mismatch');
  for (const repo of data.repositories) {
    ensure(model.repositories.some((r) => r.id === repo.id && r.source === repo.source), `${repo.id}: model source mismatch`);
    refs(repo.candidateDomainIds, domains, `${repo.id}.candidateDomainIds`);
  }
  for (const row of data.evidence) {
    ensure((row.repoId && repos.has(row.repoId)) || (!row.repoId && string(row.sourceUrl)), `${row.id}: evidence source required`);
    ensure(string(row.path) && string(row.locator) && string(row.kind) && string(row.summary) && date(row.observedAt), `${row.id}: incomplete evidence`);
    ensure(string(row.revision) || string(row.contentHash), `${row.id}: revision or contentHash required`);
    if (row.contentHash != null) ensure(sha256(row.contentHash), `${row.id}: contentHash must be SHA-256`);
    if (!historicalEvidence.has(row.id) && data.repositories.find((r) => r.id === row.repoId)?.dirty) ensure(sha256(row.contentHash), `${row.id}: dirty source requires hash`);
  }
  for (const row of data.claims) {
    ensure(string(row.statement) && date(row.lastVerifiedAt), `${row.id}: statement/time required`);
    ensure(['code-observed', 'documented', 'stakeholder-confirmed', 'inferred'].includes(row.basis), `${row.id}: invalid basis`);
    ensure(['supported', 'hypothesis', 'disputed', 'stale', 'superseded'].includes(row.status), `${row.id}: invalid status`);
    refs(row.evidenceIds, evidence, `${row.id}.evidenceIds`, row.status === 'supported');
    refs(row.entityIds, ['superseded', 'stale'].includes(row.status) ? historicalEntities : entities, `${row.id}.entityIds`, true);
    refs(row.contradicts, claims, `${row.id}.contradicts`);
  }
  for (const node of [...model.domains, ...model.systems]) {
    ensure(string(node.name) && string(node.responsibility), `${node.id}: name/responsibility required`);
    refs(node.repoIds, repos, `${node.id}.repoIds`);
    refs(node.claimIds, claims, `${node.id}.claimIds`, true);
    for (const id of node.claimIds) ensure(data.claims.find((c) => c.id === id).entityIds.includes(node.id), `${node.id}: claim does not describe entity`);
  }
  for (const edge of model.relationships) {
    ensure(nodes.has(edge.from) && nodes.has(edge.to), `${edge.id}: unknown endpoint`);
    ensure(['call', 'event', 'data', 'supports'].includes(edge.kind) && string(edge.label), `${edge.id}: kind/label required`);
    refs(edge.claimIds, claims, `${edge.id}.claimIds`, true);
    for (const id of edge.claimIds) ensure(data.claims.find((c) => c.id === id).entityIds.includes(edge.id), `${edge.id}: claim does not describe relationship`);
  }
  const aliasIds = new Set();
  for (const alias of model.idAliases) {
    ensure(string(alias.from) && idPattern.test(alias.from) && !entities.has(alias.from) && !aliasIds.has(alias.from), 'alias.from must be a unique retired entity id');
    aliasIds.add(alias.from);
    refs(alias.to, entities, 'alias.to', true);
    ensure(string(alias.reason), 'alias.reason required');
  }
  records(data.questions, 'questions');
  for (const question of data.questions) {
    ensure(string(question.question) && ['high', 'medium', 'low'].includes(question.priority), `${question.id}: question/priority required`);
    ensure(['open', 'answered', 'deferred'].includes(question.status) && Array.isArray(question.nextEvidenceToRead) && question.nextEvidenceToRead.every(string), `${question.id}: status/nextEvidenceToRead required`);
    refs(question.affectedIds, entities, `${question.id}.affectedIds`);
  }
  records(data.workItems, 'workItems');
  for (const work of data.workItems) {
    ensure(string(work.title) && string(work.sourceUrl) && string(work.status) && Array.isArray(work.assignees) && work.assignees.every(string), `${work.id}: work item fields required`);
    ensure(date(work.fetchedAt) && (work.sourceUpdatedAt === null || date(work.sourceUpdatedAt)), `${work.id}: source timestamps required`);
    refs(work.affectedIds, entities, `${work.id}.affectedIds`);
  }
  return { repositories: repos.size, domains: domains.size, systems: systems.size, relationships: relationships.size, evidence: evidence.size, claims: claims.size };
}

export function validateEvolution(previous, next) {
  for (const evidence of previous.evidence) {
    const current = next.evidence.find((row) => row.id === evidence.id);
    ensure(current && canonical(current) === canonical(evidence), `evidence ${evidence.id} is immutable; preserve it and add a new id`);
  }
  for (const claim of previous.claims) ensure(next.claims.some((row) => row.id === claim.id), `preserve historical claim ${claim.id} (superseded/stale)`);
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
