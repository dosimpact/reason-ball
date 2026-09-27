# 독립 전략 작업 공간 검증 — SM-002 / SM-003

날짜: 2026-09-27. 상태: 구현·검증 완료 (PASS).

## 범위

독립 전략 목록·작성·상세, 초안 저장, 계획 확정·revision, 더미/Binance 백테스트·포워드, 실행 제어·오류 복구·평가·JSON 내보내기를 검증한다. 기존 44유닛과 Primer 테마도 회귀 검사한다.

| 검사 | 현재 증거 |
| --- | --- |
| Vitest | 86 PASS: 기존 78 + 독립 전략 서비스 8 |
| 정적 검사 | TypeScript / ESLint / FSD 경계 PASS |
| 빌드 | Next / Storybook PASS |
| Bruno | 138 PASS: 기존 88 + 독립 전략 50 |
| 저장·동시성 | 독립 전략과 기존 튜토리얼 모두 동시 진행 1회·stale 409, 서버 재시작 후 view 일치 |
| Playwright UI / Storybook | 53/53 PASS: UI 27 + Storybook 26 |
| 실제 브라우저 | 목록→작성→초안 저장·새로고침→확정→한 봉 진행; 390px 다크 화면 가로 넘침 없음 |

## 요구사항별 완료 감사

| 요구 | 코드·검증 증거 | 판정 |
| --- | --- | --- |
| SM-002-01 목록·독립 작성·재방문 | `views/strategy-workspace`, standalone UI 첫 시나리오, Bruno 01–04 | PASS |
| SM-002-02 초안과 불변 계획·독립 ID | `entities/strategy`, 서비스 초안 단위 검사, Bruno 초안/확정/stale | PASS |
| SM-002-03 동시 변경 충돌 | `scripts/verify.mjs` 독립 단계 경합, expectedVersion 409 | PASS |
| SM-002-04 재시작 복원 | 소유 서버 종료·다시 시작 후 원본 view deepEqual | PASS |
| SM-003-01 미래 데이터 차단 | 서비스 공개 view/export 단위 검사, Bruno 기준 봉·공개 범위 검사 | PASS |
| SM-003-02 재생/일괄 결과 일치 | 서비스 economic state 비교, Bruno step/batch; Binance 과거 확정→run→batch | PASS |
| SM-003-03 새 봉 대기·중복 방지 | Binance 가상 시각 서비스 검사, Bruno 최신 확정봉/no-new | PASS |
| SM-003-04 자동 감시·중지·재개 | 포워드 직접 생성→pause/reload/resume/abort, 가상 시계 60초 감시·중지·이동 정리 | PASS |
| SM-003-05 오래된 초안 갱신 | fake-time Binance stale409→refreshData→confirm 단위 검사 | PASS |
| SM-003-06 revision/run 격리 | 서비스 revision 검사, Bruno 계획 불변성·독립 run·export, UI revision 전환 | PASS |
| SM-003-07 무효화·중단·구간 종료 | 공통 모니터링 단위·API, 독립 OPEN 미청산/EXPIRED/조기 종료 단위 검사 | PASS |
| SM-003-08 오류·범위 초과·재개 | Binance 누락502/4000봉503→ERROR/lastError 저장·resume 검사, RunError Storybook | PASS |
| SM-003-09 테마·모바일 | MCP 390px 다크·실제 흐름, 독립 Storybook 상태와 Primer dark 검사 | PASS |

## 검증 조건과 한계

자동화는 소유한 production 서버·임시 JSON·Binance stub을 사용한다. 새 봉 도착·오래된 초안·누락·장기 공백은 서비스 테스트에서 시각과 upstream을 제어한다. 포워드 UI 타이머 검사는 응답 mock과 Playwright 가상 시계로 주기를 확인하며 외부 Binance의 지속 가용성을 증명하지 않는다.

공통 체결 엔진은 long 매수 스톱·수량 1·비용 0·갭 시가 체결·OHLC 순서 불명 정책이다. 현재 가격은 확정봉 종가이고, 자동 감시는 브라우저 화면에서 시작한 동안 동작한다. 실제 주문이나 서버 백그라운드 감시는 범위 밖이다.

## 실행 증거

- `pnpm --filter fibonacci-tutorial test`, `lint`, `typecheck`
- `pnpm --filter fibonacci-tutorial test:integration`
- 로컬 로그: `/tmp/standalone-unit-complete.log`, `/tmp/standalone-lint-complete.log`, `/tmp/standalone-integration-complete.log`
- [Bruno 독립 전략 사례](../../e2e/bruno-api-tests/13-standalone-strategies/01-create-dummy-backtest.bru)
- [UI 시나리오](../../e2e/playwright/standalone-strategy.spec.ts)
- [Storybook 시나리오](../../e2e/playwright/storybook.spec.ts)

임시 로그는 로컬 증거이며 최종 판정은 이 문서에 요약한다. 검증 프로세스·임시 저장소를 정리하고 사용자 개발 서버 4310은 유지한다.

## 수정 사항과 외부 데이터 확인

- 초기 UI 검사에서 감시 타이머가 query 객체 변경에 따라 재설정되는 문제를 발견했다. 안정적인 refetch 참조로 수정하고 즉시 조회·60초 주기·중지·이동 후 정리를 재검증했다.
- 더미 기준 봉과 남은 관측 범위를 선택할 수 있게 했으며 API 메타데이터에는 미래 OHLC가 없다. 데이터 소스 전환 후 관측 수를 남은 범위로 보정한다.
- export의 canonical strategy는 엄격한 스키마로 파싱하고 실행별 공개 캔들·이벤트는 runAudits로 분리했다. 이전 저장 레코드의 추가 감사 필드는 읽기 시 복원한다.
- 실제 Binance 연결에서는 BTCUSDT 1h 공개 120봉을 가져왔고 마지막 OHLC가 공식 API 응답과 일치했다. 확인용 전략만 삭제했다. 로컬 증거는 `/tmp/standalone-live-check.json`이다. 이는 단일 조회 확인이며 지속적인 외부 서비스 가용성 검증은 아니다.

## 최종 소스 재검증 및 정리

전체 통합 138 API + 53 UI/Storybook 통과 이후, 마지막 더미 관측 수 보정이 포함된 소스로 `pnpm test:e2e`를 다시 실행했다. Next 빌드·TypeScript와 UI 27/27이 통과했다. 기준 봉 11 선택 → Binance 전환 → 더미 복귀 시 관측 수 1 유지, 기준 봉 7·관측 수 5 저장을 검증했다. 포워드 시나리오는 백테스트 이력 없이 새 전략을 직접 생성한다. 로그: `/tmp/standalone-final-e2e.log`.

소유 서버 PID 67862 종료, 포트 63863/63864 미사용, 임시 데이터 디렉터리 제거를 재확인했다. 사용자 서버 4310은 유지했고 `/monitoring` HTTP 200 및 전략 목록·새 전략 UI의 응답을 확인했다.

빌드에는 환경 변수 기반 로컬 JSON 경로에 대한 Turbopack 파일 추적 경고 1건이 남는다. 빌드·동작 실패는 아니며 현재 로컬 서버 범위에서 사용한다. 배포 패키지 최적화 시 동적 저장 경로의 파일 추적 범위를 별도로 검토한다.
