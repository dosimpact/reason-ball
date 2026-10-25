# 2026-10-26 CARTO Positron 적용

- MAP-POSITRON-001: 사용자가 제공한 키를 gitignored app/.env.local에 설정하고 기본 지도 타일을 light_all(Positron)로 교체했다. 실제 키는 문서/소스에 기록하지 않는다.
- NEXT_PUBLIC_CARTO_BASEMAPS_KEY는 빌드 시 포함되는 브라우저용 공개 키이다. .env.example과 README에 설정·standalone 재빌드 방법을 추가했다. 키 미설정 OSM 및 타일 오류 HOT fallback 유지.
- OSM/CARTO 저작자 표시를 제공한다. 마커/좌표/지도 범위 목록 로직은 유지했다.
- 업무/시스템 stock 동기화. 공식 참고: https://carto.com/basemaps/apikey/
- 검증: lint 및 production build(TypeScript 포함) 통과. 실제 브라우저의 light_all 타일 로드 및 스크린샷에서 회색 배경과 기존 자주색 마커 확인. 스크린샷 output/playwright/price-table/positron.png.
