# Artillery Developer Enablement Kit

- [Artillery Developer Enablement Kit](#artillery-developer-enablement-kit)
  - [1. 목적과 범위](#1-목적과-범위)
  - [2. Artillery 기본 개념](#2-artillery-기본-개념)
    - [테스트 유형](#테스트-유형)
  - [3. 설치와 실행](#3-설치와-실행)
  - [4. 권장 디렉터리 구조](#4-권장-디렉터리-구조)
    - [온보딩 예제 프로젝트](#온보딩-예제-프로젝트)
  - [5. 기본 YAML 구조](#5-기본-yaml-구조)
  - [6. Node.js REST API 실전 예시](#6-nodejs-rest-api-실전-예시)
  - [7. 동적 데이터와 인증 처리](#7-동적-데이터와-인증-처리)
    - [JWT 토큰 추출](#jwt-토큰-추출)
    - [환경 변수 사용](#환경-변수-사용)
    - [processor.js 예시](#processorjs-예시)
    - [CSV payload 사용](#csv-payload-사용)
  - [8. 테스트 강도 설계](#8-테스트-강도-설계)
    - [arrivalRate와 동시 사용자 수](#arrivalrate와-동시-사용자-수)
    - [maxVusers](#maxvusers)
    - [단계별 설계 예시](#단계별-설계-예시)
  - [9. 성능 지표 해석](#9-성능-지표-해석)
  - [10. WebSocket 테스트](#10-websocket-테스트)
  - [11. Socket.IO 테스트](#11-socketio-테스트)
  - [12. 결과 리포트 저장](#12-결과-리포트-저장)
  - [13. Docker 실행](#13-docker-실행)
    - [Dockerfile](#dockerfile)
    - [docker-compose.yml](#docker-composeyml)
  - [14. Prometheus, Grafana, Loki와 함께 보기](#14-prometheus-grafana-loki와-함께-보기)
    - [Node.js 서버에서 남길 권장 메트릭](#nodejs-서버에서-남길-권장-메트릭)
    - [Grafana에서 같이 볼 패널](#grafana에서-같이-볼-패널)
    - [해석 기준](#해석-기준)
  - [15. 최소 도입 체크리스트](#15-최소-도입-체크리스트)
  - [참고 문서](#참고-문서)


## 1. 목적과 범위

목적 : Artillery 테스트 

- Node.js REST API 서버에 대한 load, stress, soak, spike 테스트 작성
- 인증이 필요한 API 흐름 테스트
- 테스트 결과 해석 (latency, RPS, error rate...)
- 테스트 환경 (Docker, Docker Compose, GitHub Actions, GitLab CI  실행)
- Prometheus, Grafana, Loki 기반 서버 관측 데이터와 Artillery 결과를 함께 분석


## 2. Artillery 기본 개념

Artillery는 성능 테스트 도구다.
- YAML 또는 JS 기반 테스트 스크립트로 가상 사용자를 생성하고 HTTP, WebSocket, Socket.IO 등의 프로토콜에 부하 준다.
- `npx`로 바로 실행할 수 있으며, CI/CD에 넣기 쉽다.


### 테스트 유형

| 유형 | 목적 | Artillery 표현 방식 |
| --- | --- | --- |
| Load test | 평상시 또는 목표 트래픽에서 정상 동작 확인 | 일정한 `arrivalRate`로 충분한 시간 실행 |
| Stress test | 한계점과 장애 양상 확인 | 단계적으로 `arrivalRate`를 올리고 실패 지점 확인 |
| Soak test | 장시간 안정성, 메모리 누수, 커넥션 누수 확인 | 낮거나 중간 수준의 부하를 긴 `duration`으로 실행 |
| Spike test | 갑작스러운 트래픽 급증 대응 확인 | 짧은 시간에 높은 `arrivalRate`로 급증 후 감소 |

*arrivalRate : 초당 몇 명의 새로운 사용자가 유입되냐?  
- duration: 60, arrivalRate: 10 => 60초 동안 매초 새로운 사용자 10명 시작 => 총 600명의 사용자가 생성됨  

예시:

```yaml
config:
  target: "http://localhost:3000"
  phases:
    # Load test: 기준 부하
    - name: "baseline"
      duration: 300
      arrivalRate: 20

    # Stress test: 점진 증가
    - name: "ramp-up"
      duration: 300
      arrivalRate: 20
      rampTo: 100

    # Spike test: 급증
    - name: "spike"
      duration: 60
      arrivalRate: 300

    # Ramp-down: 회복 확인
    - name: "recovery"
      duration: 180
      arrivalRate: 30
```

## 3. 설치와 실행

```bash
# npx로 실행 (프로젝트에 설치하지 않고 빠르게 실행한다.)
npx artillery run tests/performance/api.yml

# devDependency로 설치
npm install --save-dev artillery
npm pkg set scripts.loadtest="artillery run tests/performance/api.yml"
npm run loadtest

# 빠른 단일 URL 테스트
npx artillery quick --count 100 --num 10 http://localhost:3000/health
# `quick`은 매우 간단한 확인용이다. 실제 프로젝트에서는 YAML 스크립트를 사용한다.
```


## 4. 권장 디렉터리 구조

```text
tests/
  performance/
    api.yml
    websocket.yml
    socketio.yml
    processor.js
    payloads/
      users.csv
reports/
  .gitkeep
```

`tests/performance`에는 테스트 시나리오와 보조 스크립트를 둔다. `reports`에는 CI 실행 결과 JSON/HTML을 저장한다.

### 온보딩 예제 프로젝트


```bash
# 이 플레이북의 내용을 직접 실행해 볼 수 있는 예제 프로젝트는 다음 위치에 있다.
cd /Users/studio/workspace/Research/Artillery/example-project
npm install
npm start
# 다른 터미널에서 smoke test부터 실행한다.
npm run test:smoke
npm run test:load
npm run report:load
```

예제 프로젝트는 테스트 대상 Node.js 서버와 Artillery 시나리오를 모두 포함한다.

- 서버: `example-project/src/server.js`
- 시나리오: `example-project/tests/performance/*.yml`
- processor: `example-project/tests/performance/processor.js`
- 실행 가이드: `example-project/README.md`

## 5. 기본 YAML 구조

```yaml
config:
  target: "http://localhost:3000"
  phases:
    - name: "warmup"
      duration: 60
      arrivalRate: 5
      rampTo: 20
    - name: "steady"
      duration: 300
      arrivalRate: 20
  defaults:
    headers:
      content-type: "application/json"
  ensure:
    maxErrorRate: 1
    thresholds:
      - http.response_time.p95: 500
      - http.response_time.p99: 1000

scenarios:
  - name: "basic API flow"
    flow:
      - get:
          url: "/health"
          expect:
            - statusCode: 200
      - think: 1
      - get:
          url: "/api/items"
          expect:
            - statusCode: 200
```

주요 키:

- `target`: 테스트 대상 서버의 기본 URL
- `phases`: 부하 패턴
- `arrivalRate`: 초당 새로 시작되는 가상 사용자 수
- `rampTo`: phase 동안 `arrivalRate`를 점진적으로 변경
- `scenarios`: 가상 사용자가 수행할 흐름
- `flow`: HTTP 요청, 대기, 반복, 함수 호출의 순서
- `think`: 사용자의 대기 시간 흉내
- `expect`: 응답 코드나 응답 조건 검증
- `ensure`: 테스트 실패 기준

## 6. Node.js REST API 실전 예시

아래 예시는 `health check -> login -> list 조회 -> create 요청` 흐름을 테스트한다.

```yaml
config:
  target: "{{ $processEnvironment.TARGET_URL }}"
  phases:
    - name: "warmup"
      duration: 60
      arrivalRate: 5
      rampTo: 20
    - name: "load"
      duration: 300
      arrivalRate: 20
    - name: "stress"
      duration: 300
      arrivalRate: 20
      rampTo: 100
  defaults:
    headers:
      content-type: "application/json"
  processor: "./processor.js"
  ensure:
    maxErrorRate: 1
    thresholds:
      - http.response_time.p95: 500
      - http.response_time.p99: 1200

scenarios:
  - name: "authenticated CRUD flow"
    beforeScenario: "setRandomUser"
    flow:
      - get:
          url: "/health"
          expect:
            - statusCode: 200

      - post:
          url: "/api/auth/login"
          json:
            email: "{{ email }}"
            password: "{{ password }}"
          capture:
            - json: "$.accessToken"
              as: "token"
          expect:
            - statusCode: 200

      - think: 1

      - get:
          url: "/api/items"
          headers:
            authorization: "Bearer {{ token }}"
          expect:
            - statusCode: 200

      - post:
          url: "/api/items"
          headers:
            authorization: "Bearer {{ token }}"
          json:
            title: "{{ itemTitle }}"
            description: "created by artillery"
          expect:
            - statusCode: 201
```

실행:

```bash
TARGET_URL=http://localhost:3000 npx artillery run tests/performance/api.yml
```

## 7. 동적 데이터와 인증 처리

### JWT 토큰 추출

로그인 응답이 다음과 같다고 가정한다.

```json
{
  "accessToken": "eyJ..."
}
```

Artillery에서는 `capture`로 토큰을 변수에 저장하고 이후 요청에서 사용할 수 있다.

```yaml
- post:
    url: "/api/auth/login"
    json:
      email: "{{ email }}"
      password: "{{ password }}"
    capture:
      - json: "$.accessToken"
        as: "token"

- get:
    url: "/api/me"
    headers:
      authorization: "Bearer {{ token }}"
```

### 환경 변수 사용

```yaml
config:
  target: "{{ $processEnvironment.TARGET_URL }}"
```

```bash
TARGET_URL=https://staging.example.com npx artillery run tests/performance/api.yml
```

### processor.js 예시

Artillery는 `config.processor`로 JS 파일을 로드해 hook이나 사용자 함수를 실행할 수 있다.

```js
const crypto = require("crypto");

function setRandomUser(context, events, done) {
  const id = crypto.randomUUID();

  context.vars.email = `loadtest+${id}@example.com`;
  context.vars.password = process.env.LOAD_TEST_PASSWORD || "password1234";
  context.vars.itemTitle = `item-${id}`;

  return done();
}

function addRequestId(requestParams, context, events, done) {
  requestParams.headers = requestParams.headers || {};
  requestParams.headers["x-request-id"] = crypto.randomUUID();
  return done();
}

module.exports = {
  setRandomUser,
  addRequestId,
};
```

YAML에서 사용:

```yaml
config:
  processor: "./processor.js"

scenarios:
  - beforeScenario: "setRandomUser"
    flow:
      - get:
          url: "/api/items"
          beforeRequest: "addRequestId"
```

### CSV payload 사용

계정이 미리 준비되어 있다면 CSV를 사용한다.

```csv
email,password
user1@example.com,password
user2@example.com,password
```

```yaml
config:
  payload:
    path: "./payloads/users.csv"
    fields:
      - "email"
      - "password"
```

## 8. 테스트 강도 설계

### arrivalRate와 동시 사용자 수

`arrivalRate`는 초당 새로 시작되는 가상 사용자 수다. 동시 사용자 수 자체가 아니다.

동시 사용자 수는 대략 다음 요인으로 결정된다.

```text
동시 실행 VU ~= arrivalRate * 시나리오 평균 수행 시간
```

예를 들어 `arrivalRate: 50`이고 한 시나리오가 평균 4초 걸리면 동시에 약 200명의 VU가 실행될 수 있다.

### maxVusers

서버가 느려져 시나리오가 오래 걸리면 동시 VU가 계속 증가할 수 있다. 이때 `maxVusers`로 상한을 둘 수 있다.

```yaml
config:
  phases:
    - duration: 300
      arrivalRate: 50
      maxVusers: 300
```

### 단계별 설계 예시

```yaml
phases:
  - name: "warmup"
    duration: 120
    arrivalRate: 5
    rampTo: 20
  - name: "target-load"
    duration: 600
    arrivalRate: 50
  - name: "stress-ramp"
    duration: 600
    arrivalRate: 50
    rampTo: 200
  - name: "recovery"
    duration: 300
    arrivalRate: 20
```

권장 순서:

1. 로컬에서 작은 부하로 스크립트 검증
2. staging에서 목표 부하의 10~20%로 검증
3. 목표 부하 load test
4. 목표 부하 초과 stress test
5. 1~4시간 이상 soak test

## 9. 성능 지표 해석

Artillery 결과에서 주로 볼 지표:

| 지표 | 의미 | 해석 기준 |
| --- | --- | --- |
| RPS | 초당 처리 요청 수 | 목표 트래픽을 안정적으로 처리하는지 확인 |
| latency median | 일반적인 응답 시간 | 평균 사용자 경험에 가까움 |
| latency p95 | 느린 5% 요청의 경계 | SLO 기준으로 많이 사용 |
| latency p99 | 매우 느린 요청의 경계 | tail latency와 장애 징후 확인 |
| error rate | 실패 요청 비율 | 4xx/5xx, timeout, connection error 포함 여부 확인 |
| HTTP status codes | 상태 코드 분포 | 429, 500, 502, 503 증가 여부 확인 |
| timeout | 응답 제한 시간 초과 | 서버 포화, 네트워크, LB 제한 가능성 |

해석할 때는 Artillery 결과만 보지 말고 서버 지표와 함께 본다.

- latency p95 상승 + CPU 90% 이상: CPU 병목 가능성
- latency 상승 + DB/외부 API 지표 악화: 앱 외부 의존성 가능성
- RPS 정체 + 5xx 증가: 서버 포화 또는 connection pool 고갈 가능성
- 429 증가: rate limit 또는 upstream 보호 정책 작동
- 메모리 지속 증가: leak 또는 GC pressure 가능성

## 10. WebSocket 테스트

Artillery의 WebSocket 엔진은 `engine: ws`를 사용한다.

```yaml
config:
  target: "ws://localhost:3000"
  phases:
    - duration: 120
      arrivalRate: 20

scenarios:
  - name: "websocket echo"
    engine: ws
    flow:
      - connect: "{{ target }}/ws"
      - send: '{"type":"ping"}'
      - think: 1
      - send: '{"type":"message","body":"hello"}'
```

인증 토큰을 쿼리 스트링으로 전달하는 경우:

```yaml
config:
  target: "ws://localhost:3000"
  variables:
    token: "test-token"

scenarios:
  - engine: ws
    flow:
      - connect: "{{ target }}/ws?token={{ token }}"
      - send: '{"type":"ping"}'
```

## 11. Socket.IO 테스트

Socket.IO는 `engine: socketio`를 사용한다.

```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 120
      arrivalRate: 20
  socketio:
    transports:
      - "websocket"

scenarios:
  - name: "socket.io chat"
    engine: socketio
    flow:
      - emit:
          - "join"
          - roomId: "load-test"
      - think: 1
      - emit:
          - "message"
          - roomId: "load-test"
            text: "hello from artillery"
```

주의:

- Socket.IO 서버 버전과 Artillery 엔진 호환성을 확인한다.
- 브라우저와 달리 쿠키, 헤더, transport 설정이 자동으로 같지 않다.
- 인증이 handshake query/header에 묶여 있으면 실제 서버 인증 방식과 동일하게 구성해야 한다.

## 12. 결과 리포트 저장

```bash
# JSON 리포트 저장
mkdir -p reports
npx artillery run tests/performance/api.yml --output reports/api-report.json

# HTML 리포트 생성
npx artillery report reports/api-report.json --output reports/api-report.html

# JSON 리포트 및 HTML 리포트 생성
"TARGET_URL=${TARGET_URL:-http://localhost:2929} artillery run tests/performance/load.yml --output reports/load.json && artillery report reports/load.json --output reports/load.html",
```

CI에서는 JSON과 HTML을 artifact로 저장한다.

## 13. Docker 실행

### Dockerfile

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tests ./tests

ENV TARGET_URL=http://host.docker.internal:3000

CMD ["npx", "artillery", "run", "tests/performance/api.yml", "--output", "reports/api-report.json"]
```

### docker-compose.yml

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: test

  artillery:
    image: node:22-alpine
    working_dir: /app
    depends_on:
      - api
    volumes:
      - .:/app
    environment:
      TARGET_URL: http://api:3000
    command: sh -c "npm ci && npx artillery run tests/performance/api.yml --output reports/api-report.json"
```

실행:

```bash
docker compose run --rm artillery
npx artillery report reports/api-report.json --output reports/api-report.html
```

## 14. Prometheus, Grafana, Loki와 함께 보기

Artillery는 클라이언트 관점의 결과를 제공한다. Prometheus, Grafana, Loki는 서버 관점의 상태를 보여준다. 둘을 같은 시간축에서 비교해야 병목을 찾을 수 있다.

### Node.js 서버에서 남길 권장 메트릭

Prometheus:

- `http_requests_total{method,route,status}`
- `http_request_duration_seconds_bucket{method,route,status}`
- `process_cpu_user_seconds_total`
- `process_resident_memory_bytes`
- `nodejs_eventloop_lag_seconds`
- `nodejs_gc_duration_seconds`
- active connection 수

Loki:

- request id
- route
- status code
- latency ms
- user id 또는 test user marker
- error stack
- upstream timeout 여부

Artillery 요청에 `x-request-id`와 `x-load-test-run-id`를 넣으면 로그와 테스트 결과를 연결하기 쉽다.

```yaml
config:
  defaults:
    headers:
      x-load-test-run-id: "{{ $processEnvironment.LOAD_TEST_RUN_ID }}"
```

실행:

```bash
LOAD_TEST_RUN_ID=$(date +%Y%m%d%H%M%S) TARGET_URL=https://staging.example.com \
  npx artillery run tests/performance/api.yml --output reports/api-report.json
```

예제 프로젝트 Docker Compose 구성:

| 서비스 | 포트 | 역할 |
| --- | --- | --- |
| `target-server` | `2929 -> 3000` | Artillery가 부하를 주는 Node.js 테스트 대상 서버 |
| `prometheus` | `2930 -> 9090` | `target-server:/metrics`를 수집하는 메트릭 저장소 |
| `grafana` | `2931 -> 3000` | Prometheus 메트릭과 Loki 로그를 보는 대시보드 |
| `loki` | `2932 -> 3100` | 컨테이너 로그 저장소 |
| `promtail` | `2933 -> 9080` | Docker 로그를 읽어서 Loki로 전달 |
| `artillery-load` | 없음 | `load.yml`을 실행하고 JSON/HTML 리포트를 생성하는 일회성 컨테이너 |
| `artillery-stress` | 없음 | `stress.yml`을 실행하고 JSON/HTML 리포트를 생성하는 일회성 컨테이너 |

```bash
docker-compose up -d --build target-server prometheus grafana loki promtail
docker-compose run --rm artillery-load
docker-compose run --rm artillery-stress
```

### Grafana에서 같이 볼 패널

- RPS: Artillery observed RPS vs server `rate(http_requests_total[1m])`
- Latency: Artillery p95/p99 vs server histogram p95/p99
- Error: Artillery error rate vs server 5xx/4xx
- Runtime: CPU, memory, event loop lag, GC duration
- Logs: `x-load-test-run-id` 기준 Loki 검색

### 해석 기준

- Artillery latency만 높고 서버 latency는 낮으면 네트워크, DNS, TLS, load generator 자원 부족을 의심한다.
- 서버 latency도 함께 높으면 애플리케이션 또는 의존성 병목이다.
- 서버 CPU가 낮은데 RPS가 더 오르지 않으면 connection limit, reverse proxy, rate limit, 외부 의존성을 확인한다.
- event loop lag가 증가하면 CPU-bound 작업, JSON 직렬화, 동기 I/O를 의심한다.

## 15. 최소 도입 체크리스트

- `tests/performance/api.yml` 생성
- 작은 부하로 로컬 실행 성공
- staging 대상 smoke load test 성공
- JWT 또는 인증 흐름 반영
- p95, p99, error rate 기준 정의
- JSON/HTML 리포트 생성
- CI artifact 저장
- Prometheus/Grafana/Loki에서 같은 시간대 서버 지표 확인
- 운영 대상 테스트 안전장치 문서화


## 참고 문서

- Artillery Test Script Reference: https://www.artillery.io/docs/reference/test-script
- Artillery HTTP Engine: https://www.artillery.io/docs/reference/engines/http
- Artillery WebSocket Engine: https://www.artillery.io/docs/reference/engines/websocket
- Artillery Socket.IO Engine: https://www.artillery.io/docs/reference/engines/socketio
- Artillery GitHub Actions Guide: https://www.artillery.io/docs/cicd/github-actions
