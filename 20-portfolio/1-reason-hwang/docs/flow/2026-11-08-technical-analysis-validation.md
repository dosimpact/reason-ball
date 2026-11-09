# 2026-11-08 기술적 분석 최종 검증

## 맥락

[초기 구현 기록](2026-11-08-technical-analysis-agent.md)의 후속 기록이다. [TA-001~005 비즈니스 설계](../stock/technical-analysis/business-design.md) 및 [시스템 설계](../stock/technical-analysis/system-design.md)를 검증했다.

## 변경과 근거

- OpenUI 차트 데이터 배열을 별도 변수로 선언하고 MACD 선/막대 차트가 공유한다. 초기 120봉 프로그램 47451자에서 33775자로 축소됐으며 독립 parser 실행은 약 17ms, errors/unresolved 없음이었다. 이후 요약은 근거 표로 개선하고 JSON 공백을 줄였다. 수치 배열은 반올림하지 않는다.
- 표시 개수는 기본 120, 최대 200이다. 최대 표시 fixture에서 Host validator 60000자 제한 내임을 테스트했다. 요약 표는 소수점 4자리로 표시한다.
- 최초 Host validator cold compilation과 개발 서버 HMR 동안 timeout이 발생해 텍스트 fallback을 확인했다. 안정화 후 실제 API 7개가 모두 통과했다.
- 브라우저에서 장문/차트 결과 이후 기존 무제한 scroller 높이가 지속 증가하는 문제를 관찰했다. Chat 메시지 viewport를 60vh(min 320px)로 제한했다. 변경 후 주봉/후속/미지원 요청에서 composer y=1551.39px (검증 viewport 높이 2029px)로 유지됐다.
- abort 시 streaming 상태를 해제한다. values snapshot은 메시지 ID에 맞춰 교체하며 이전 turn 차트를 유지한다.

## 실행 검증

| 요구사항/검증 | 명령 또는 도구 | 결과 |
| --- | --- | --- |
| TA-002/003/004/005 Python | `pnpm -C 3-langgraph-fast test:technical-analysis -q` | 46 PASS: 계산 일치, RSI 경계, 교차, 주봉 완료, 설정 변경, 공급자 오류, 짧은 이력, 최대 출력, fallback, 기존 가격/TA-Lib/cache |
| 공통 출력 회귀 | `pnpm -C 3-langgraph-fast test tests/test_technical_analysis_agent.py tests/graph/subgraph/price_agent tests/infrastructure/technical_analysis tests/graph/shared/cache tests/test_generative_ui_graph.py -q` | 당시 46 PASS (신규 경계 3개 추가 전, 공통 graph 회귀 3개 포함) |
| TA-001/004 VAL-VIEW-001 | `pnpm -C 1-fe-host test:chat:views` | Storybook Chromium 4 PASS: 선택, 비활성, 차트, 오류 |
| TA-005 state regression | `pnpm -C 1-fe-host test:chat` | 1 PASS: snapshot 교체, 이전 turn 보존, reset 뒤 지연 snapshot 무시 |
| VAL-API-001 | `pnpm -C 3-langgraph-fast test:technical-analysis:api --env-var baseUrl=http://127.0.0.1:2037` | 실제 HTTP/Yahoo/모델/Host validator 7 requests, 7 tests, 7 assertions PASS; 약 41.8초 |
| Python 정적 검사 | scoped Ruff 및 Pyright | PASS, Pyright 0 errors |
| Host 정적 검사 | `pnpm -C 1-fe-host typecheck`, `pnpm -C 1-fe-host lint` | PASS; 기존 media img warning 1건, FSD PASS |
| 패키지 빌드 | `pnpm -C 3-langgraph-fast build` | wheel/sdist PASS |
| Host production build | `NEXT_DIST_DIR=.next-ta-build pnpm -C 1-fe-host build` | PASS, 17개 정적 페이지 생성 및 `/chat` 포함 |
| Secret scan | 작업 소유 소스의 임시 복사본에 `gitleaks dir --redact --no-banner` | 약 73KB, no leaks |

API 시나리오: assistant 등록 → 임시 thread → AAPL 일봉 120봉 분석 → 같은 thread의 주봉/RSI7/SMA50 변경 → EMA 요청 시 analysis_result/presentation null → thread/assistant 삭제(204). `apb-bruno-api-tests` 스킬의 Inspect/Author/Run 원칙을 적용했다. 실제 서버를 mock으로 대체하지 않았다.

## VAL-BROWSER-001

Chrome DevTools MCP, `http://127.0.0.1:2837/chat`, isolated context `technical-analysis-validation`, 작업 탭 2.

- 그래프 선택 후 AAPL 일봉: 120개 날짜, RSI14/SMA20/MACD12/26/9 및 4개 차트(종가/SMA, RSI, MACD, histogram) 표시.
- 주봉 RSI7/SMA50: 실제 주봉 데이터, 마지막 완료 bucket 2026-10-26, 날짜 범위·통화·출처 표시. 현재 주간 bucket은 보수적 월요일 완료 정책으로 제외.
- 같은 대화에서 RSI만 14로 변경: 두 출력의 라벨이 각각 `[RSI (7), SMA (50), MACD (12 / 26 / 9)]`, `[RSI (14), SMA (50), MACD (12 / 26 / 9)]`임을 DOM으로 확인. 이전 차트 보존.
- EMA만 요청: 미지원 설명을 출력하고 차트 개수는 기존 2개로 유지. 다른 지표로 대체하지 않음.
- 기본 그래프로 변경: 차트 0개, `Start a LangGraph chat` 표시.
- 마지막 콘솔 error/warn 조회: 없음. 모델·Yahoo 실연동 결과이며 fixture UI 검증과 구분한다.

## VAL-CLEANUP-001

- 작업 Host PID 53253, 마지막 LangGraph PID 55577을 각각 소유 exec session의 SIGINT로 종료했다. 이전 runtime PID 53283/53590도 종료 확인했다.
- `lsof -nP -iTCP:2037 -iTCP:2837 -sTCP:LISTEN` 결과 없음. `ps -p 53253,55577,53283,53590 -o pid,ppid,command`에 생존 PID 없음.
- Chrome MCP 탭 2를 닫았고 기존 탭 1(about:blank)과 도구 호스트 관리 브라우저/MCP 서버는 유지했다. 사용자 브라우저를 종료하지 않았다.
- 임시 `.next-ta-validation`, `.next-ta-build`, /tmp 분석 fixture와 secret-audit 복사본을 제거했다. tsconfig에서 작업 전용 build include만 제거했다. 다른 작업의 `.next-openui-migration` 및 사용자 런타임 데이터는 보존했다.
- Bruno의 임시 thread/assistant는 DELETE 204로 정리했고, 브라우저용 비영속 runtime 상태는 프로세스 종료로 해제했다.

## Git 경계

이 기능은 먼저 존재했던 미추적 공통 `graph/subgraphs/openui_output` 및 Host `OutputView`를 사용한다. 공통 builder에 선택적 program_builder를 추가했으나, 해당 파일에는 별도 OpenUI 마이그레이션의 사용자 변경도 들어 있다. package manifest 역시 동시 변경 중이다. 다른 작업을 함께 커밋하거나 불완전한 독립 snapshot을 만들지 않도록 이번 턴에는 커밋하지 않았다. 기능 구현·필수 검증·작업 자원 정리는 완료, 공통 마이그레이션과의 커밋 정리는 남아 있다.
