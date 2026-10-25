# 2026-10-26 사용자 테마 선택

- THEME-001: 사이드 레일 위치에 공통 테마 버튼을 제공한다. 모바일에서는 하단 우측 팔레트 버튼으로 전환한다.
- 린넨 웨딩(기본), 펄 블루, 로즈우드, 모카 실크, 이브닝 웨딩의 5개 팔레트. 초록은 제외하고 저채도 중심으로 구성한다. 가격표 중립 표면과 Positron 원본 배경은 유지한다.
- features/theme의 공통 선택 Dialog와 src/app/themes.css 토큰을 사용한다. HTML data-theme와 localStorage orot:theme를 사용하며 초기 스크립트는 유효 ID만 복원한다. useSyncExternalStore로 선택 상태를 구독한다. 저장 실패 시 현재 DOM 테마는 유지한다.
- 업무/시스템 stock 동기화. 선택은 사용자의 브라우저에만 저장된다.
- 검증: lint, 45개 기존 테스트, production build(TypeScript 포함) 통과. 실제 브라우저에서 5가지 계산 색상/aria-pressed, 새로고침 복원, 페이지 이동 유지, 모바일390px Dialog 확인. 검증 후 기본 린넨 웨딩으로 복원.
- 증거: output/playwright/price-table/themes-desktop.png, themes-mobile.png.
