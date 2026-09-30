import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const action = process.argv[2];
const image = process.env.DOCKER_IMAGE || 'lingua-web:local';
const name = process.env.DOCKER_CONTAINER || 'lingua-web-local';
const port = process.env.DOCKER_PORT || '3325';
const publicKeys = [
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_APP_RUNTIME_MODE', 'NEXT_PUBLIC_DATA_PROVIDER',
];

function docker(args, env = process.env) {
  const result = spawnSync('docker', args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw new Error('Docker 실행 파일을 확인하세요.');
  if (result.status !== 0) process.exit(result.status || 1);
}

function localEnvironment() {
  const path = resolve(root, process.env.DOCKER_ENV_FILE || 'apps/web/.env.local');
  const values = parseEnv(readFileSync(path, 'utf8'));
  for (const key of Object.keys(values)) {
    if (process.env[key] !== undefined) values[key] = process.env[key];
  }
  return values;
}

function runtimeEnvironment(values) {
  const result = { ...values };
  // Container loopback refers to the container, not the user's local proxy.
  if (result.CHATGPT_OAUTH_PROXY_URL) {
    const url = new URL(result.CHATGPT_OAUTH_PROXY_URL);
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      url.hostname = 'host.docker.internal';
      result.CHATGPT_OAUTH_PROXY_URL = url.toString();
      console.log('로컬 OAuth proxy 주소를 host.docker.internal로 연결합니다.');
    }
  }
  result.APP_ALLOWED_ORIGINS = [result.APP_ALLOWED_ORIGINS,
    `http://localhost:${port}`, `http://127.0.0.1:${port}`].filter(Boolean).join(',');
  result.NODE_ENV = 'production';
  result.HOSTNAME = '0.0.0.0';
  result.PORT = '3000';
  return result;
}

try {
  if (action === 'build') {
    const values = localEnvironment();
    // Only explicitly public values reach build args. Server keys stay outside all layers.
    const buildEnv = { ...process.env };
    for (const key of publicKeys) buildEnv[key] = values[key] ?? process.env[key] ?? '';
    docker(['build', '--tag', image, ...publicKeys.flatMap(key => ['--build-arg', key]), '.'], buildEnv);
  } else if (action === 'up') {
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('DOCKER_PORT가 잘못되었습니다.');
    const values = runtimeEnvironment(localEnvironment());
    // Pass values through child environment, never command-line arguments or logs.
    docker(['run', '--detach', '--init', '--name', name,
      '--label', 'com.lingua.service=web', '--publish', `127.0.0.1:${port}:3000`,
      '--add-host', 'host.docker.internal:host-gateway',
      ...Object.keys(values).flatMap(key => ['--env', key]), image], { ...process.env, ...values });
    console.log(`Lingua: http://localhost:${port}`);
  } else if (action === 'down') {
    const check = spawnSync('docker', ['inspect', '--format', '{{ index .Config.Labels "com.lingua.service" }}', name], { encoding: 'utf8' });
    if (check.status !== 0 || check.stdout.trim() !== 'web') throw new Error('소유 Lingua 컨테이너를 확인할 수 없습니다.');
    docker(['stop', name]);
    docker(['rm', name]);
  } else if (action === 'logs') {
    docker(['logs', '--follow', '--tail', '100', name]);
  } else {
    throw new Error('사용법: node scripts/docker/service.mjs build|up|down|logs');
  }
} catch (error) {
  // Do not print child env, credentials, or raw URL parsing errors.
  console.error(error instanceof TypeError ? '환경변수 형식을 확인하세요.' : error.message);
  process.exitCode = 1;
}
