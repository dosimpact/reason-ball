# 2026-10-01 구현·검증

## 실행 범위
- worktree: `/Users/dodo/workspace/focus/reason-ball-ant`
- branch: `feature/ant-pixel-game`, base `591af3a`
- 프로젝트: `21-mini-projects/4-ant`, React 웹 `ant-atelier`, Expo `@ant-atelier/mobile`
- 구현은 이 worktree에 한정한다. 원본 main의 참고 이미지5장을 변경하지 않는다.

## 요구사항별 근거
| 요구사항 | 결과와 근거 |
|---|---|
| 사진5개 분석 | [초기 설계](2026-10-01-initial-design.md), 원본 보존 assets/references |
| React·FSD·SLAP | app/widgets/features/entities/shared, 순수 entities/game 모델, lint의 check-fsd.mjs PASS |
| 픽셀 그림·queue·5개 공간 | Canvas1개,3열 queue의 색/수량 preview, 정확히5슬롯. Playwright viewport 검사 |
| 개미1마리당 픽셀1개 운반·소멸 | engine 예약/집기/운반 테스트와 브라우저 collected 증가, [운반 화면](evidence/web-ants.png) |
| 색상 전략·실패·재시도 | Hard1에서 큐2→2→3→2→3→3→2→3→2를1초 간격 배치해 실제 blocked dialog 및 retry 확인 |
| 난이도별1~100 | 쉬움/보통/어려움 총300개. 모든 레벨50ms step 해법 PASS. 그림은5종 원본 도형의 해상도·색·queue 변형 |
| 완주·다음·저장 | 실제 버튼/힌트로 easy1 완주→2진입→reload 후 easy2 복원 |
| 속도·정지 | 3배속은 개미 이벤트만 가속, 제한시간은 실제시간. 단위 테스트와 브라우저pause 상태1.2초 비교 |
| 성능 | 개미24상한, 고정25ms tick, rAF Canvas, React10Hz. Hard1002400ticks peak20 p95 0.019ms/max0.242ms. [브라우저179프레임](evidence/browser-performance.json) p50 16.7ms/p95 16.8ms |
| 반응형 | 1280×720,390×844,360×640 full board/control bounds PASS. [desktop](evidence/web-desktop.png), [mobile](evidence/web-mobile.png) |
| 저장 예외 | null/배열/범위 초과/차단된 storage 회귀 검사 PASS |
| 광고 브리지 | 요청ID 불일치·미완료 광고 보상없음, 일치earned만 힌트, native resume가 수동pause를 해제하지 않음 |

## 명령 결과
- `pnpm --filter ant-atelier typecheck`: PASS
- `pnpm --filter ant-atelier lint`: PASS (ESLint+FSD)
- `pnpm --filter ant-atelier test`: **20 PASS**, engine17+storage3
- `pnpm --filter ant-atelier test:mobile`: **8 PASS**, mock SDK5+bridge3
- `pnpm --filter ant-atelier test:e2e`: **13 PASS / 8 SKIP / 0 FAIL**, production Vite build + owned4175 preview,49.5초. SKIP은 desktop에서 실행한 완주·키보드·native bridge·실패 경로를 두 모바일viewport에서 중복 실행하지 않은4×2개다. 모바일 각각은 배치/수집/정지/속도/재시작/도움말/최대레벨/화면맞춤을 실행했다.
- `pnpm --filter ant-atelier build:mobile`: PASS, single HTML219.04kB(gzip70.06kB), 외부 폰트 요청 제거.
- `pnpm install --frozen-lockfile --ignore-scripts --lockfile-only`:27 workspace PASS. Expo/RN 의존성 및 기존 optional peer 재해석이 루트 lockfile에 포함된다. 기존 workspace의 Storybook/Vitest peer 경고는 별도이며 수정하지 않았다.
- E2E 보고서: `playwright-report/index.html`, 소유 테스트 서버는 종료됨.

## 검증 중 발견·수정
- desktop 화면 아래로 queue가 밀리던 배치를 viewport 높이에 맞추고, 실제 픽셀 경계로 그림 크기를 계산했다.
- 3배속이 시계까지 가속하던 동작을 분리했다.
- native 보상은 상관관계ID로 검증하고 광고취소/오류/시간초과 시 무보상을 유지한다. 수동정지·문서숨김·native정지를 함께 계산한다.
- HMR 도중 테스트가 초기화된 문제 이후 E2E는 production preview를 사용한다. dev watch에서도 native 출력/문서/보고서/모바일 번들을 제외했다.
- 잘못된 native Hint 접근성 선택자는 실제 `Watch rewarded ad for hint`로 확인 후 수정했다.

## 모바일·배포 판정
Android native build/install/WebView 실행과 실제 AdMob 테스트 광고 표시는 확인했다. iOS/Android JS bundle export와 모바일 typecheck는 통과했다. 릴리스 오프라인 재시작과 실제 reward 결과는 별도 모바일 검증 기록으로 확정한다. 전체 Xcode가 없어 iOS 실기동은 미검증이며, 운영 광고ID·스토어서명·심사는 제공되거나 실행되지 않았다. mock 광고8PASS를 실제 운영 수익화 성공으로 표현하지 않는다.

## 완료 후 실행
웹 dev는 소유4173에서 유지한다. `pnpm --filter ant-atelier dev`로 재실행할 수 있다. 이후 commit/push는 이 새 프로젝트 요청에 포함되지 않아 실행하지 않는다.

## 후속 모바일 확인 (동일 작업, 2026-10-01)
Android 릴리스 native 빌드·설치·오프라인 cold start PASS. 실제 AdMob 테스트 광고의 Reward granted 후 닫기와 게임의 `1번 상자를 선택해 보세요.` 문구·1번 큐 강조를 확인했다. [오프라인 화면](evidence/android-release-offline.png), [실제 지급 화면](evidence/android-hint-granted.png). 최초 개발빌드 관찰 중 HMR로 게임이 초기화되어 보상 여부를 확정하지 못했으며, 고정 릴리스 번들에서 재검증했다. 시간 보너스는 구현하지 않았다. iOS와 Android Hermes bundle 최종 재생성은 각각2.39MB/2.40MB였다. 전체 Xcode/simctl 부재로 iOS native 실행은 범위 미검증으로 남긴다.
