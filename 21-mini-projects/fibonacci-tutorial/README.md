# Fibonacci Lab

엘리엇 파동이론 기술적 분석을 차트에서 연습하는 로컬 Next.js 앱입니다. 10개 챕터·44개 유닛(이론16·연습28)으로 기초 파동부터 조정파·Diagonal·대안 카운팅·분석 계획과 회고까지 제공합니다. 메인과 챕터 페이지에서 커리큘럼과 진행률을 확인할 수 있습니다. 인증이나 실제 주문 기능은 없습니다. 사이드바에서 GitHub Primer 라이트·다크 테마를 전환하고 재방문 시 선택을 유지합니다.

## 실행

저장소 루트에서:

```sh
pnpm install --filter fibonacci-tutorial... --frozen-lockfile
pnpm --filter fibonacci-tutorial dev
```

<http://127.0.0.1:4310>에서 시작합니다. `wave-three`는 초기 8봉/총 12봉입니다. 1·4·7번째 캔들을 선택하고 기본 가격으로 계획을 확정한 뒤 `Next Candle` 또는 `Play/Pause`로 Replay할 수 있습니다. `trade-review`는 초기 8봉/총 20봉에서 5파와 뒤따르는 조정을 관찰합니다. 매매 예시의 전체 6점은 Replay가 끝난 뒤 확인할 수 있습니다.

`market-lab`에서는 더미 또는 공개 Binance Spot `BTCUSDT`·`ETHUSDT`와 `1h`·`4h`·`1d`를 골라 새 세션을 만듭니다. Binance 세션은 확정봉 스냅샷을 고정하고 새 확정봉이 생기면 이후 시장 평가를 추가합니다. Binance 연결 오류는 화면에 표시됩니다.

계획과 평가 이력은 프로젝트 `.data/`의 JSON에 저장하며 `FIBONACCI_DATA_DIR`로 경로를 바꿀 수 있습니다. 세션 URL이나 브라우저 로컬 저장소로 복원하고 JSON으로 내보낼 수 있습니다. 이는 로컬 단일 서버용 저장 방식입니다. 사후 평가는 현재 한 번에 최대 4000봉입니다.

## 전략 실행 모니터링

매매 유닛에서 계획 확정 전 무효화 가격과 자동 중단 정책을 설정합니다. 이후 Replay 또는 Binance 확정봉 감시에서 진입·무효화·청산 이벤트, 미실현 손익, live R과 경계 이격도를 확인합니다. 이유를 적어 수동으로 중단할 수 있으며 전체 이력은 JSON으로 내보냅니다. 현재가는 마지막 확정봉 종가이고 실제 주문은 실행하지 않습니다. [실행 정책](docs/design/strategy-monitoring.md)을 참고하세요.

## 검증

```sh
pnpm --filter fibonacci-tutorial test
pnpm --filter fibonacci-tutorial lint
pnpm --filter fibonacci-tutorial typecheck
pnpm --filter fibonacci-tutorial test:integration
```

`test:integration`은 production 앱과 Storybook을 빌드하고 소유한 임시 포트·JSON·Binance stub에서 Bruno API, Playwright UI/Storybook, 동시 Replay, 서버 재시작 복원을 검사한 뒤 정리합니다. 개별 명령은 `test:api`, `test:e2e`, `test:storybook`입니다. UI 카탈로그는 `pnpm --filter fibonacci-tutorial storybook`(6310)으로 봅니다. Playwright 브라우저가 없다면 `pnpm --filter fibonacci-tutorial exec playwright install chromium`을 실행합니다.

2026-09-27 커리큘럼 검증: 단위55개, Bruno71개, UI18개·Storybook12개, lint·typecheck·production/Storybook build 통과. [44유닛 검증](docs/validation/curriculum.md)에 조건과 증거를 기록했습니다.

[문서 지도](docs/INDEX.md) · [원본 계획](master-plan.md) · [학습 문서](docs/tutorials/INDEX.md) · [비즈니스 설계](docs/stock/business-design.md) · [시스템·개발 설계](docs/stock/system-design.md)

2026-09-27 전략 모니터링 최종 검증: 단위 78개, Bruno 88개, UI 23개·Storybook 19개와 정적 검사·빌드 통과. [검증 보고서](docs/validation/strategy-monitoring.md)를 참고하세요.

## 독립 전략 작업 공간

`/monitoring`에서 튜토리얼 과제 없이 전략을 작성합니다. `새 전략 만들기`에서 BACKTEST/FORWARD와 더미/Binance 데이터를 선택하고, 공개된 차트의 파동점·가격·판단 이유를 저장한 뒤 계획을 확정합니다.

- 백테스트: 과거 기준 봉과 관측 구간을 정하고 한 봉·자동 재생 또는 전체 구간 실행으로 검증합니다.
- 포워드: Binance 새 확정봉을 조회하거나 상세 화면에서 60초 감시를 시작합니다. 더미 포워드는 순차 입력 시뮬레이션입니다.
- 초안 재개, 새 revision, 실행별 결과·이벤트, 수동 중단, JSON 내보내기를 제공합니다. 감시 중지는 포지션 청산과 다릅니다.
- 데이터 오류는 실행에 저장되며 원인을 확인한 후 재개합니다. 화면을 닫으면 자동 감시는 멈춥니다.

독립 저장은 `FIBONACCI_DATA_DIR/strategies`를 사용합니다. 실제 주문 없이 수량 1·수수료 및 슬리피지 0의 long 모의매매로 평가합니다. [설계·수락 기준](docs/design/standalone-strategy-workspace.md)을 참고하세요.

2026-09-27 독립 전략 통합 검증: 단위 86, Bruno 138, UI 27·Storybook 26건 통과. 정적 검사·Next/Storybook 빌드 및 동시 실행·재시작 복원을 확인했습니다. [검증 조건과 증거](docs/validation/standalone-strategy.md)를 참고하세요.
