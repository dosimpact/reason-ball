# Phaser 렌더링 전환 — 2026-10-01

## 요청과 결정 ENGINE-01
고양이 UX 개선 이후 사용자가 Phaser / Babylon.js / Three.js 중 현재 게임 성능을 기준으로 프레임워크 도입을 요청했다. 현재 부하는 2D 픽셀 그림(최대26격자), 운반 고양이 최대24마리, React 조작부이며 3D 모델·조명·물리 충돌은 필요하지 않다.

| 후보 | 공식 기능과 현재 적합성 | 결정 |
|---|---|---|
| [Phaser](https://docs.phaser.io/phaser/getting-started/what-is-phaser) | 2D 게임 전용, Scene/loop/texture/sprite, WebGL 및 Canvas | 선택. 현재 표현을 배치 렌더링과 풀로 옮기기 쉽다. |
| [Babylon.js](https://www.babylonjs.com/games/) | 3D 렌더링·물리·애니메이션·XR 게임 기능 | 현재 게임이 사용하지 않는 3D 기능을 중심으로 설계할 이유가 없다. |
| [Three.js](https://threejs.org/) | 3D 그래픽 라이브러리 | 가능하지만 게임 lifecycle/pooling 경계를 직접 구성해야 한다. |

세 엔진을 동일 구현으로 벤치마크한 결과는 아니다. '모든 상황에서 Phaser가 가장 빠르다'고 주장하지 않는다. 2D 요구에 대한 적합성과 기존/새 구현의 로컬 비용을 근거로 선택했다. npm과 [공식 배포](https://phaser.io/download/release/v4.2.1)에서 확인한4.2.1을 정확히 고정했다. [Phaser4 렌더러 안내](https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games)는 배치/WebGL2/context recovery와 Canvas deprecated 상태를 설명한다. Canvas는 기존 기기 호환 경로로만 유지한다.

## 구현
- React 세션의 별도 requestAnimationFrame을 제거하고 Phaser Scene.update가 유일한 루프를 소유한다. 순수 tickGame25ms 계약 및 React HUD10Hz, 광고/도움말/수동 정지 합성은 유지한다.
- WebGL 우선 AUTO renderer; WebGL 불가 시 Phaser Canvas fallback. 물리 엔진을 생성하지 않고 오디오와 Phaser 입력을 비활성화한다. 접근성 입력·키보드는 React가 소유한다.
- 512×256 atlas에6색 블록/수집 표시와 고양이3포즈를 한 번 그린다.24고양이+24운반 블록 Image를 재사용한다. 매 프레임 vector path 생성·도안 bounding box 계산·DOM 크기 측정을 제거한다.
- 배경 texture와 좌표는 레벨/ResizeObserver 변경 때만 재생성한다. 블록 visibility/frame은 게임 state 변경 시에만 갱신한다. level restart/resize에 display list가 증가하지 않는다.
- DPR상한2, 실제CSS크기×DPR의 framebuffer. reduced-motion이면 정적 포즈와 축소 생략. 정지 중 포즈 시간도 정지한다.
- React StrictMode 중 취소된 비동기 import는 엔진을 생성하지 않는다. unmount 시 ResizeObserver 해제 및 Phaser destroy 처리. 외부 CDN 없이 lazy chunk, 모바일은 엔진까지 단일HTML에 포함한다.
- 작은 모바일 viewport의 세로 스크롤을 네이티브 WebView에서도 허용했다.

## 성능 근거
같은 로컬 브라우저·344×304·DPR1·hard100의 동일 장면225픽셀/4고양이,50워밍업+600회 동기 호출 비교:

| 구현 | 평균 CPU 제출 | p95 | 최대 |
|---|---:|---:|---:|
| 기존 Canvas2D 경로 | 0.167ms | 0.200ms | 1.000ms |
| Phaser Scene update+WebGL 제출 | 0.034ms | 0.100ms | 1.000ms |

GPU 완료 시간, 실제 모바일 FPS, cold boot는 이 측정에 포함하지 않는다. 아주 짧은 작업이므로 timer 해상도·환경 노이즈가 있다. 예전 renderer는 전환 직전 측정했고 결과를 이 기록에 보존했다. 현 구현 재현은 dev 서버 실행 후 `pnpm --filter ant-atelier test:perf`; [기계 판독 결과](evidence/phaser-render-benchmark.json)에 browser/date/method를 남긴다. 해당 별도 실행은4고양이 평균0.039ms, 합성24고양이 평균0.041ms/p95 0.100ms였다. 합성24고양이 상태는 그림 성능만 측정하며 합법 게임 상태 검증을 대체하지 않는다. 10회 scene rebuild 후274 display objects 유지, destroy 후 canvas 제거를 확인했다.

비용: 모바일 단일HTML은223.41kB/gzip71.44kB에서1,915.73kB/gzip453.64kB로 증가했다. 웹은 React UI와 약382kB gzip 엔진 청크를 분리한다. 초기 네트워크/parse 비용이 늘어났음을 수용하되 경고를 숨기거나 경량화됐다고 주장하지 않는다. 네이티브는 내장HTML이라 게임 중 다운로드는 없다.

## 검증
TypeScript, lint/FSD, production build PASS. production browser E2E18PASS/12중복SKIP: 기존 게임/힌트/보상/저장/정지/모바일 범위에 WebGL선택, DPR3기기에서상한2 resize, reduced-motion 게임진행, WebGL강제불가 fallback 실제수집을 추가했다. 모바일HTML 생성과 양 플랫폼 JS export PASS. Android native 재실행 결과는 후속 항목에 기록한다. iOS native 실행은 전체Xcode 부재로 미검증이다.

영향 stock: 시스템 ENGINE-01 및 테스트 ENGINE-01. 이전 [고양이UX 검증](2026-10-01-cat-ux-improvements.md)은 Canvas 시점 기록으로 보존한다.

## Android 실행 및 마무리
`expo prebuild --platform android --no-install` 후 `./gradlew :app:assembleRelease --console=plain` 성공(54초), 테스트 광고 ID와 로컬 debug signing의 release APK를 소유 AVD Pixel_8_Pro_API_35에 재설치했다. Wi-Fi/data 비활성화 상태의 cold launch에서 새 Phaser 내장 게임이 실행됐으며 상자 터치→고양이 이동→5블록 수집 및 슬롯 반환을 확인했다. [이동 화면](evidence/phaser-android-offline-cats.png), [수집 완료](evidence/phaser-android-offline-collected.png). 광고 불가 상태에서도 게임이 진행됐다. WebView의 실제 renderer 종류는 native 진단으로 노출하지 않아 WebGL이라고 단정하지 않는다. 웹은 data-renderer로 WebGL 확인.

네트워크는 기존 켜짐 상태로 복구했다. 테스트용 브라우저 페이지와 이번에 띄운 emulator는 정리했다. 실제 광고 재노출과 iOS native는 이번 전환 검증에서 수행하지 않았다. Frozen lockfile 확인 PASS. 전체27개 workspace 중 의존성 추가는 게임의 phaser4.2.1뿐이며 앞선 모바일 의존성 변경은 유지했다.
