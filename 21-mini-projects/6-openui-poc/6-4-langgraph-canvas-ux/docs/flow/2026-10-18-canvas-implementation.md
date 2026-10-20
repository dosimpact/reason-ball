# Canvas 구현 및 검증 진행

- 요구사항 B~D의 핵심 및 DuckDB/freshness를 구현하고 후보 UX를 단계적으로 연결한다. 후속 공유·보고서·임의 Root 추출은 명시된 후속 범위로 유지한다.
- 원본과 reference는 변경하지 않는다. 전용 포트 2037/3045를 사용한다.
- 복사 검증 이력은 이번 실행의 증거가 아니다. 현재 검증 상태: 진행 중.
- 브라우저는 작업 소유 세션만 생성하고 종료 확인한다. MCP가 제공되지 않아 Playwright 직접 실행으로 탐색 후 spec을 작성한다.

## 2026-10-18 — 실제 브라우저 실패 분석과 쿼리 재사용 계약

- 최초 E2E에서 Canvas 생성 요청을 일반 Chat으로 처리한 실행을 확인했다. planner에 현재 workspace 문맥과 최신 사용자 메시지를 분리해 제공하고, Canvas 생성·읽기·모호한 수정 예제를 명시했다. HTML Canvas 설명으로 잘못 답한 실행도 확인해 앱 대시보드 의미를 명시했다. 자연어 일반화의 보장은 아니다.
- 두 위젯 생성 이후 선택 차트 수정에서 모델이 CURRENT_DATE SQL을 새로 생성했다. 기존 쿼리 파라미터 변경은 queryMode=reuse로 표현하고 서버가 새 SQL을 무시하도록 변경했다. 회귀 테스트는 모델이 SQL을 함께 반환해도 기존 queryId와 UI 상태가 유지되는 것을 확인한다.
- E2E의 설명 검증이 사용자 질문 텍스트에 잘못 매칭되는 부분을 실제 답변 paragraph 검사로 수정했다. SSE의 response.finished 대기 대신 앱의 소비 완료 상태 aria-busy=false를 검증한다.
- 오프라인 테스트가 선행 provider 테스트 산출물에 의존하지 않도록 독립 fixture로 변경했다.
- Chrome 실제 provider E2E: 생성 2개 → KR/최근3개월 선택 수정 → 다른 위젯 동일성 → 로컬 원천 +100 → 모델 호출수 불변 API 갱신 → reload 복원 → 설명 후 동일성 통과. 오프라인 조회 실패 보존, 미지원 문서 Save 차단, 브라우저 시계 기반 polling/backoff/snapshot 정지까지 **4 tests passed (20.6s)**.
- 생성 화면을 직접 확인했다. Chat의 기존 100dvw 크기를 부모 너비로 제한해 두 채널이 겹치는 문제를 수정했다.
- 스트림 회귀 6개 추가: 위젯 교차 delta/중복, 종료된 run의 늦은 commit, 최신 revision과 잘못된 프로그램 보존, 조회 중복 병합, 오류 보존/backoff, snapshot 조회 차단. frontend **328 tests passed**, typecheck 통과. Python **36 tests passed**, Ruff 통과. Lint는 0 errors / 기존 5 warnings.
- 마지막 4개 E2E 이후 고정 날짜 범위, UTC 매 조회 rolling 날짜 해석, singleton 생성 lock, 생성 중 snapshot 연결을 추가했다. 이 추가분에 대한 전체 브라우저 회귀는 아직 남아 있다. 일반 Chat의 실제 분석 차트·표 회귀도 별도 진행 중이다.
- 검증에 사용한 Playwright Chrome 프로세스 종료를 확인했으며 기존 사용자 Chrome은 유지했다. 새 E2E를 실행할 때마다 종료를 재확인한다.
- Stock business/system을 현재 구현과 남은 검증으로 재작성하고 AGENTS의 전용 포트를 2037/3045로 맞췄다. 완료 감사에서 일반 Chat, 취소/지연, 고정 범위, 미지원 카탈로그 대체 표시, SQL 제한 시간·0 분모, production build와 전체 회귀 증거를 추가 확인해야 한다.

## 2026-10-18 — 일반 Chat 회귀 보강

- 일반 Chat에서 SQL 도구 실패가 전체 스트림을 중단하는 사례를 확인했다. validate/execute 도구는 실패 원인과 실제 dataset 스키마를 반환해 모델이 수정할 수 있게 했다. Canvas 작업은 도구의 실패 응답을 검사하고 해당 위젯을 실패 처리한다. SQL allowlist를 완화하지 않았다.
- 기본 Chat 프롬프트에 허용 테이블·월별 집계·파라미터 계약을 명시했다. 실제 모델 + DuckDB로 Chat 막대 차트 → 같은 결과 표 표시, Canvas 미변경을 확인했다: **1 E2E passed (10.7s)**. 이 실행은 앞선 Canvas/polling 4개와 별도 실행이다. 현재 전체 5개 suite를 함께 다시 실행하는 완료 감사는 남아 있다.
- 최신 Ruff·typecheck 통과, Lint는 0 errors / 기존 5 warnings. production build 확인 중.
- `npm run build` production build 통과. 마지막 Chat E2E runner는 종료됐다. 프로세스 부모를 확인한 결과 남아 있는 Playwright Chrome은 다른 MCP 세션 및 형제 6-5의 테스트 소유이므로 종료하지 않았다. 이 작업의 6-4 테스트 runner/Chrome은 남아 있지 않다.

## 2026-10-18 — 최종 범위 검증과 문서 동기화

미지원 카탈로그의 안전한 데이터 표, v0 저장본/고정 기간 복원, UTC rolling 범위, 실제 취소 전파, 모호한 제목 확인, 반으로 분할된 교차 SSE의 중간 렌더링을 검증했다. SQL 비용 제한은 실제 비싼 JOIN을 interrupt한 후 정상 조회 회복으로 확인했다. 지연 필터 응답과 저장 공간 실패 회귀도 추가했다.

최종 Python 39개, frontend 330개, Chrome E2E 10개가 통과했고 production build·Ruff·typecheck도 통과했다. Lint는 기존 경고 5개다. 테스트 소유 Chrome과 서버 종료를 확인했다. 자세한 요구사항 매핑과 범위 제한은 [최종 검증 기록](2026-10-18-canvas-validation.md)에 있으며 제품/시스템 stock과 실행 README를 동기화했다. 이전의 미완료 기록은 당시 상태로 보존한다.
