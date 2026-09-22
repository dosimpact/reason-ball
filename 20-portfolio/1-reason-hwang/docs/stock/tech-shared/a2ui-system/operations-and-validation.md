# 운영과 검증

[문서 지도](INDEX.md). 명령은 별도 표시가 없으면 `1-reason-hwang` 워크스페이스 루트에서 실행한다. 브라우저 E2E, Storybook, 빌드 및 API 검증은 **하나씩 순차 실행**한다.

## 설정과 실행

| 변수 | 소비자 | 의미/기본값 |
| --- | --- | --- |
| A2UI_LANGGRAPH_URL | Host 서버 | FastAPI base URL, 기본 `http://127.0.0.1:8000` |
| A2UI_SEC_BFF_URL | Python | 기존 SEC BFF, 기본 `http://127.0.0.1:2801` |
| A2UI_MODEL_PROVIDER | Python | oauth-proxy(기본) 또는 api-key |
| A2UI_MODEL | Python | 필수 모델명, 없으면 OPENAI_MODEL 사용 |
| A2UI_MODEL_BASE_URL | Python | OAuth: OPENAI_BASE_URL 또는 `http://127.0.0.1:18741/v1`; API key: `https://api.openai.com/v1` |
| A2UI_MODEL_API_KEY | Python | OAuth는 로컬 프록시용 placeholder 기본값; API key는 OPENAI_API_KEY 대체값 허용, 빈 값/placeholder 거절 |
| NEXT_DIST_DIR | Host | 별도 빌드 출력 디렉터리, 기본 `.next` |

OAuth 프록시의 실제 배포 포트와 모델명은 실행 환경에 맞춰 명시한다. 이 작업에서는 프록시2890과 gpt-5.6-luna를 사용했지만 코드 기본값과 같다고 가정하지 않는다. API-key 비밀값은 로컬 비추적 환경 설정으로 공급하고 문서·명령 로그에 쓰지 않는다. 자동 provider 전환은 없다. 모델 timeout120초/max_retries1과 화면 계약 재시도1회는 서로 다른 계층의 정책이다.

예시 전용 포트로 실행:

```sh
A2UI_MODEL_PROVIDER=oauth-proxy A2UI_MODEL=gpt-5.6-luna A2UI_MODEL_BASE_URL=http://127.0.0.1:2890/v1 A2UI_SEC_BFF_URL=http://127.0.0.1:18101 pnpm --filter reason-hwang-langgraph-fast start --host 127.0.0.1 --port 18082
```

다른 터미널에서:

```sh
A2UI_LANGGRAPH_URL=http://127.0.0.1:18082 pnpm --filter reason-hwang-fe-host dev --port 2819
```

위 포트는 예시이며 점유 중인 서버를 덮어 실행하지 않는다. SEC에는 별도로 기존 BFF/DB가 필요하다. 새 스키마나 대량 수집은 A2UI 테스트의 전제가 아니다. 채팅은 일반 안내와 조회/분석 도구 선택에도 모델을 사용한다. 화면의 회사/공시 조회 버튼 action은 모델 없이 실행한다.

화면은 `/a2ui`, `/a2ui/catalog`, `/a2ui/dynamic`, `/a2ui/fixed`, `/a2ui/sec`다. 프런트엔드와 FastAPI 포트를 혼동하지 않는다. `2815~2819` 등 작업 중 사용한 preview 포트는 영구 프로젝트 기본값이 아니며 실행 생존 여부는 매번 확인한다.

## 빌드와 배포

```sh
pnpm --filter reason-hwang-fe-host build
A2UI_LANGGRAPH_URL=http://127.0.0.1:18082 pnpm --filter reason-hwang-fe-host start --hostname 127.0.0.1 --port 2819
pnpm --filter reason-hwang-langgraph-fast build
```

별도 NEXT_DIST_DIR를 사용했다면 build와 start 양쪽에 같은 값을 설정한다. Next가 생성한 임시 디렉터리 참조를 tsconfig/next-env에 남기지 않는다. Python wheel에는 `domains`, `graph`, `infrastructure`, `server`와 graph 내부 계약 JSON이 포함되어야 한다. 실행 중인 사용자 서버는 임의 종료하지 않는다.

## 검사 순서

```sh
pnpm a2ui:check
pnpm --filter reason-hwang-fe-host test:a2ui
pnpm --filter reason-hwang-fe-host test:a2ui:views
pnpm --filter reason-hwang-fe-host typecheck
pnpm --filter reason-hwang-fe-host lint
pnpm --filter reason-hwang-langgraph-fast test
pnpm --filter reason-hwang-langgraph-fast typecheck
pnpm --filter reason-hwang-langgraph-fast lint
pnpm --filter reason-hwang-langgraph-fast test:a2ui:api --env-var baseUrl=http://127.0.0.1:18082
```

SEC Bruno는 패키지 내부에서:

```sh
cd 3-langgraph-fast/bruno-api-tests
../node_modules/.bin/bru run 14-sec-a2ui --env local --env-var baseUrl=http://127.0.0.1:18082
```

실모델 여섯 질문 유형은 Python 패키지 디렉터리에서 모델 설정 후:

```sh
A2UI_LIVE_TESTS=1 uv run pytest tests/test_a2ui_live.py -q
```

fixture 단위 테스트는 실모델 제공자 검증을 대체하지 않는다. 두 provider는 각각 별도 실행한다. DB opt-in 검사와 비용 발생 live 검사 skip을 PASS로 합산하지 않는다. 서버 변경은 Bruno, View 변경은 Storybook, 업무 동작 변경은 MCP 브라우저를 누적 적용한다.

## 확인된 증거와 남은 항목

2026-09-21 작업 기록 기준이다. 개수는 해당 실행 시점의 증거이며 이후 코드 전체에 대한 자동 인증이 아니다.

| 범위 | 증거 | 상태 |
| --- | --- | --- |
| Registry/버전 | 61파일/66어댑터/4카탈로그 검사, manifest | PASS 기록 |
| 프런트 계약 | 카탈로그 편집 후 69테스트 | PASS |
| Storybook | 진행 View 포함 75테스트, 단일 worker | PASS |
| Python | 취소·장애 복구 보강 후 143 PASS / 13 SKIP | PASS와 opt-in SKIP 구분 |
| Dynamic/Fixed Bruno | 진행 이벤트 추가 후 7요청/8테스트/8assertion | PASS |
| SEC Bruno | 실제 Apple 저장 공시, 8요청/8테스트/8assertion | PASS, 최종 취소 복구 수정본49.257초 재검증 |
| OAuth 실모델 | Dynamic 여섯 질문 유형, SEC 근거 보고서 | 실행 증거 확보 |
| 브라우저 | 생성 전 진행, 취소/재실행/새 대화; 카탈로그 편집/오류/모바일; SEC 정상 보고서 | 실행 증거 확보 |
| 별도 API-key 모델 | 로컬/프로세스 비placeholder 자격 증명 없음 확인 | 현재 검증 범위 밖, 실모델 미검증 |
| 최종 생산 빌드 | 취소 code 분기 반영 후 별도 출력 디렉터리로 build | PASS, 16개 페이지 생성 및 타입 검사 |
| Python 정적 검사 | 타입0오류; 전체 lint는 변경 없는18파일의48오류 | 전체 lint FAIL, A2UI/SEC 변경 범위 lint PASS |
| SEC 예외/페이지/취소 | 회사·공시 페이지 이동, 선택 초기화, 미저장 보고서 차단 브라우저 PASS | 취소·즉시 재시도 브라우저 PASS; API503/모델 예외 복구 graph검사 PASS, 브라우저 통신 실패·복구 PASS; RUN_ERROR SSE fixture 브라우저 처리 PASS; 실제 상위 장애 전체 경로는 미검증 |
| SEC 표시 시각 | 원문 응답 직후 캡처로 보정, 시계 전진 회귀 테스트 | 회귀·API·브라우저 표시 PASS |
| Python wheel | 조회 시각·취소 복구 보정 후 재빌드 및25파일 소스 일치 | PASS |

사용자 결정으로 실모델 검증은 OAuth로 한정한다. 이 범위의 구현·필수 검증을 완료했다. 전체 Python lint의 기존 오류와 API-key 미검증은 위 표대로 구분한다.

## 문제 해결

| 증상 | 확인할 경계 |
| --- | --- |
| 계약422 | 브라우저/Runtime/Python manifest 버전·catalogId·sha256, 생성물 재배포 |
| action422 | 해당 thread의 surface/source ID, 허용 입력 및 SEC revision |
| 409/429 | 같은 thread 실행 중 여부, StreamGate 용량 |
| 처음 SEC 화면 없음 | 실제 ToolNode/TOOL_CALL_RESULT, 단순 STATE_SNAPSHOT만 반환하지 않는지 |
| action 이후 화면 그대로 | 상위 SurfaceStreamProvider의 실행 전 구독, surfaceId, toolCallId 중복 제거 및 서버 재시작 여부 |
| 생성 실패 | 전용 모델 설정·provider 호환성, 서버의 sanitized 오류, 계약/facts 검증 |
| SEC 보고서 버튼 비활성 | 원문 저장됨 필터, 선택 공시 status와 본문 API 상태 |
| 카탈로그 데이터가 안 바뀜 | 해당 속성의 path 바인딩 여부, JSON 적용 버튼, 고정 속성 여부 |
| 취소가 실패로 표시 | RUN_ERROR code=abort 분기와 종료 판정 중복 방지 |
| Storybook import 오류 | 늦은 Vite 의존성 최적화, optimizeDeps 또는 순수 View 분리 |

## 검증 기록

- [계약·API](../../../flow/2026-09-21-a2ui-contract-and-api-validation.md)
- [브라우저·수치 근거](../../../flow/2026-09-21-a2ui-browser-and-grounding.md)
- [기존 생산 빌드](../../../flow/2026-09-21-a2ui-production-validation.md)
- [카탈로그 편집](../../../flow/2026-09-21-a2ui-catalog-playground-validation.md)
- [진행 SSE](../../../flow/2026-09-21-a2ui-progress-validation.md)
- [SEC 범위](../../../flow/2026-09-21-sec-a2ui-scope.md)

- [SEC 확장 이후 wheel 검증](../../../flow/2026-09-21-a2ui-wheel-validation.md)

- [SEC 수정본 API 재검증](../../../flow/2026-09-21-sec-api-revalidation.md)

- [SEC 목록·미저장 원문 브라우저 검증](../../../flow/2026-09-21-sec-browser-pagination.md)

- [SEC 취소 직후 재시도 PASS](../../../flow/2026-09-21-sec-cancel-retry-pass.md)

- [SEC 상위 장애 복구 회귀 검사](../../../flow/2026-09-21-sec-failure-recovery-tests.md)

- [Python 정적 검사 재확인](../../../flow/2026-09-21-a2ui-final-python-static.md)

- [Python 회귀·패키징 및 제공자 설정 확인](../../../flow/2026-09-21-a2ui-python-regression-and-provider-check.md)

- [SEC 브라우저 통신 실패 복구](../../../flow/2026-09-21-sec-browser-transport-recovery.md)

- [RUN_ERROR 브라우저 처리](../../../flow/2026-09-21-a2ui-browser-run-error.md)

- [취소 복구 보정 후 최종 HTTP 회귀](../../../flow/2026-09-21-a2ui-final-http-regression.md)

## 현재 사용자 확인 서비스 (2026-09-22 갱신)

Host는 `http://localhost:2820/a2ui/sec`에서 개발 모드로 실행하며 FastAPI 기본 연결 `http://127.0.0.1:8000`을 사용한다. BFF는2801, OAuth 프록시는2890이다. Python 모델 설정은 로컬 비추적 `.env`를 읽는다. 재시작 시 모델 환경 변수를 누락하지 않는다.

```sh
pnpm --filter reason-hwang-fe-host dev --port 2820
# Python 패키지 디렉터리에서 .env를 명시적으로 읽는다.
uv run uvicorn server.server:app --reload --env-file .env --host 127.0.0.1 --port 8000
```

SEC 에이전트 API와 브라우저 회귀는 실제 OAuth/BFF를 사용하므로 순차 실행한다.

```sh
pnpm --filter reason-hwang-langgraph-fast test:sec-agent:api --env-var baseUrl=http://127.0.0.1:8000
pnpm --filter reason-hwang-fe-host test:e2e:sec-agent
```

`test:e2e:sec-agent`는 사용자가 실행한2820을 명시적으로 대상으로 삼으며 서버를 생성/종료하지 않는다. 일반 Playwright 실행에서는 비용이 드는 SEC live spec을 건너뛴다. `PLAYWRIGHT_BASE_URL`을 지정하면 기존 config가 해당 URL을 사용하고 webServer를 실행하지 않는다. 사용자가 지정한 서비스에만 이 옵션을 사용한다.

[에이전트 전환과 검증 기록](../../../flow/2026-09-22-sec-agent-tools.md).


SEC-A2UI-11 실서비스 검증은 위 `test:sec-agent:api`(12요청)와 `test:e2e:sec-agent`(4시나리오)에 포함한다. Inline 이력·읽기 전용, Canvas 동일 ID 갱신, 위치 전환 상태 보존, Canvas 버튼의 발신 문맥을 검사한다. `test:a2ui:views`는 늦게 마운트한 화면과 중복 tool/activity 이벤트 회귀를 포함한다. [최종 증거](../../../flow/2026-09-22-sec-inline-canvas.md)를 참조한다.
