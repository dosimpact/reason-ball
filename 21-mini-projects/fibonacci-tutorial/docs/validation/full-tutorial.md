# FT-01 전체 튜토리얼 검증

날짜: 2026-09-27. 상태: 전체 MVP 구현·검증 PASS.

## 요구와 검증 연결

| 요구 ID | master-plan 기능 | 검증 경로 |
| --- | --- | --- |
| FT-01 | 챕터·독립 유닛·진행 복원 | 카탈로그 3챕터/9유닛, 유닛 왕복·새로고침 E2E |
| FT-02 | 이론 Next 설명·차트·파동 변경 | Theory API expectedStep, 마지막 완료, 브라우저 단계 전환 |
| FT-03 | 시작점+1–5 선택, Undo/Reset | 6점 연습 UI와 순수 선택 규칙 |
| FT-04 | 독립 3대 validator·구체적 피드백 | 순수 경계 테스트, check API 실패/수정, UI 결과 |
| FT-05 | 힌트·예시 정답 요청 | 검증 전 예시409, 요청 후 공개 범위 내 예시 |
| FT-06 | 연결선·라벨·Fibonacci 오버레이 | 실제 차트 렌더링·zoom/pan, 순수 가격 계산 |
| FT-07 | Entry/Stop/Target·무효화 차이 | 입력·API 검증, 계획 표시와 가격선 |
| FT-08 | 전체 의사결정 JSON·불변 계획 revision | confirm/revise/export, asOf와 이전 plan 비교 |
| FT-09 | 수동·자동 Replay·미래 데이터 차단 | Play/Pause 및 API cursor 충돌·응답 공개 범위 |
| FT-10 | 손익률·R:R·R·규칙별 판단 피드백 | 순수 체결/갭/모호한 OHLC 및 결과 UI |
| FT-11 | Binance 정규화·캐시·오류 | 실제 public API smoke, 소유 stub 캐시/429/재시도 |
| FT-12 | 이후 확정봉 사후 평가·재평가 | later-market API, 원본 불변, 관측 시각/데이터 버전 |
| FT-13 | 5파 이후 청산 판단 | close/hold 근거 보존, 기존 체결 불변 |
| FT-14 | FSD·SLAP·검증3계층 | lint 경계·typecheck·단위·Bruno·Storybook·Playwright |

## 테스트 데이터 구분

기본 dev/start는 실제 Binance public endpoint를 사용합니다. 통합 runner는 로컬 Binance 응답 서버를 소유한 동적 포트에서 실행하여 시장 응답·요청 횟수·429를 재현합니다. 실제 서비스 연결 결과와 통제된 응답 검증을 별도로 기록합니다.

## 범위

원본 MVP대로 상승 Impulse와 1–2–3파 매매 연습을 다룹니다. ABC/Diagonal/자동 파동 탐지/실제 주문은 제외합니다. 단일 서버 JSON 저장, 계정 없는 로컬 교육용 환경입니다.

## 실행 결과

2026-09-27 최종 코드 기준:

| 명령/검증 | 결과 |
| --- | --- |
| `pnpm --filter fibonacci-tutorial test` | 6개 파일, 29개 테스트 PASS |
| `pnpm --filter fibonacci-tutorial lint` | ESLint + FSD/public API/server 경계 PASS |
| `pnpm --filter fibonacci-tutorial typecheck` | Next route typegen + TypeScript PASS |
| `pnpm --filter fibonacci-tutorial test:integration` | Next production/Storybook build PASS |
| Bruno 실제 HTTP | 48 요청 / 48 tests / 48 assertions PASS |
| Playwright UI | 10 시나리오 PASS (모바일·완료 누적 회귀 포함) |
| Storybook 브라우저 | 독립 상태 10개 PASS, API 요청 없이 렌더링 |
| 재시작·동시성 | 전체 세션 재시작 복원, 동시 Replay 200/409 PASS |

FT-01–FT-14 모두 위 자동 검사와 실제 브라우저 탐색으로 확인했습니다. API 상세 결과는 `e2e/bruno-api-tests/reports/results.json`, 브라우저 보고서는 `playwright-report/index.html`에 생성됩니다(실행 산출물은 git 제외).

### 실제 Binance 앱 경유 확인

`FIBONACCI_SKIP_BUILD=1 FIBONACCI_LIVE_BINANCE=1 node scripts/verify.mjs inspect`로 production 앱을 소유한 임시 서버에서 실행했습니다. UI에서 BTCUSDT / 1h 소스를 선택하여 세션 생성 HTTP201, 120개 확정봉 중 80개 공개를 확인했습니다. 직접 3점을 선택하고 계획 확정 HTTP200 → 이후 시장 평가 HTTP200 → 120개 공개와 `later-market` 평가를 확인했습니다. 계획 이후 40개 봉을 관측했고 결과는 `open`이었습니다. 두 번째 재평가도 HTTP200이며 원래 계획과 첫 계획 이력의 값이 동일했습니다. JSON 키 정렬 차이는 구조 비교로 제외했습니다.

실제 Binance의 장애/429를 의도적으로 유발하지 않았습니다. 그 분기는 로컬 upstream stub으로 검증했습니다. 이 결과는 당시 연결 smoke이며 외부 서비스 가용성을 보장하지 않습니다.

### 실제 UI 확인 및 수정

MCP 브라우저로 이론 Next, 6점 규칙 실패/수정, 매매 Play/Pause, 청산 회고, 실제 Binance를 탐색했습니다. 최종 앱과 Fibonacci Storybook 화면을 확인하여 연결선·파동 라벨·가격선·가격 범례가 보이는 것을 확인했습니다. Storybook 정적 서버의 favicon.ico 404는 아이콘 요청이며 시나리오 렌더링 오류는 아닙니다.

통합 중 완료 진행률의 localStorage/SSR hydration 불일치를 발견해 `useSyncExternalStore`로 수정했습니다. 최종 20개 브라우저 검사는 모두 통과했습니다. trade-review는 20개 봉에서 5파와 이후 조정을 관찰하며 예시 6점은 관찰 완료 뒤 공개됩니다.

### 정리

통합 runner는 성공 후 Next/Storybook/stub과 임시 데이터 디렉터리를 정리했습니다. 수동 확인 서버도 소유 runner에 SIGTERM을 보내 종료했고 MCP 페이지를 닫았습니다. 기존 사용자 개발 서버는 변경하지 않았습니다.

## 운영·모델 한계

- 단일 서버 JSON 저장이며 계정·권한·다중 서버 운영은 포함하지 않습니다.
- 상승 표준 Impulse만 지원하며 truncated 5파와 ABC/Diagonal, 자동 탐지, 실제 주문은 범위 밖입니다.
- 체결 모델은 touch-v1, 수수료/슬리피지 0입니다. OHLC로 선후를 모르면 판정 불가이며 시장 수익성을 보장하는 평가가 아닙니다.
- Binance 사후 평가는 최대 4,000개 봉 범위입니다. 초과 시 503으로 명시하며 자동 장기 백필은 하지 않습니다.
- 브라우저 검증은 Chromium과 390px 모바일 뷰포트에서 수행했습니다. Safari/Firefox는 검증하지 않았습니다.

## 후속 완료 감사

원본 계획 섹션별 [완료 감사](completion-audit.md) 후 자동6점 피드백과 완료 기록 누적을 보완했습니다. 전체 통합을 재실행하여 Bruno48, UI10, Storybook10 PASS, 단위29/lint/typecheck PASS를 확인했습니다. 검증 runner 포트·PID 종료와 임시 디렉터리 삭제를 재확인했습니다.
