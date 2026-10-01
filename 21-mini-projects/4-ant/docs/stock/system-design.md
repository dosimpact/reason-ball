# Cat Atelier 시스템 설계

## 구조와 원칙
루트 pnpm/Turbo workspace의 `ant-atelier` 앱과 `@ant-atelier/mobile` 패키지로 통합한다. 별도 중첩 workspace/lockfile은 만들지 않는다.

`src/app → widgets → features → entities → shared` 의존 방향. 엔진과 레벨 생성은 entities/game의 순수 TypeScript다. `levels.ts`는 난이도/레벨로 배치를 결정하고 별도 난수나 외부 seed를 사용하지 않는다. `model.ts`는 전달받은 tick 시간만 진행하며 픽셀·상자·고양이 상태를 복제해 입력을 변경하지 않는다. DOM·Canvas·저장·광고·브라우저 lifecycle은 외부 경계에서 소유한다. 각 함수는 동일 추상화 수준으로 조합하고 계산/검증은 이름 있는 함수로 분리한다(SLAP).

도안은 `artworks.ts`의20종 직접 작성한 의미 색상 맵과5테마로100개를 만든다. 난이도마다 모양/색은 동일하다. 대기열은 외부4연결 flood fill로 수집 가능한 픽셀을 제거하는 구성적 해법으로 생성한다. 쉬움/보통/어려움은 최대20/14/8 상자용량과 시간으로 구분한다. 힌트는 최소 상자ID를 추천하고, 앞선 상자가 멈췄다면 실제 노출 색을 가진 앞 상자를 안내한다.

## 실행
React는 컨트롤과 대화상자, Phaser4.2.1 Scene은 그림과 고양이를 WebGL 우선(Canvas fallback)으로 렌더링한다. Phaser가 단일 게임 루프를 소유한다. 제한된 DPR, React HUD 갱신 제한, 동시에24마리인 고양이 수 상한으로 프레임 비용을 제한한다. 고정 시뮬레이션 단계와 렌더링을 분리하고 숨김 탭/앱 백그라운드에서는 시간을 진행하지 않는다. 엔진 tick은 고양이 도착 이벤트 경계에서 시간을 나누므로 같은 총시간의 프레임 분할은 동일 결과를 낸다. 픽셀 예약→집기→운반 완료를 구분해 한 픽셀을 두 고양이가 운반하지 못하게 한다.

## 모바일
React Native/Expo 셸은 단일 HTML로 빌드한 React 게임을 WebView에 내장한다. 게임은 네트워크 없이 동작한다. 모바일과 웹의 동일 게임 엔진·그림·규칙을 재사용하며 별도의 네이티브 뷰 엔진으로 오인하지 않는다. WebView 메시지는 타입·형식 검증, 요청 상관관계, 보상 이벤트 확인을 거친다. 외부 페이지 탐색을 제한하고 광고 SDK는 모바일 경계가 소유한다.

## 광고
Google Mobile Ads 네이티브 adapter는 사용자 동의 확인 이후 초기화하며 테스트와 운영 ID를 구분한다. 전면 광고의 빈도 제한, 보상형 완료의 단일 지급, 광고 오류의 게임 복귀를 계약으로 둔다. 일반 웹 빌드에 네이티브 광고 SDK를 포함하지 않는다. 모바일 광고는 Expo Go가 아닌 development/production native build에서 실행한다.

## 성능 검증
최대 레벨/고양이 수의 순수 엔진 tick 및 브라우저 frame 간격을 기록한다. 로컬 측정 결과를 모든 기기의60fps 보장으로 표현하지 않는다. 번들 크기, 모바일 viewport, 콘솔 오류, background pause를 별도로 검증한다.

## 구현된 UI·진행 저장
Canvas는 실제 도안 bounding box를 기준으로 크기를 정하고 고양이의 목적지도 같은 좌표를 사용한다. 외부 폰트·이미지 다운로드 없이 게임이 실행된다. React DOM은 조작부만 소유하며5슬롯과3열의 색/수량 preview를 제공한다. localStorage에는 난이도별 최고 진도와 마지막 선택을 나눠 저장하고 형식·범위를 검증한다. 모달은 초기 초점·Tab 순환·닫힌 뒤 초점 복원을 처리한다.

속도 인수는 고양이 이동만1~3배 가속하고 제한시간은 realDeltaMs로 계산한다. 새 게임 시작은 이전 보상 요청을 무효화한다. 보상응답은 pending requestId와 일치해야 하며 취소·실패로 힌트를 주지 않는다. 실제 네이티브 광고 이벤트와 mock 브리지 검증은 각각 기록한다.

Expo54/React Native0.81.5와 Google Mobile Ads16.0.0을 고정해 Android Kotlin 호환성을 검증했다. EAS post-install에서 웹의 단일 HTML을 생성하므로 ignored generated 파일을 원격에 수동 포함하지 않는다. Phaser 내장 Android 릴리스 APK를 오프라인에서 실행하고 고양이 운반/수집을 확인했다. iOS는 JS bundle/config 단계까지 확인했다. 운영 AdMob ID는 빌드 시 검증하며 개발/preview는 테스트 ID를 사용한다.

## UX-02~05: 고양이 표현·상호작용
표현 이름은 Cat Atelier이며 Canvas의 고양이는 귀·꼬리·수염·발과 색상 몸통으로 식별한다. 운반 블록은 최소 8 CSS px다. Canvas 자체가 상단 아이보리 트레이와 하단 구멍을 그리며, 픽셀 좌표와 고양이 목적지를 동일한 artwork layout으로 계산한다. `exposedIds` 결과의 픽셀에만 색상에 독립적인 테두리 표시를 그린다. 귀환 마지막 구간의 축소·사라짐과 발 움직임은 `prefers-reduced-motion`에서 생략한다. 고양이별 DOM 노드나 별도 파티클 상태는 만들지 않는다.

호환성을 위해 내부 `Ant`, `GameState.ants`, `MAX_ACTIVE_ANTS`, 패키지명, 기존 저장 키·브리지 이벤트·네이티브 앱 식별자는 유지한다. 이 이름들은 캐릭터를 개미로 렌더링한다는 뜻이 아니다. 광고 ID나 설치 ID를 단순 표시 이름 변경에 맞춰 임의로 바꾸지 않는다.

첫 배치 전 준비 상태는 세션 경계에서 관리하며 순수 엔진의 tick 계약은 유지한다. 도움말, 수동 정지, 백그라운드, 광고 대기를 독립된 정지 사유로 합성한다. 도움말을 닫아도 수동 정지 사유를 지우지 않는다. 힌트 추천 불가 상태에서는 광고를 요청하지 않으며 pending 광고 동안 게임을 정지한다. 시작·재시작은 이전 광고 요청을 무효화하고, 완료·실패·타임아웃은 해당 대기 정지만 해제한다.

설계 근거와 변경별 검증 항목은 [사진 재분석·UX 감사](../flow/2026-10-01-cat-ux-improvements.md)에 기록한다.

## ENGINE-01: Phaser 렌더링 경계
`widgets/game/renderer.ts`는 Phaser Game/Scene lifecycle, ResizeObserver, DPR상한2를 소유한다. `texture-art.ts`는 부팅 시 atlas와 크기 변경 시 배경을 그린다.512×256 공유atlas, 고양이24+운반블록24 Image pool, 상태 변경 시 블록 frame/visibility 갱신으로 매 프레임 경로 계산을 없앤다. 도안 좌표·배경은 resize/level 변경 때만 갱신한다. Scene은25ms 순수 시뮬레이션과10Hz React HUD를 구동하며 별도React rAF는 없다. 물리 엔진·오디오·Phaser 입력은 사용하지 않는다. UI접근성과 네이티브 광고 경계는 유지한다.

엔진은 웹 lazy chunk, 모바일 singleHTML에 내장된다. import 취소 및 unmount 시 observer/engine을 정리한다. 화면이 짧으면 WebView에서도 스크롤을 허용한다. 초기 용량은 증가했으며 CPU 제출 비용 감소와 동일 의미가 아니다. [선정·측정·검증](../flow/2026-10-01-phaser-refactor.md)을 따른다.

## EDGE-01 / WALK-01: 외곽 제거와 직각 보행
`exterior.ts`는 present/reserved 장애물을 대상으로 그림 아래에서4방향 flood fill한다. enclosed hole은 제외하고 carried/deposited 공간은 길로 사용한다. `collectionPath`는 아래 입구부터 대상 옆 셀까지 최단 빈 길을 찾고 목표 셀을 끝에 붙인다. 엔진은 불변route와 길이 기반duration을 운반 개체에 저장한다. `walking-path.ts`는 슬롯→아래 통로→격자 경로와 역방향 귀환→집을 가로/세로 선분으로 연결하고 거리 기준으로 보간한다. Phaser는 캐시된 선분만 사용하며 매 프레임 BFS를 하지 않는다. reserved 픽셀은 pickup 전까지 다음 픽셀을 막는다.

[구현 결정](../flow/2026-10-01-artwork-and-walking.md)과 [원본 적용·현재 검증](../flow/2026-10-01-artwork-walking-integration.md)을 따른다. 현재 원본 적용과 Android release 오프라인 실기동을 확인했으며 iOS native는 전체 Xcode 부재로 미검증이다.
