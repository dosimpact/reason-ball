# GitHub Primer 스타일 리팩터링

날짜: 2026-09-27. 상태: 완료. 결정: UI-PRIMER-001.

사용자 요청에 따라 GitHub Primer light/dark 테마를 적용한다. 기본은light이며 선택을localStorage에보존한다. 공식 `@primer/primitives`의 의미별 토큰을 사용하여 배경·테두리·텍스트·링크·주요 버튼·피드백을 통일한다. 시스템 폰트, 6px 모서리, 얇은 테두리와 적은 장식으로 구성한다. 메인/챕터/워크북/차트/Storybook이 같은 팔레트를 사용한다. 차트의 canvas 색은 같은 CSS 토큰을 계산하여 전달한다.

참고: https://primer.style/product/primitives/ · https://primer.style/product/getting-started/foundations/color-usage/

검증: 메인·연습·모바일 실제 화면, 기존 Playwright/Storybook 흐름, lint/typecheck/build. 사용자 dev4310 유지. 영향을 받는 stock: 시스템 스타일 계약, 비즈니스 표시 원칙.

## 결과

공식 @primer/primitives 토큰, 시스템폰트,6px모서리·얇은경계, 링크/버튼/피드백/차트색상을통일했다. 사이드바상단전환은모바일에서도노출된다. 서버렌더초기스크립트가저장테마를복원하고 canvas도전환한다. Storybooktoolbar에서테마를고른다.

`test:integration`: Bruno71, UI20, Storybook14 PASS; lint/typecheck/build PASS. 신규테마테스트는실제canvas픽셀색,선택유지,재방문,내비게이션,모바일overflow를확인한다. `/tmp/primer-integration.log` 참고. 검증서버·임시JSON은정리,사용자dev4310유지.
