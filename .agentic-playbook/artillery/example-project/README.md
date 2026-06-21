# Artillery Onboarding Example Project

이 예제는 Artillery를 실제 Node.js 서버에 적용해 보며 온보딩하기 위한 프로젝트다.

포함 항목:

- 테스트 대상 Express 서버
- JWT 로그인, 목록 조회, 생성 API
- 의도적으로 느린 API, CPU 부하 API, flaky API
- WebSocket `/ws`
- Socket.IO 이벤트
- Prometheus `/metrics`
- load, stress, spike, soak, WebSocket, Socket.IO Artillery 시나리오
- Docker Compose 실행 예시
- GitHub Actions/GitLab CI 예시

상위 문서:

- [goal.md](../goal.md)
- [playbook.md](../playbook.md)

## 1. 설치

```bash
cd /Users/studio/workspace/Research/Artillery/example-project
pnpm install
```

## 2. 테스트 대상 서버 실행

```bash
pnpm start
```

서버 기본 주소:

```text
http://localhost:3000
```

주요 엔드포인트:

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/health` | 헬스 체크 |
| POST | `/api/auth/login` | JWT 발급 |
| GET | `/api/items` | 인증 필요, 목록 조회 |
| POST | `/api/items` | 인증 필요, 아이템 생성 |
| GET | `/api/slow?delayMs=500` | 인증 필요, 느린 응답 |
| GET | `/api/cpu?ms=80` | 인증 필요, CPU 부하 |
| GET | `/api/flaky?failureRate=0.05` | 인증 필요, 의도적 실패 |
| GET | `/metrics` | Prometheus 메트릭 |
| WS | `/ws` | WebSocket echo |
| Socket.IO | `/socket.io` | Socket.IO 기본 path |

## 3. Smoke Test

서버가 켜진 상태에서 가장 먼저 실행한다.

```bash
pnpm run test:smoke
```

이 테스트는 `health -> login -> list -> create` 흐름이 정상인지 확인한다.

## 4. Load Test

목표 부하에서 정상 동작하는지 확인한다.

```bash
pnpm run test:load
pnpm run report:load
```

결과:

```text
reports/load.json
reports/load.html
```

시나리오 파일:

```text
tests/performance/load.yml
```

## 5. Stress Test

부하를 단계적으로 올려 한계점과 실패 양상을 확인한다.

```bash
pnpm run test:stress
pnpm run report:stress
```

시나리오 특징:

- `arrivalRate`를 5에서 40까지 증가
- `/api/cpu`로 Node.js event loop 압박
- `/api/flaky`로 일부 503 응답 생성
- `maxVusers`로 runaway 방지

시나리오 파일:

```text
tests/performance/stress.yml
```

## 6. Spike Test

짧은 시간에 갑자기 트래픽이 몰릴 때 회복 가능한지 확인한다.

```bash
pnpm run test:spike
pnpm run report:spike
```

시나리오 특징:

- baseline 3 arrivals/sec
- spike 80 arrivals/sec
- recovery 5 arrivals/sec

시나리오 파일:

```text
tests/performance/spike.yml
```

## 7. Soak Test

장시간 안정성, 메모리 증가, 누수 가능성을 본다.

```bash
pnpm run test:soak
pnpm run report:soak
```

예제에서는 온보딩용으로 5분만 실행한다. 실제 환경에서는 1~4시간 이상으로 늘린다.

시나리오 파일:

```text
tests/performance/soak.yml
```

## 8. WebSocket Test

```bash
pnpm run test:websocket
```

시나리오 파일:

```text
tests/performance/websocket.yml
```

## 9. Socket.IO Test

```bash
pnpm run test:socketio
```

시나리오 파일:

```text
tests/performance/socketio.yml
```

## 10. 환경 변수

대상 URL을 바꾸려면 다음처럼 실행한다.

```bash
TARGET_URL=https://staging.example.com pnpm run test:load
```

WebSocket 대상 URL:

```bash
WS_TARGET_URL=wss://staging.example.com pnpm run test:websocket
```

로그와 메트릭 상관관계를 보기 위한 run id:

```bash
LOAD_TEST_RUN_ID=$(date +%Y%m%d%H%M%S) pnpm run test:load
```

## 11. 결과 해석

Artillery CLI 출력에서 먼저 볼 항목:

- `http.request_rate`: 초당 요청 수
- `http.response_time.median`: 일반적인 응답 시간
- `http.response_time.p95`: 느린 5% 요청의 경계
- `http.response_time.p99`: tail latency
- `http.codes.2xx`, `http.codes.4xx`, `http.codes.5xx`: 상태 코드 분포
- `errors.*`: timeout, connection reset 등

서버 메트릭 확인:

```bash
curl http://localhost:3000/metrics
```

같이 볼 지표:

- `http_requests_total`
- `http_request_duration_seconds_bucket`
- `process_resident_memory_bytes`
- `nodejs_eventloop_lag_seconds`
- `nodejs_gc_duration_seconds`

## 12. Docker Compose

```bash
docker compose up --build target-server
docker compose run --rm artillery-load
docker compose run --rm artillery-stress
```

## 13. CI

CI 예시는 다음 파일에 있다.

```text
.github/workflows/performance-test.yml
.gitlab-ci.yml
```

PR에서는 smoke 또는 짧은 load test를 돌리고, schedule/manual job에서는 stress/soak을 돌리는 식으로 분리한다.

## 14. 온보딩 순서

1. `pnpm install`
2. `pnpm start`
3. `pnpm run test:smoke`
4. `tests/performance/http-smoke.yml`을 열어 YAML 구조 확인
5. `tests/performance/processor.js`에서 동적 데이터와 헤더 처리 확인
6. `pnpm run test:load`
7. `reports/load.html` 생성 후 p95/p99/error rate 확인
8. `pnpm run test:stress`
9. `/metrics`와 서버 로그를 보며 병목 징후 확인
10. `spike`, `soak`, `websocket`, `socketio` 시나리오 순서로 확장
