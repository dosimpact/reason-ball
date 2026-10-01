# 2026-10-01 도안·보행 원본 적용 및 통합 검증

## 맥락과 적용
이전 [임시 복제본 구현 기록](2026-10-01-artwork-and-walking.md)은 원본 미적용 상태와 당시 환경 차단을 기록한 역사 문서다. 이번에는 `/Users/dodo/workspace/focus/reason-ball-ant`, `feature/ant-pixel-game`에서 원본에 적용했다. 시작 시 프로젝트 전체 untracked와 루트 `pnpm-lock.yaml` 수정 상태를 확인했다. 다른 작업 트리의 review 산출물은 읽기 전용으로 사용했다.

`review-2026-10-01/manifest.json`의 23개 before SHA256이 모두 원본과 일치했다. 변경 대상 기존 파일과 lockfile을 `/tmp/ant-before-artwork-20261001-100441.tar.gz`에 백업했다. `git apply --check` 후 실제 적용했고 23개 after SHA256 일치를 확인했다. ZIP에서 문서용 PNG/HTML 갤러리 두 파일만 추가했다. 이후 이번 검증 기록·문서 지도·system/test stock을 갱신했다. 소스에는 수정본 외 추가 변경이 없다.

루트 lockfile은 처음부터 끝까지 SHA256 `d2ae1e4f4500fbce96d2abd728fe31ce5c6fb531d29880615124b99abd887ab0`을 유지한다. 기존 untracked 상태를 유지하며 stage/commit/push는 수행하지 않았다.

## 현재 요구와 stock 동기화
- ART-01~03: 20종 자체 캐릭터/음식 ×5테마의100개 고유 배치, 난이도 간 그림·의미 있는 색 보존. 서로 다른 캐릭터100종이 아니다.
- EDGE-01: 외부4방향 flood fill, 밀폐 구멍/대각 틈 제외, reserved는 pickup 전 장애물.
- WALK-01~02: 아래 슬롯 출발, 아래 통로/BFS 직각 경로, 블록 앞120ms 대기, 역경로 귀환, 중앙 집 우회, 집 근처 축소.
- business stock의 게임/레벨 계약은 패치로 반영했다. system stock의 최신 검증 연결과 test stock의 ART/EDGE/WALK 표·현재 플랫폼 판정을 이번에 동기화했다.

## 실행 결과
명령은 저장소 루트의 기존 패키지 스크립트를 사용했다.

| 검증 | 결과 | 근거 |
|---|---|---|
| `pnpm --filter ant-atelier test` | PASS 29 | 3난이도×100레벨 50ms tick 완주, 색별 보존, 외곽·구멍·예약·직각 경로, 저장 |
| `pnpm --filter ant-atelier test:mobile` | PASS 8 | 광고 SDK/브리지 mock; 실제 광고 재노출 결과 아님 |
| 웹 `typecheck`, `lint`, `format:check` | PASS | TypeScript, ESLint/FSD, Prettier |
| `pnpm --filter ant-atelier test:e2e` | PASS 18 / SKIP 12 | production build + owned strictPort4175, Chromium desktop1280×720 / mobile390×844 / small-mobile360×640. SKIP은 데스크톱에서 실행한 뷰포트 독립 시나리오의 중복 제외. HTML report는 프로젝트 `playwright-report/index.html` |
| `pnpm --filter ant-atelier build:mobile` | PASS | Phaser 포함 singleHTML 1,924.44kB, gzip456.60kB, generated 모듈 갱신 |
| 모바일 `typecheck`, `build` | PASS | 기존 prebuild lifecycle 후 Android/iOS Hermes export. 각각5.81MB/5.8MB |
| Android release | PASS | `pnpm --filter @ant-atelier/mobile exec expo run:android --variant release --no-bundler --device Pixel_8_Pro_API_35`; Gradle595 tasks,23초. ignored APK `mobile/android/app/build/outputs/apk/release/app-release.apk` |
| Android 오프라인 실행 | PASS | Wi-Fi/data 비활성화 → force-stop → MainActivity cold launch → 아래 출발/운반 →14/177 수집 → 슬롯 해제. 네트워크 원상복원 |
| iOS native | BLOCKED | `xcode-select -p` = `/Library/Developer/CommandLineTools`; 전체 Xcode 없음. JS export로 native 실행을 대체하지 않음 |
| 실제 광고 재노출 / 스토어 배포 | NOT RUN | 이번 변경 검증 범위 아님 |

순수 hard100 2400tick: peak24, p95 0.066ms/max0.258ms. 실제 GPU/FPS 측정이 아니다. Vite 번들 크기 및 기존 Expo 아이콘/system-ui/Gradle deprecation 경고가 있으나 위 명령은 성공했다.

## 시각 증거와 범위
Chrome MCP로 production4174를 열어 레벨1 귤냥이와 레벨11 알록달록 김밥 도안, 어두운 상자 밝은 수량, 아래 통로 이동,14개 수집 후 슬롯 해제를 확인했다. 새 환경에서는 이전 세션의 localhost/Chromium 차단이 재현되지 않았다. IAB는 미제공이어서 Chrome으로 확인했다.

- [desktop hard100](evidence/artwork-walking/desktop-hard100.png), [390px hard100](evidence/artwork-walking/mobile-hard100.png), [360px hard100](evidence/artwork-walking/small-mobile-hard100.png)
- [Android 오프라인 시작](evidence/artwork-walking/android-offline-start.png)
- [아래 통로 출발](evidence/artwork-walking/android-walk-0.png), [블록 운반 귀환](evidence/artwork-walking/android-walk-1.png), [14개 수집·슬롯 해제](evidence/artwork-walking/android-offline-collected.png)
- [Android 오프라인 보행 8초 영상](evidence/artwork-walking/android-offline-walking.mp4)
- [전체100도안표](../research/stage-art-gallery.html)

영상/스크린샷은 대표 장면을 검증한다. 전 레벨의 시각 경로 전수검사나120ms 정밀 측정은 하지 않았다. 논리적 장애물 회피·직각 경로·예약 경계는 순수 테스트와 소스 계약으로 별도 확인한다. 첫 Android 녹화의 잘못된 클릭은 수집 증거로 쓰지 않았고 화면 좌표 확인 후 새 녹화로 대체했다.

## 사용 스킬 및 후속
`apb-playwright-e2e`의 기존 스펙 실행·Chrome MCP 탐색·보고서 확인 절차를 사용했다. 새 선택자나 테스트를 불필요하게 추가하지 않았다.

남은 플랫폼 검증은 전체 Xcode가 있는 환경의 `pnpm --filter @ant-atelier/mobile ios`이다. 테스트 소유4174 preview,4175 E2E 서버,Chrome 탭 및 Android 에뮬레이터 정리를 완료했다. 두 포트의 LISTEN 없음과 adb 기기 목록 비어 있음을 확인했다. 문서 상대 링크, 수정본 소스 SHA256 및 루트 lockfile 보존도 최종 확인했다. 운영 광고·앱스토어 배포 완료를 주장하지 않는다.
