# 2026-10-26 탐색 종류 탭 높이 수정

- 원인: map-first 헤더 48px와 기본 kind-tabs/버튼 54px 규칙이 충돌해 채워진 테마 배경이 넘쳤다.
- 헤더를 내용 기반 높이/최소50px로 바꾸고 탭은34px, 컨테이너는 auto로 통일했다. 여백과 nowrap, 아이콘/배지 축소 방지 및 좁은 화면 wrap을 적용했다.
- 시스템 stock 반영.
- 검증: production build(TypeScript 포함), 실제 브라우저1440/390/320px에서 탭과 버튼의 bounding rect가 헤더 안에 포함되는지 확인했다. output/playwright/price-table/heading-fixed.png.
