---
name: test-api-bruno
description: |
  Bruno를 사용한 API 수준 테스트 워크플로우.
  supports: init, write, run, report.
  Actions: init->컬렉션 초기화, write->요청/테스트 케이스 작성,
  run->CLI 실행, report->결과 리포트 생성 및 CI 연동.
  Triggers: Bruno API test, Bruno, API 테스트, bruno test, bru run, Bruno CLI
---

# Bruno API Testing Skill

> Unified Skill for filesystem-based API testing with Bruno: initialize, author, run, and report.

## Usage

```bash
$test-api-bruno init        Bruno 컬렉션 초기화
$test-api-bruno write       .bru 요청/테스트 작성
$test-api-bruno run         Bruno CLI 실행
$test-api-bruno report      리포트 생성
```

## Workflow

```text
Init -> Write -> Run -> Report
  |       |       |       |
  |       |       |       v
  |       |       |   JSON / JUnit / HTML
  |       |       v
  |       |   bru run --env local
  |       v
  |   Request + Docs + Assert + Tests + Variable Chaining
  v
Collection / Environment / Folder Structure
```

## Stage Progress Visualization

```text
[Init] -> [Write] -> [Run] -> [Report]

Status indicators:
  [Stage] done     -> stage completed
  [Stage] active   -> currently working
  [Stage] pending  -> not yet started
```

---

## Init Stage (test-api-bruno init)

Set up a Bruno collection in the project.

### Prerequisites

- Node.js >= 18
- `npm` or `pnpm`
- Bruno CLI (`@usebruno/cli`)

### Steps

1. Install Bruno CLI: `npm install -g @usebruno/cli`
2. Verify installation: `bru --version`
3. Create collection directory: `mkdir -p test-api-bruno/environments`
4. Create `test-api-bruno/bruno.json`
5. Create environment files such as `local.bru`, `dev.bru`, `staging.bru`
6. Optionally create `collection.bru` and per-folder `folder.bru`
7. Add a `docs { ... }` block to `collection.bru` or each `folder.bru` so the collection purpose and execution flow are visible in Bruno UI
8. Add secret-related exclusions to `.gitignore` when needed
9. Just Notice : `brew install --cask bruno` You can also use the Bruno GUI app for authoring and running tests.

### Recommended Structure

```text
test-api-bruno/
├── bruno.json
├── collection.bru
├── environments/
│   ├── local.bru
│   ├── dev.bru
│   └── staging.bru
├── auth/
│   ├── folder.bru
│   ├── login.bru
│   ├── register.bru
│   └── refresh-token.bru
├── users/
│   ├── folder.bru
│   ├── get-users.bru
│   ├── get-user-by-id.bru
│   ├── create-user.bru
│   ├── update-user.bru
│   └── delete-user.bru
└── health/
    └── health-check.bru
```

### Base Files

#### `bruno.json`

> 컬렉션 루트에 `bruno.json`을 생성한다. 이 파일은 컬렉션의 메타 설정이다:

```json
{
  "version": "1",
  "name": "<project-name>-api-tests",
  "type": "collection",
  "ignore": ["node_modules", ".git"]
}
```

- `name`: 컬렉션 이름 (프로젝트명 기반으로 설정)
- `type`: 반드시 `"collection"`
- `ignore`: 탐색에서 제외할 디렉토리

#### `environments/local.bru`

```bru
vars {
  baseUrl: http://localhost:3000
  apiVersion: v1
  testEmail: admin@test.com
  testPassword: password123
}
```

#### `environments/dev.bru`

```bru
vars {
  baseUrl: https://dev-api.example.com
  apiVersion: v1
}
vars:secret [
  apiKey
  authToken
]
```

#### `collection.bru`

> 컬렉션 루트에 `collection.bru`를 생성하면 **모든 요청에 공통 적용되는** 헤더, 인증, 스크립트, 문서 설명을 정의할 수 있다:

```bru
headers {
  Accept: application/json
}

auth {
  mode: bearer
}

auth:bearer {
  token: {{accessToken}}
}

script:pre-request {
  const timestamp = Date.now();
  req.setHeader("X-Request-Timestamp", timestamp.toString());
}

script:post-response {
  console.log(`[${req.getMethod()}] ${req.getUrl()} -> ${res.getStatus()} (${res.getResponseTime()}ms)`);
}

docs {
  This collection verifies the core API flow for the service.
  Document the recommended execution order and the role of each folder here.
}
```

**실행 순서**: Collection pre-request → Folder pre-request → Request pre-request → HTTP 요청 → Collection post-response → Folder post-response → Request post-response → Tests

### Docs Guidance During Init

- `collection.bru`의 `docs` 블록에는 컬렉션 목적, 선행 조건, 권장 실행 순서를 적는다.
- 폴더 단위 시나리오가 있으면 `folder.bru`에도 `docs` 블록을 추가해 그 폴더의 역할을 설명한다.
- 초기화 단계에서 빈 컬렉션만 만들지 말고, 최소한 컬렉션 루트 설명은 함께 작성한다.

### Notes

- `vars:secret` 값은 파일에 저장되지 않으며 GUI 또는 CLI 주입으로 사용한다.
- 초기화 확인 예시: `cd test-api-bruno && bru run health/health-check.bru --env local`
- > **참고**: `.bru` 파일은 플레인 텍스트이므로 민감한 정보(API 키, 비밀번호 등)는 환경 변수로 분리하거나 `.secret.bru` 파일을 사용하여 `.gitignore`에 추가한다.

---

## Write Stage (test-api-bruno write)

Write request definitions and API-level test cases in `.bru` files.

### `.bru` Building Blocks

| Block                       | Purpose            |
| --------------------------- | ------------------ |
| `meta`                      | 요청 메타 정보     |
| `get/post/put/patch/delete` | HTTP 메서드와 URL  |
| `headers`                   | 요청 헤더          |
| `auth`                      | 인증 설정          |
| `body:json`                 | JSON 바디          |
| `body:form-urlencoded`      | Form 바디          |
| `body:multipart-form`       | Multipart 바디     |
| `params:query`              | 쿼리 파라미터      |
| `params:path`               | 경로 파라미터      |
| `vars:pre-request`          | 요청 전 변수       |
| `vars:post-response`        | 응답 후 변수       |
| `script:pre-request`        | 요청 전 JavaScript |
| `script:post-response`      | 응답 후 JavaScript |
| `assert`                    | 선언형 assertion   |
| `tests`                     | JavaScript 테스트  |
| `docs`                      | 요청 문서화        |

### Docs Writing Rule

- 모든 주요 요청 `.bru` 파일에는 `docs { ... }` 블록을 추가한다.
- `docs`에는 최소한 요청 목적, 주요 입력값, 핵심 응답 필드를 적는다.
- Job 실행 요청은 "무엇을 트리거하는지"와 "결과 카운터가 무엇을 의미하는지"를 문서화한다.
- 조회 요청은 지원 필터와 응답의 `filters/items` 또는 집계 필드를 문서화한다.
- 컬렉션 루트 또는 폴더 레벨 문서와 중복되더라도, 요청 파일만 열어도 이해 가능하도록 적당한 맥락을 남긴다.

### Example: GET Request

```bru
meta {
  name: Get Users
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/{{apiVersion}}/users
  body: none
  auth: bearer
}

auth:bearer {
  token: {{accessToken}}
}

headers {
  Content-Type: application/json
  Accept: application/json
}

params:query {
  page: 1
  limit: 10
}

assert {
  res.status: eq 200
  res.body.data: isArray
  res.responseTime: lte 2000
}

tests {
  test("should return 200 status", function() {
    expect(res.getStatus()).to.equal(200);
  });

  test("should return array of users", function() {
    const body = res.getBody();
    expect(body.data).to.be.an('array');
    expect(body.data.length).to.be.greaterThan(0);
  });
}

docs {
  Returns a paginated user list.
  Query params:
  - page: page number
  - limit: max number of items
  Response:
  - data: array of users
}
```

### Example: Login With Variable Chaining

```bru
meta {
  name: Login
  type: http
  seq: 1
}

post {
  url: {{baseUrl}}/{{apiVersion}}/auth/login
  body: json
  auth: none
}

headers {
  Content-Type: application/json
}

body:json {
  {
    "email": "{{testEmail}}",
    "password": "{{testPassword}}"
  }
}

assert {
  res.status: eq 200
  res.body.accessToken: isString
  res.body.refreshToken: isString
}

script:post-response {
  if (res.getStatus() === 200) {
    const body = res.getBody();
    bru.setVar("accessToken", body.accessToken);
    bru.setVar("refreshToken", body.refreshToken);
    bru.setVar("userId", body.user.id);
  }
}
```

### Example: Error Case

```bru
meta {
  name: Login - Invalid Credentials
  type: http
  seq: 2
}

post {
  url: {{baseUrl}}/{{apiVersion}}/auth/login
  body: json
  auth: none
}

headers {
  Content-Type: application/json
}

body:json {
  {
    "email": "wrong@example.com",
    "password": "wrongpassword"
  }
}

assert {
  res.status: eq 401
}
```

### Example: Path Parameter

```bru
meta {
  name: Update User
  type: http
  seq: 4
}

put {
  url: {{baseUrl}}/{{apiVersion}}/users/:id
  body: json
  auth: bearer
}

params:path {
  id: {{userId}}
}

auth:bearer {
  token: {{accessToken}}
}

headers {
  Content-Type: application/json
}

body:json {
  {
    "name": "Updated Name"
  }
}

assert {
  res.status: eq 200
  res.body.name: eq "Updated Name"
}
```

### Example: DELETE Request

```bru
meta {
  name: Delete User
  type: http
  seq: 5
}

delete {
  url: {{baseUrl}}/{{apiVersion}}/users/:id
  body: none
  auth: bearer
}

params:path {
  id: {{userId}}
}

auth:bearer {
  token: {{accessToken}}
}

assert {
  res.status: in [200, 204]
}
```

### Assertions Reference

| Operator      | Meaning     | Example                                |
| ------------- | ----------- | -------------------------------------- |
| `eq`          | 같음        | `res.status: eq 200`                   |
| `neq`         | 다름        | `res.status: neq 500`                  |
| `gt`          | 초과        | `res.body.count: gt 0`                 |
| `gte`         | 이상        | `res.body.count: gte 1`                |
| `lt`          | 미만        | `res.responseTime: lt 5000`            |
| `lte`         | 이하        | `res.responseTime: lte 2000`           |
| `in`          | 포함        | `res.status: in [200, 201]`            |
| `contains`    | 문자열 포함 | `res.body.message: contains "success"` |
| `matches`     | 정규식 매치 | `res.body.id: matches "^[0-9a-f-]+$"`  |
| `isString`    | 문자열      | `res.body.name: isString`              |
| `isNumber`    | 숫자        | `res.body.count: isNumber`             |
| `isBoolean`   | 불리언      | `res.body.active: isBoolean`           |
| `isArray`     | 배열        | `res.body.items: isArray`              |
| `isNull`      | null        | `res.body.deletedAt: isNull`           |
| `isDefined`   | 정의됨      | `res.body.id: isDefined`               |
| `isUndefined` | 미정의      | `res.body.removed: isUndefined`        |
| `isEmpty`     | 빈 값       | `res.body.errors: isEmpty`             |

### Script API

```javascript
bru.setVar("key", "value");
bru.getVar("key");
bru.setEnvVar("key", "value");
bru.getEnvVar("key");
bru.getProcessEnv("NODE_ENV");

res.getStatus();
res.getBody();
res.getHeaders();
res.getHeader("Content-Type");
res.getResponseTime();

req.getUrl();
req.setUrl("https://...");
req.getMethod();
req.getHeaders();
req.setHeader("key", "value");
req.getBody();
req.setBody({...});

bru.setNextRequest("Request Name");
bru.sleep(1000);
bru.getEnvName();
bru.cwd();
```

### Built-In Variables

| Variable                  | Description        |
| ------------------------- | ------------------ |
| `{{$guid}}`               | 랜덤 UUID          |
| `{{$timestamp}}`          | Unix timestamp     |
| `{{$isoTimestamp}}`       | ISO 8601 timestamp |
| `{{$randomInt}}`          | 랜덤 정수          |
| `{{$randomFloat}}`        | 랜덤 실수          |
| `{{$randomAlphaNumeric}}` | 랜덤 문자열        |

### External Modules

1. Create `package.json` in the collection root
2. Install dependencies such as `axios`, `lodash`, `@faker-js/faker`
3. Add them to `bruno.json > scripts.moduleWhitelist`
4. Run with `bru run --sandbox=developer`

### Writing Rules

- 파일 이름은 kebab-case를 사용한다.
- `meta.seq`는 실행 순서가 중요할 때만 설정한다.
- 단순 검증은 `assert`, 복잡한 검증은 `tests`를 사용한다.
- 로그인 후 토큰 저장 같은 흐름은 `script:post-response`와 `bru.setVar()`로 연결한다.
- 정상 케이스와 에러 케이스를 함께 작성한다.
- 하드코딩 대신 `{{variable}}` 환경 변수를 우선 사용한다.
- 디버깅용 헤더나 파라미터는 `~` 접두사로 비활성화할 수 있다.

---

## Run Stage

Execute Bruno tests through the CLI.

### Basic Commands

```bash
cd test-api-bruno
bru run
bru run auth/login.bru
bru run users/
bru run -r
bru run --env local
bru run users/ --env dev
bru run auth/login.bru --env staging
```

### Common Options

```bash
bru run --env local --env-var "baseUrl=http://localhost:8080"
bru run --tests-only
bru run --bail
bru run --delay 500
bru run --cacert ./certs/myCA.pem
bru run --insecure
bru run -o results.json -f json
bru run -o results.xml -f junit
bru run --sandbox=developer
bru run users/create-user.bru --env local --csv-file-path ./data/test-users.csv
```

### CLI Options Reference

| Option                             | Description                 |
| ---------------------------------- | --------------------------- |
| `-h, --help`                       | 도움말 표시                 |
| `--version`                        | 버전 표시                   |
| `-r`                               | 재귀 실행                   |
| `--env <string>`                   | 환경 지정                   |
| `--env-var <string>`               | 환경 변수 오버라이드        |
| `-o, --output <string>`            | 출력 파일 경로              |
| `-f, --format <string>`            | 출력 포맷 (`json`, `junit`) |
| `--reporter-json <string>`         | JSON 리포트                 |
| `--reporter-junit <string>`        | JUnit 리포트                |
| `--reporter-html <string>`         | HTML 리포트                 |
| `--tests-only`                     | 테스트가 있는 요청만 실행   |
| `--bail`                           | 실패 시 즉시 중단           |
| `--delay <number>`                 | 요청 간 딜레이              |
| `--cacert <string>`                | CA 인증서 경로              |
| `--insecure`                       | SSL 검증 무시               |
| `--sandbox <string>`               | `developer` 또는 `safe`     |
| `--csv-file-path <string>`         | CSV 데이터 파일             |
| `--reporter-skip-all-headers`      | 모든 헤더 제외              |
| `--reporter-skip-headers <string>` | 특정 헤더 제외              |
| `--client-cert-config <string>`    | 클라이언트 인증서 설정      |

### Exit Codes

| Code  | Meaning                           |
| ----- | --------------------------------- |
| `0`   | 모든 테스트 성공                  |
| `1`   | assertion, 테스트, 또는 요청 실패 |
| `2`   | 출력 디렉토리 없음                |
| `3`   | 요청 체인 무한 루프               |
| `4`   | 컬렉션 루트 밖에서 실행           |
| `5`   | 입력 파일 없음                    |
| `6`   | 지정된 환경 없음                  |
| `7`   | 환경 오버라이드 타입 오류         |
| `8`   | 환경 오버라이드 형식 오류         |
| `9`   | 잘못된 출력 포맷                  |
| `255` | 기타 에러                         |

### Variable Priority

1. `--env-var` CLI override
2. Runtime variable from `bru.setVar()`
3. Environment variable from `.bru` env file
4. Collection variable
5. Process environment via `bru.getProcessEnv()`

### Example Workflow

```bash
cd test-api-bruno
bru run -r --env local
bru run -r --env local --tests-only -o test-results.json
bru run -r --env dev --bail --reporter-json ./reports/results.json
```

---

## Report Stage ($test-api-bruno report )

Generate and consume structured test reports.

### Steps

1. Create the report directory: `mkdir -p test-api-bruno/test-report`
2. Run the collection with one or more reporter flags
3. Save reports under `test-api-bruno/test-report/`
4. Check CLI summary for quick pass/fail and duration
5. Review HTML manually, or consume JSON/JUnit from CI tooling

### Supported Report Formats

| Format    | Flag                      | Use Case           |
| --------- | ------------------------- | ------------------ |
| JSON      | `--reporter-json <path>`  | 자동 처리          |
| JUnit XML | `--reporter-junit <path>` | CI/CD 연동         |
| HTML      | `--reporter-html <path>`  | 사람이 읽는 리포트 |

### Commands

```bash
bru run -r --env local --reporter-json ./test-report/results.json
bru run -r --env local --reporter-junit ./test-report/results.xml
bru run -r --env local --reporter-html ./test-report/results.html
```

### Multiple Reporters

```bash
bru run -r --env local \
  --reporter-json ./test-report/results.json \
  --reporter-junit ./test-report/results.xml \
  --reporter-html ./test-report/results.html
```

### Security Options

```bash
bru run -r --env local --reporter-html ./test-report/results.html --reporter-skip-all-headers
bru run -r --env local --reporter-html ./test-report/results.html --reporter-skip-headers "Authorization,Cookie"
```

### Report Checklist

1. Create the output directory first: `mkdir -p test-api-bruno/test-report`
2. Run the collection with one or more reporter flags
3. Inspect CLI summary for quick pass/fail results
4. Use HTML for manual inspection
5. Use JSON or JUnit for automation and CI analysis

---

## Core Rules

- `.bru` files are plain text and should be version-controlled with Git.
- Secrets such as API keys or passwords must be separated into env vars or secret files.
- `bruno.json` must exist at the collection root.
- Run `bru run` inside the collection root directory.
- Use `meta.seq` when execution order matters.
- Use `script:post-response` and `bru.setVar()` for request chaining.
- In CI, determine success or failure from exit codes.
- Use HTML for humans, JSON for automation, and JUnit for CI tooling.
