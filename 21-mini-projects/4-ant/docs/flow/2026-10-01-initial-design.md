# 2026-10-01 초기 설계·사진 분석

## 배경
새 worktree `/Users/dodo/workspace/focus/reason-ball-ant`, 브랜치 `feature/ant-pixel-game`, 기준 `591af3a`. 원본5장은 기존 main 작업 폴더에 보존하고 assets/references에 복사했다. 사용자 요청으로 gpt-6.1-sol 에이전트에 엔진·UI·모바일을 분담했다.

## 사진별 관찰
원본 순서001~005는 assets/references의01-game-start,02-speed-tutorial,03-loading-screen,04-level-complete,05-ants-carrying PNG에 대응한다.
1. `001`: Level3, 새 모양 픽셀 그림, 구멍, 흰 배치5자리,3열 queue. 검정25/흰50/검정25 뒤 붉은20/검정40/붉은20. 시간09:57,3x, 잠긴 보조기능.
2. `002`: 같은 화면에서 3배속 안내 overlay. 가속이 개미 이동에 적용됨을 설명한다.
3. `003`: FOOD HUNT 로딩 화면. 색 블록을 운반하는 개미와 구멍, 나무 배경.
4. `004`: Level2 완료 modal,40코인, Continue, 상단 생명과 통화.
5. `005`: 진행 중 주황/흰/검정 개미가 픽셀을 운반한다. 상자 잔량7/37/22, 비어 있는2자리. 그림의 일부가 제거됐다.

## 새 설계 결정
확정 관찰과 추정 규칙을 구분한다. 원작 전체 규칙은 사진만으로 알 수 없다. 본 게임은 상단 노출 픽셀 접근과5슬롯 막힘으로 전략을 만들고, 생명 구매/통화 대신 자유 retry와 레벨 선택을 제공한다. 원작 자산 대신 독자 픽셀 도안과 Ant Atelier UI를 제작한다. 난이도3개 각각100레벨을 결정적으로 생성한다.

## 기술 근거
- [MDN Canvas 최적화](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas): rAF와 반복 그리기 비용 관리.
- [Expo WebView](https://docs.expo.dev/versions/latest/sdk/webview/): React Native 안의 DOM 게임 재사용.
- [Google Mobile Ads Expo 설정](https://docs.page/invertase/react-native-google-mobile-ads): 네이티브 개발 빌드와 테스트 광고.
- [광고 동의](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent): 동의 획득 및 요청 가능 상태 확인.

참고한 Lingua 설계는 FSD 의존 방향, SLAP 순수함수, stock/flow, 접근성, 검증 범위 분리 원칙뿐이다. 서비스 도메인/서버 구성을 복사하지 않는다.

## 검증 상태
구현 진행 중. stock의 GAME/LEVEL/UX/MOBILE/ADS 계약을 기준으로 순수 엔진, 브라우저, 모바일 경계를 각각 검증한다. 운영 광고 계정/ID와 앱스토어 서명은 제공되지 않았다.
