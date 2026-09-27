# WS-01 Walking Skeleton 검증 결과

날짜: 2026-09-27. 판정: **현재 WS-01 경로 PASS**. 전체 MVP 완료 판정은 아닙니다.

## 범위와 결과

| 검증 | 결과 | 확인한 동작 |
| --- | --- | --- |
| Vitest | 9/9 PASS | 공개 파동 선택, 되돌림·1.618 확장, 진입 대기/보유/목표/손절/만료, 갭, OHLC 선후 불명, asOf 차단 |
| Bruno API | 18 요청, 18 tests, 18 assertions PASS | 카탈로그, 세션, 미래 지점 거부, 불변 계획, 재조회, 한 캔들 공개, 400/404/409 |
| 추가 HTTP 검사 | PASS | 같은 cursor 동시 요청은 200/409, 실제 서버 재시작 후 세션 전체 동일 |
| Playwright Chromium | 3/3 PASS | 실제 canvas 클릭·키보드 선택, 계획·결과·새로고침, 잘못된 가격 피드백/새 연습 초기화, 390px 모바일 조작·오버플로 |
| Storybook Chromium | 5/5 PASS | 로딩·오류·초안·확정·평가 결과; API 요청 없는 독립 렌더링, 차트와 버튼 상태 |
| 정적 검사 | PASS | TypeScript, ESLint, FSD 계층·공개 API·서버 경계 |
| Build | PASS | Next.js production, Storybook static |
| 설치 재현 | PASS | `pnpm install --filter fibonacci-tutorial... --frozen-lockfile` |
| 자원 정리 | PASS | 테스트 서버·MCP 브라우저 종료, 소유 포트 LISTEN 없음, 임시 JSON 삭제 |

기본 예제는 `[0,3,6]` 지점, Entry 114 / Stop 99 / Target 142.36입니다. 초기 8개에서 12개까지 4번 공개하며 목표 도달 `+1.89R`을 표시했습니다. 확정 전 미래 캔들 참조는 거부했고 매 공개 응답의 캔들 수·cursor·계획 불변성을 비교했습니다.

## 실행과 증거

저장소 루트:

```sh
pnpm --filter fibonacci-tutorial test
pnpm --filter fibonacci-tutorial lint
pnpm --filter fibonacci-tutorial typecheck
pnpm --filter fibonacci-tutorial test:integration
```

- [Bruno collection](../../e2e/bruno-api-tests/bruno.json), [UI E2E](../../e2e/playwright/tutorial.spec.ts), [Storybook 검증](../../e2e/playwright/storybook.spec.ts).
- [실행·재시작·정리 runner](../../scripts/verify.mjs), [순수 평가 테스트](../../src/entities/trade-evaluation/trade-evaluation.test.ts).
- 로컬 재생성 결과: `e2e/bruno-api-tests/reports/results.json`, `playwright-report/index.html`, `test-results/` (git 제외). E2E 완료 화면 캡처도 test-results에 저장합니다.
- Playwright MCP로 실제 production UI와 Storybook iframe을 먼저 탐색한 뒤 자동 검증을 작성했습니다.
- 최종 통합 실행: Next.js 16.3.6 / Node 26.7.0 / pnpm 10.33.4, 임시 경로 `fibonacci-verify-JrVEB8`, 서버 54658 → 재시작 54683. 실행 후 서버·정적 Storybook 서버 및 임시 데이터가 제거됐습니다.

## 수정된 실패와 한계

초기 실행 중 재빌드로 인한 오래된 서버 자산 참조를 통합 runner의 순차 build/start로 해결했습니다. 모바일에서 숨겨졌던 챕터 탐색을 표시하도록 수정한 뒤 **새 빌드를 포함한 통합 명령 전체를 재실행해 8개 브라우저 검증이 통과**했습니다.

Storybook 빌드의 `use client` 지시문 처리, chunk 크기, Node deprecation 경고는 비차단입니다. 다른 workspace 앱의 기존 manifest/lock drift를 함께 resolution했으므로 루트 lock 변경 범위가 큽니다. 다른 앱의 실행 검증은 수행하지 않았습니다.

이론 모드, 전체 1–5파 검증, Binance·서버 캐시, 시간이 지난 시장 데이터 평가, revision과 결정별 상세 피드백, 인증·다중 서버 저장은 미구현·미검증입니다. 테스트 결과는 로컬 단일 프로세스의 교육용 고정 시나리오에 적용합니다.

[구현 흐름·결정 기록](../flow/2026-09-27-walking-skeleton-implementation.md) · [현재 시스템 계약](../stock/system-design.md)
