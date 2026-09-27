# 더미·Binance 데이터 레이어 설계

- 날짜: 2026-09-27
- 맥락: 더미 데이터와 캐시를 둔 Binance API 실전 데이터를 모두 사용할 수 있는 레이어 요청.
- 변경: `CandleSource` 선택, 공통 `CandleRepository`, 더미·Binance 어댑터, 정규화, 요청 조건별 캐시, 연습 스냅샷 및 Replay 공개 경계를 설계.
- 이유: 유닛·차트·계산 로직이 데이터 출처와 무관하게 동작하고, 같은 연습의 결과가 조회 시점에 따라 바뀌지 않게 하기 위해.
- 영향 stock: `docs/stock/business-design.md`의 데이터 선택·재현성, `docs/stock/system-design.md`의 데이터 레이어·디렉터리 구조.
- 검증: [Binance Spot REST](https://developers.binance.com/en/docs/products/spot/rest-api)와 [시장 데이터 전용 엔드포인트](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md)에서 공개 캔들 조회 경로 확인. Markdown 18개 파일의 로컬 링크 누락 0건, 계획·stock의 데이터 계약 일치 확인. 실제 API 호출과 구현 검증은 없음.
- 후속 상태: 캐시 저장소·유효 기간, 응답 정규화 세부 사항, 스냅샷 보존 방식은 구현 전 결정.
