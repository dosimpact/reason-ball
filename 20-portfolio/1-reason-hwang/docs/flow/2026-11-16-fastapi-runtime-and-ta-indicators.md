# FastAPI 그래프 실행 런타임과 기술적 분석 지표 확장

- 날짜: 2026-11-16
- 상태: 구현·API 검증·테스트 자원 정리 완료; 브라우저 검증은 사용자 수행
- 결정 ID: FASTAPI-RUNTIME-001, TA-INDICATORS-020

## 범위와 승인

LangGraph 개발 서버의 실행 계약을 단일 프로세스 FastAPI 런타임에 구현하고 `/fastapi-chat`을 별도로 제공한다. 기존 `/langgraph-dev-chat`와 개발 서버 기록은 유지하며 기록을 자동 이관하지 않는다. 이후 기술적 분석 지표 20종과 같은 지표의 복수 설정을 확장한다. 사용자 지시에 따라 브라우저 검증은 실행하지 않고 API 검증을 수행한다. 초기에는 커밋하지 않기로 했으며, 최종 승인으로 구현 담당이 런타임/지표 확장을 두 개의 관련 커밋으로 정리한다. 검증 담당은 stage/commit하지 않는다.

## 검증 설계

- 실제 등록 그래프 10개의 발견 및 입력·출력 스키마를 HTTP로 확인한다.
- 생산용 GraphRegistry/RunManager와 실제 PostgreSQL checkpointer를 공유하는 결정론적 컴파일 그래프로 values/messages/custom, 도구 ID, 실행 중 첫 이벤트, 오류, 취소, 연결 해제 후 계속 실행을 확인한다. 이 fixture 결과를 실제 외부 모델·Yahoo 실행 결과로 표현하지 않는다.
- 같은 스레드 후속 실행과 실제 별도 OS 프로세스 재시작 후 체크포인트·메시지 복원 및 연속 실행을 확인한다. 메모리 saver 검증으로 대체하지 않는다.
- 대표 실제 그래프와 모델 없는 차트 Query를 별도로 확인한다. SEC 외부 쓰기·전체 수집을 실행하지 않는다.
- 단일 프로세스의 수용량·대기열 및 같은 스레드 실행 정책을 확인한다. 전체 LangGraph 프로토콜·멀티워커 구현으로 주장하지 않는다.
- 20종 지표는 런타임 안정화 후 수치 fixture, warmup/null, 복수 설정, 기존 요청 호환, Query 갱신의 모델 비호출을 확인한다.

## 격리 및 현재 증거

Bruno API E2E 스킬과 PostgreSQL best-practices 스킬을 적용한다. 전용 포트 3981, 별도 `qa_fastapi_20261116_*` 스키마를 사용하며 사용자 서비스와 데이터는 종료·변경하지 않는다. PostgreSQL local 준비의 public 레거시 테이블 이동은 기본 비활성화하고, 레거시 backfill은 명시 opt-in으로 제한한다.

초기 부팅에서 실제 PostgreSQL을 사용하는 FastAPI의 `POST /assistants/search`가 HTTP 200이며 실제 등록 10개와 검증용 컴파일 그래프 1개가 발견되었다. 실행 검증·재시작·정리 결과는 후속 완료 시 이 새 기록에 추가한다. 현재는 완료 판정하지 않는다.

## 관련 stock

- [공용 시스템 설계](../stock/tech-shared/system-design.md)
- [공용 검증 설계](../stock/tech-shared/test-design.md)
- [Python 패키지 문서 지도](../stock/tech-shared/3-langgraph-fast/INDEX.md)
- [기술적 분석 문서 지도](../stock/technical-analysis/INDEX.md)

## Phase 1 실행 증거 (진행 중)

전용 FastAPI 3981과 validator Host 3183을 사용했다. 등록 실제 그래프 10개 전체의 발견·입출력 스키마 및 Host same-origin proxy의 발견 응답이 통과했다.

| 검증 | 실제 결과 |
| --- | --- |
| 실제 PostgreSQL + compiled QA graph | values, custom, messages-tuple 및 tool_call_id 보존 통과 |
| SDK 실시간 전송 | custom 첫 이벤트 약 13ms, 마지막 end 약 1.25초; 완료 전 이벤트 확인 |
| 같은 thread 후속 실행 | 메시지·상태 누적 2회 통과 |
| OS 프로세스 교체 | PID 9866 종료 후 PID 9967에서 동일 checkpoint_id·history·메시지 복원, 3회차 후속 실행 통과 |
| 취소·오류 | 실행 중 task 취소 interrupted 및 이후 success 미전환, 의도 오류 error 통과 |
| 연결 해제 | SSE 구독 연결을 닫은 뒤 원래 실행이 success로 완료되고 상태 저장됨 |
| 실제 task 수용량 | active 2 + queued 2, 초과 요청 HTTP 429와 Retry-After, 대기 실행 완료 통과 |
| 같은 thread 정책 | 직렬 실행, reject 409, 대기 중 취소로 해당 실행 미수행 통과 |
| 실제 SDK 그래프 | starter_graph 응답, price_agent Yahoo AAPL 5개 일봉, sec_deep_agent 일반 설명 통과; SEC 도구 호출·외부 쓰기 없음 |
| 실제 TA Bruno | 기존 inline Query/FinancialChart, Canvas custom open→validating→ready 및 UUID 상태 저장 통과 |

Canvas 모델 스트리밍은 현재 제공자의 기존 제한으로 전체 layout fallback을 사용했다. 관찰된 delta 2개를 실제 토큰 스트리밍 증거로 주장하지 않는다. 결정론적 QA graph의 messages/custom 실시간 전송과 별도로 구분한다.

Bruno 첫 실행은 본체 5개 요청이 통과했고 기존 dev용 cleanup 기대값 204와 FastAPI의 200이 달라 중단되었다. backend가 삭제 계약을 204로 맞추는 좁은 변경을 준비하며, 본체 모델 요청을 불필요하게 재실행하지 않고 삭제 검증을 별도로 재확인한다.

로컬 실행 증거: `/tmp/fastapi-parity-cases.json`, `/tmp/fastapi-runtime-bruno.json`. 임시 런타임 소유권은 `/tmp/fastapi-parity-owned.json`에 기록했다. 테스트 스키마와 서버 정리는 아직 진행 전이며 완료로 판정하지 않는다.

## 최종 API 결과와 정합성 수정

Phase1 Bruno 실제 inline/Canvas 본체5개 요청은 통과했다. 삭제204 수정 후 cleanup2개 요청을 별도로 재실행해 각각 PASS하고 GET404도 확인했다. 실제 SDK의 `stream_subgraphs=true`에서는 하위 그래프 namespace가 포함된 custom/values 이벤트도 확인했다. 비용 있는 모델 본체를 불필요하게 반복하지 않았다.

Phase2 첫 HTTP 요청에서 `Literal[1,2]`가 query 문자열 `2`를 거부하는422 오류를 발견했다. 정수 coercion과1~2 범위 검사를 적용한 뒤 실제 HTTP로 재확인했다.

- `scripts/validate_ta20_api.py`: 7개 검증 묶음 PASS. 실제 Yahoo 20종의 정렬·finite/null, OHLCV로 독립 계산한 SMA/AO/BBANDS(모표준편차)/Donchian/CMF 및 AD/PVT/OBV 차분을 대조했다.
- count60과120의 겹치는 날짜·누적값이 정확히 일치했다. 관찰된 AAPL origin은2000-01-03, 확보 이력6758봉이며 정책은 `calendar-2000-01-01-first-available-v1`이다. 전체 상장 이력으로 주장하지 않는다.
- 같은 SMA5/SMA20의 ID·숫자 구분, 기본 TSI/TRIX 주 지표만 출력 및 선택 signal9, 6개 잘못된 설정422, 41개 인스턴스422, legacy GET v1 flat-bar 응답을 확인했다.
- Host same-origin proxy를 통해40개 인스턴스·200봉을 조용히 자르지 않고 전달했다. 실제20종 출력에서 만든 최소 DSL은 IndicatorControls/catalog Query를 포함하고60000자 이내이며 Host parser가 valid로 판정했다.
- fixture 앱의 BaseChatModel invoke/stream 진입을 fail-closed로 막은 상태에서 모든 chart GET이 성공했고 모델 진입 횟수는0이었다. 이는 fixture의 명시적 모델 진입 guard 증거이며 외부 네트워크 패킷 감청을 수행한 것은 아니다.
- Bruno `25-ta20-indicators`: 3 requests / 3 tests / 3 assertions PASS,243ms.
- 실제 inline `input.analysis_request` 전체20종/60봉:2.88초, presentation14529자, parser valid, Canvas 이벤트0, 모델 guard0.
- 실제 Canvas `input.canvas_context.request` 전체20종/60봉:58.32초(100초 상한), 서버 report UUID·request20·analysis20·ready, program15228자, parser valid. provider의 전체-layout fallback을 사용했으며 delta2개를 token streaming 성공으로 해석하지 않는다.
- 자연어 전체20 tool routing은 `test_scripted_model_all20_tool_route_through_each_agent[False/True]` 두 단위 회귀가 확인한다. 실제 create_deep_agent와 두 workflow를 거치되 모델의 tool_calls는 스크립트한 fixture다. 외부 모델의 자연어 해석 품질 검증으로 주장하지 않는다.

마지막 검토에서 새 기본3지표 분석이 v1 snapshot을 생성해 지표 추가 control이 없는 결함을 수정했다. 새 분석은 항상 v2, 기존 GET v1·legacy reader는 유지한다. 새 isolated PG/실제 inline structured request(indicators 생략)로 SMA20·RSI14·MACD12/26/9, snapshot v2, IndicatorControls, parser valid, 모델 guard0 및 GET v1 호환을 다시 확인했다. 추가 모델 호출은 없었다. backend 최종 관련79개 테스트 PASS, frontend typecheck/소유 ESLint/FSD PASS 보고를 받았다. 전체 lint의 기존 DART 오류는 별도 기존 문제이며 이번 API 성공으로 해소됐다고 주장하지 않는다.

## 최종 자원 정리

1차 schema `qa_fastapi_20261116_1e6eff68`와 마지막 기본3 확인 schema `qa_fastapi_20261116_05223bc7`를 각각 정확한 소유 식별자로 삭제했다. 각12개 테이블을 포함한 schema 삭제 후 information_schema에서 부재를 확인했다. 사용자 기존 schema·데이터는 삭제하지 않았다.

소유 FastAPI/Next process group을 확인한 뒤 TERM으로 종료했다. 최종 PID17891/17901 및 앞선16547/11860/11867이 사라지고3981/3183 listen이 없음을 확인했다. `.next-fastapi-parity-validation`과 그 TypeScript include를 제거하고 next-env/tsconfig는 마지막 시작 전 바이트와 정확히 일치하게 복구했다. 사용자 서비스·브라우저·공유 MCP는 종료하지 않았다. 이 작업은 브라우저나 MCP 세션을 만들지 않았다.

최종 로컬 증거: `/tmp/ta20-api-evidence.json`, `/tmp/ta20-bruno.json`, `/tmp/fastapi-parity-cases.json`, `/tmp/ta20-default3-final.json`, `/tmp/ta20-generated-program.txt`. 로그는 소유 임시 `fastapi-parity-*` 디렉터리에 남기며 저장소에는 커밋하지 않는다. API/정리 gate는 통과했고 화면·테마·모바일의 실제 브라우저 동작은 사용자에게 명시적으로 맡긴 범위다.

적용 스킬: `../../.agentic-playbook-rc/apb-bruno-api-tests/SKILL.md`, `/Users/studio/workspace/projects/reason-ball/.agents/skills/supabase-postgres-best-practices/SKILL.md`.
