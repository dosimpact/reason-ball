# 2026-10-18 — Canvas 구현 검증

## 기준과 범위

[요구사항 B~D](../../요구사항.md)의 핵심 및 C의 P0~P4, D의 DuckDB·freshness·호환성 확장을 대상으로 한다. Python LangGraph + OpenUI Chat 유지, 별도 Canvas 렌더링, 대상 위젯 수정, 조회 도구와 모델 없는 갱신, 브라우저 저장·복원 및 실패 보존이 구현 범위다. C/P5의 공유·보고서·되돌리기·임의 Chat Root 일부 추출은 합의된 후속 범위이며 완료로 계산하지 않는다.

실제 모델 검증은 현재 환경의 OpenAI API와 합성 DuckDB를 사용했다. 결정적 오류·교차 스트림·polling 시나리오는 fixture를 사용하며 실제 provider 검증과 구분한다. 자연어 몇 가지의 성공을 모든 표현이나 임의 OpenUI 프로그램의 지원으로 일반화하지 않는다.

## 요구사항별 증거

| 요구사항 / 실험 | 구현 및 확인한 결과 | 증거 |
|---|---|---|
| CHAT-01~03, P0 | 일반 Chat에서 실제 DuckDB 조회→OpenUI 차트→같은 결과 표. Canvas는 미변경 | E2E `ordinary Chat uses DuckDB OpenUI…`; 기존 라이브러리 단위 테스트 |
| CANVAS-01~04, CONTEXT-04, P3 | 한 요청으로 독립 위젯 두 개, Chat 설명, 읽기 요청 이후 위젯 동일성 | 실제 provider E2E `real Python model + DuckDB…` |
| PATCH-01~03, PATCH-05~06, SPIKE-01~02 | 기간·KR 필터·고정 7~9월 범위, 기존과 다른 차트 종류·제목으로 변경. 다른 위젯 객체 동일성, 기존 queryId 재사용 | 위 실제 E2E, `test_canvas_graph.py`, `test_analytics.py` |
| STREAM-01~02, SPIKE-03, P2 | Chat과 두 위젯의 delta 교차 전송, 반으로 나눈 SSE 프레임, commit 전에 실제 차트 표시. 완료만 저장 | E2E `interleaved partial SSE frames…` (결정적 fixture) |
| STREAM-04, CONTEXT-03, SPIKE-05 | Cancel 버튼→Python cancelledRuns 증가·activeRuns=0, 기존 위젯 동일성. 종료된 run의 늦은 commit과 중복 frame 차단 | 실제 취소 E2E 및 `store.test.ts`. 외부 공급자의 과금 취소까지 보장하는 검사는 아님 |
| CONTEXT-01~02, SPIKE-07 | 선택 ID로 대상 지정. 동일 제목 두 위젯은 어느 대상인지 확인하고 조회·수정하지 않음 | 실제 provider 생성/수정 및 `duplicate titles require clarification…` |
| SAVE-01~03, SPIKE-04, P4 | 완료 데이터·프로그램 reload 복원, 오프라인 오류 시 마지막 데이터 보존, 저장 공간 오류 표시 | 실제 provider E2E, 독립 offline fixture E2E, store quota 회귀 |
| DATA-01~03, SPIKE-08 | describe/validate/execute/register, 실제 합계·KR+US 합계·정렬·집계 JOIN, 0 분모 누락값 처리, 금지 SQL·외부 접근 거부, 2초 interrupt와 연결 회복, registry 재개 | `test_analytics.py` 25개, 실제 provider E2E |
| FRESH-01, PATCH-07, SPIKE-09 | fixture 매출 +100 후 대상 snapshot/dataVersion 변경. queryId·program·다른 위젯 보존, 모델 호출수 불변 | 실제 provider E2E 및 registry refresh 단위 테스트 |
| FRESH-02~03 | 10초 테스트 시계 polling, 모델 요청 0회, 실패 데이터 보존·backoff, Snapshot 전환 후 요청 정지 | E2E `polling refreshes data…`; production 기본은 수동이며 polling 간격은 위젯 정책 |
| FRESH-04 | fetchedAt과 sourceWatermark 별도 표시, ingestion revision 추적, 매 조회 UTC rolling 해석과 고정 범위 유지 | 실제 화면 및 `test_fixed_range_and_rolling_range_resolve_at_each_read` |
| SPIKE-09 지연/중복 | 동일 조회 병합, 필터 변경 중 옛 응답 폐기 후 최신 필터 조회, 오류 backoff | `store.test.ts` |
| COMPAT-01, SPIKE-10 | v0 envelope→v1 복원, 고정 기간 보존, 미지원 문서·카탈로그 원본 Save 차단, 제한된 데이터 표만 표시하며 프로그램·Query 실행 없음 | compatibility E2E 3개, `model.test.ts` |

## 채택한 제한과 후보 기능

- Canvas는 독립 root + 등록된 `CanvasChart`를 지원한다. 데이터는 host snapshot context로 주입한다. 서버 조회·렌더러·저장 스키마의 버전을 따로 검사한다. 런타임의 OpenUI 패키지를 임의로 바꾸어도 자동 호환된다는 의미는 아니다.
- 원본 데이터 가정값 수정, 예측 생성, 자유로운 요약·표 카드, 임의 Root 추출, 계정별 저장·공유·보고서·undo·복사 대시보드는 채택하지 않은 후보 또는 후속 범위다. 데이터 표는 차트 조회 결과 보기와 호환성 대체 표시로 제공한다.
- 삭제·맨 위로 이동은 UI에서 제공한다. 자연어 삭제는 작업 계획에 포함한다. 전용 실패 위젯 재시도 버튼은 없으며 재요청 안내를 표시한다. 실행은 위젯별 순차 처리이고 Cancel은 현재 요청을 중단한다.
- 단일 로컬 서비스가 DuckDB를 소유한다. 운영 인증·멀티테넌트·공개 배포·push/CDC는 검증하지 않았다. Chat 설명은 생성 당시 값이며 이후 API 조회가 설명을 자동 재생성하지 않는다.
- 소스 UI의 기존 lint 경고 5개는 남아 있다. 이번 변경의 lint 오류는 없다.

## 실행 명령과 산출물

- Python: `uv run pytest -q`, `uv run ruff check agent tests`.
- Frontend: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- 브라우저: `npm run test:e2e`. 테스트가 전용 포트 2037/3045의 서버와 Chrome을 생성하고 종료한다.
- HTML: `frontend/output/playwright-report/index.html`; JSON: `frontend/output/validation/e2e.json`; 화면: `frontend/output/playwright/real-created.png`, `real-refreshed.png`, `ordinary-chat.png`.
- 관련 stock: [제품](../stock/business.md), [시스템](../stock/system.md). 실패 원인과 수정 경위는 [구현 flow](2026-10-18-canvas-implementation.md)에 보존했다.

## 최종 결과

- Python **39 passed**, Ruff 통과.
- Frontend **330 passed**, typecheck·production build 통과. Lint **0 errors / 기존 5 warnings**.
- `npm run test:e2e`: **10 passed, 53.0초**. JSON의 expected=10, skipped=0, unexpected=0, flaky=0 확인. 기존 차트와 반대 종류로 변경하고 제목도 바뀌는 것을 검사하도록 최종 시나리오를 강화했다.
- 테스트가 자체 서버를 시작·종료하는 기본 실행 경로까지 검증했다. 소유 Chrome PID 36035 종료, 6-4 테스트 runner/서버 없음, 2037/3045 listener 없음 확인. 증거: `frontend/output/validation/process-cleanup.json`. 다른 작업 및 사용자의 Chrome은 종료하지 않았다.
- 완료 감사: 위 표의 채택된 핵심 및 확장 범위에 미검증 필수 항목은 없다. 후보·후속 기능은 위 제한에 명시했고 완료로 표시하지 않았다. 현재 stock·README·포트 지침을 동기화했다. 변경은 작업 트리에 있으며 이번 구현을 별도로 커밋·push하지 않았다.
