# 2026-10-26 메인 2 적용 확대

- 요청: 두 번째 메인 색이 드러나는 영역 확대.
- DESIGN-002: 지도 지역 배지/대표점, 선택 필터 태그, 비교함 태그와 버튼, 상세 가격 요약의 배경·테두리·금액에 secondary 계열을 사용한다. 표 본문/전체 표면은 중립색 유지. 다섯 테마에서 동일 역할로 적용된다.
- 업무/시스템 stock 동기화.
- 검증: production build(TypeScript 포함) 통과. 실제 브라우저 지도 지역 배지의 계산 색상을 기본 테마 secondary와 대조해 확인했다. output/playwright/price-table/secondary-expanded.png.
