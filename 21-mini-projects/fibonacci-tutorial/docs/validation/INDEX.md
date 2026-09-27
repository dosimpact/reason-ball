# 검증 안내

상태: 전체 MVP 검증 완료. 최신 결과는 [독립 전략 검증](standalone-strategy.md), [전략 모니터링 검증](strategy-monitoring.md)과 [커리큘럼 검증](curriculum.md), 최초 경로 기록은 [Walking Skeleton 검증](walking-skeleton.md)을 확인하세요.

Walking Skeleton의 첫 검증은 더미 연습 유닛 하나에서 선택 → 계획 확정·재조회 → 캔들 공개 → 평가 표시가 실제로 이어지는지 확인합니다. 순수 계산은 단위 테스트, UI 상태는 Storybook, 계획·평가 HTTP는 Bruno, 전체 사용자 흐름과 미래 데이터 비노출은 Playwright로 확인합니다. 이 검증이 끝나기 전에는 첫 경로를 완료로 기록하지 않습니다.

- 원본 계획의 [완료 조건](../../master-plan.md#완료-조건)을 상세 설계에서 검증 가능한 시나리오로 구체화합니다.
- 순수 파동·Fibonacci·매매 계산은 단위 검증 대상으로 둡니다.
- 계획·평가 스키마의 필수 필드, 확정 계획 불변성, 새 revision, `asOf` 이후 캔들만 사용하는 평가, 동일 캔들 Stop Loss·Target 동시 도달 시 `판정 불가`를 검증합니다.
- 실제 저장·조회 API가 생기면 Bruno로 계획 확정·재조회와 Replay/사후 평가 계약을 검증합니다.
- 캔들 선택, 오버레이, Replay의 미래 데이터 차단, 결과 피드백은 실제 UI 흐름에서 확인합니다.
- Playwright에서는 계획 작성 → 확정 → Replay 평가 → 원본 계획과 결과 비교, Binance 시나리오의 사후 평가 재방문 흐름을 검증합니다.
- 실행 결과와 미검증 항목은 날짜별 [flow](../flow/INDEX.md)에 기록합니다.

## 현재 실행 명령

저장소 루트에서 `pnpm --filter fibonacci-tutorial` 뒤에 다음 script를 붙입니다.

- `test`: 파동·Fibonacci·평가 순수 함수.
- `lint`, `typecheck`: 코드와 FSD import 경계·타입.
- `test:integration`: 프로덕션 앱·Storybook 빌드 → Bruno API → 동시 Replay·서버 재시작 보존 → Playwright UI 및 Storybook 상태.
- `test:api`, `test:e2e`, `test:storybook`: 필요한 계층만 개별 실행.

검증은 소유한 동적 포트·임시 JSON에서 실행하며 완료·오류 후 정리합니다. 기존 사용자 개발 서버는 재사용하거나 종료하지 않습니다. 수동 MCP 탐색 후에는 브라우저를 닫고 소유한 프로세스·포트도 확인합니다.

- [원본 계획 섹션별 완료 감사](completion-audit.md)

- [44유닛 커리큘럼 검증](curriculum.md)

- [전략 실행 모니터링 검증](strategy-monitoring.md)

- [독립 전략 백테스트·포워드 검증](standalone-strategy.md)
