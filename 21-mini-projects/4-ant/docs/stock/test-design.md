# Cat Atelier 테스트 설계

## 현재 변경 검증 범위
도안·외곽·보행 변경은 단위29PASS/정적검사/빌드 PASS이며, 현재 세션 권한 제한으로 원본 적용 및 브라우저/네이티브 재검증 대기다. 아래 기존 실행 결과는 이전 엔진 버전의 근거다. [최신 기록](../flow/2026-10-01-artwork-and-walking.md)을 우선한다.

## 필수 검증
| ID | 검증 |
|---|---|
| GAME-01/02 | 5슬롯, 3열 queue, 맨 앞만 배치, 가득 찬 슬롯 거부 |
| GAME-03 | 색상 일치, 접근 가능한 픽셀, 중복 예약 방지, 운반 후 제거/고양이 소멸 |
| GAME-04 | 마지막 운반 전 승리 금지, 막힘/시간 초과 실패, retry/next |
| LEVEL-01 | 3난이도×100레벨 해법, 색별 총량 일치, 결정성, 경계 레벨 |
| UX-01 | pause/restart/speed/hint/settings/level selection/storage/keyboard |
| UX-02 | 첫 성공 배치 전 타이머 미진행, 배치 후 진행, 재시작 준비 상태, 도움말 전후 수동 정지 보존 |
| UX-03 | 320px·390px·짧은 화면에서 현재/다음 두 상자 수량 겹침 없음, 주요 터치 영역 44px 이상, 슬롯 가득 참 처리 |
| UX-04 | 귀·얼굴·꼬리가 보이는 고양이, 같은 색 운반 블록, 트레이/구멍 구분, reduced-motion 효과 생략, 정확한 노출 표시 |
| UX-05/ADS-01 | 활성 상자만 남고 이동 개체가 없는 힌트 회귀, 추천 불가 시 광고 미요청, 광고 대기 중 정지·결과 복귀 |
| PERF-01 | 높은 레벨 엔진 비용, 프레임 간격, DOM 고양이 노드 없음, 배경 정지 |
| VIEW-01 | 390×844, 360×640, desktop viewport 및 스크린샷 |
| MOBILE-01 | Expo config, TS, iOS/Android bundle, 오프라인 내장 HTML |
| ADS-01 | 정상 보상/취소/실패/중복 응답, 동의 경계, 빈도 제한 |
| ART-01 | 100개 도안 고유성, 윤곽/얼굴/재료 색, 난이도별 이미지 동일성 |
| EDGE-01 | 네 방향 노출, 밀폐 구멍, 대각 틈, 예약/pickup 경계 |
| WALK-01 | 아래 출발, 장애물 회피, 직각 경로/보간, 집 구멍 우회 |


## 판정 규칙
단위 테스트와 브라우저 실행은 서로 대체하지 않는다. 모바일 JS bundle/config 성공은 실기기 광고 노출이나 스토어 출시 성공을 뜻하지 않는다. 실제 단말·시뮬레이터를 실행하지 못하면 미검증으로 명시한다. 최신 결과와 플랫폼별 한계는 아래 판정과 유량 검증 기록을 따른다.

## 개선 전 기준 검증 (2026-10-01)
웹 TypeScript/ESLint/FSD/production build PASS, 순수 게임·저장20PASS(300레벨 해법 포함), 네이티브 mock SDK·bridge8PASS, production browser E2E13PASS/8중복SKIP. 화면맞춤은1280×720/390×844/360×640을 검사했다. 세부 근거와 기존 실패 수정은 [검증 기록](../flow/2026-10-01-validation.md)을 따른다.

Android debug/release native 빌드·설치·실행 PASS. Metro 종료 및 wifi/data 비활성화 후 force-stop→재시작한 릴리스 앱의 오프라인 게임을 확인했다. 네트워크 복원 뒤 실제 AdMob 테스트 보상 광고 완료→닫기→1번 큐 강조·힌트 문구를 확인했다. iOS/Android JS bundle export는 PASS이며 iOS native 실행은 전체 Xcode 부재로 미검증이다. 운영 광고 수익과 스토어 출시를 완료로 주장하지 않는다.

Android 실기동·광고·백그라운드 정지의 세부 근거는 [모바일 검증](../flow/2026-10-01-mobile-validation.md)을 따른다. 전면 광고 노출은 mock 정책검증 범위이며 실제 노출을 확인했다고 주장하지 않는다.

## 고양이 UX 변경 검증 상태
위 수치는 고양이 UX 변경 전 기준 결과이며 새 변경의 통과 근거로 사용하지 않는다. UX-02~05 회귀, 렌더링, 모바일 레이아웃, 전체 정적 검사·빌드·브라우저 실행은 최종 통합 검증 후 [최신 UX 기록](../flow/2026-10-01-cat-ux-improvements.md)에 별도로 판정한다. 새 모바일 HTML 생성은 Android/iOS 네이티브 실기동을 대체하지 않는다.

## 고양이 UX 변경 검증 (2026-10-01)
게임·저장22, 광고/브리지 mock8, 브라우저 고유16시나리오(실패 수정 후 대상 재검증 합산) 통과. 첫 배치 타이머·도움말 정지·무효 힌트 광고 미요청을 검증했다. 모바일 HTML과 양 플랫폼 JS bundle을 갱신했다. 이번 변경의 native 재설치·실제 광고·최대 부하 프레임은 미검증이다. [최신 UX 검증 기록](../flow/2026-10-01-cat-ux-improvements.md#최종-통합-검증)을 기준으로 사용한다.

## ENGINE-01: Phaser 전환 검증
브라우저18PASS/12중복SKIP. WebGL 및 Canvas fallback, 고DPI상한2 resize, reduced-motion, 기존 진행·광고 회귀를 검증했다. `test:perf`는600샘플 CPU제출, 합성24고양이,10회 rebuild pool 안정성, destroy canvas 제거를 측정한다. 실제GPU 완료/FPS와 구분한다. [최신 엔진 기록](../flow/2026-10-01-phaser-refactor.md)이 현 렌더러의 근거다.

Phaser 내장 Android release 재빌드/설치/오프라인 cold launch/고양이 운반 후5블록 수집 PASS. 실제 renderer 종류의 native 진단·실제광고 재노출·iOS native는 별도 미검증. 네트워크 복원 및 테스트용 emulator 정리 완료.


## 현재 도안·보행 변경 검증 (2026-10-01)
원본 `reason-ball-ant`에 수정본을 적용하고 다시 검증했다. 게임/저장/외곽/경로 29 PASS(3난이도×100레벨 포함), 광고/브리지 mock 8 PASS, production 브라우저 18 PASS / 12 중복 SKIP. 웹·모바일 TypeScript, ESLint/FSD, Prettier, production/mobile HTML, iOS/Android Hermes export PASS.

Chrome에서 레벨1 고양이와 레벨11 김밥 도안, 아래 통로 이동과 수집을 확인했다. Android release를 새 HTML로 재빌드·설치하고 Pixel 8 Pro API35 에뮬레이터에서 Wi-Fi/data를 끈 cold launch, 아래 출발·블록 운반·14/177 수집·슬롯 해제를 확인했다. 시각 검증은 대표 장면이며 모든300레벨의 렌더링 경로를 프레임별 전수 검사한 것은 아니다. 120ms 집기 대기는 엔진/렌더러 계약이며 영상 육안으로 정밀 시간을 측정하지 않았다.

iOS native는 전체 Xcode 부재로 BLOCKED. 이번 변경에서 실제 광고 재노출·스토어 배포는 NOT RUN. 이전 임시 복제본의 환경 차단과 이번 실행 결과를 구분한다. [원본 적용·통합 검증](../flow/2026-10-01-artwork-walking-integration.md).
