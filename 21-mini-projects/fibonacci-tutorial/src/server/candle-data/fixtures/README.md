# 고정 Binance 학습 자료

2026-09-27 Binance 공개 market-data `/api/v3/klines`에서 취득했습니다. `manifest.json`에 원본 URL, UTC 범위(ms), symbol/interval, 봉 수, 취득 시각, 각 JSON 파일의 SHA-256을 기록합니다. 파일은 공통 Candle 형식이며 time은 Unix seconds입니다. API 접근 키는 사용하지 않았습니다.

- `btc-2024-01`: BTCUSDT 1h, 2024-01-01부터120봉.
- `eth-2024-02`: ETHUSDT 1h, 2024-02-01부터120봉.
- `btc-2024-03`: BTCUSDT 4h, 2024-03-01부터120봉.
- `mtf-*`: BTCUSDT 2024-04-01 00:00:00 UTC부터2024-04-20 종료까지, 1h480/4h120/1d20봉.

`tests/curriculum-data.test.ts`에서 파일 hash, OHLC, 봉 수, 시각 연속성 및 상위봉 OHLC·거래량이 하위봉 집계와 일치함을 검사합니다. 이 자료의 파동 해석을 객관 정답으로 제공하지 않습니다. 학습자의 카운팅·대안·유보 근거를 검토하는 실전 관측 자료입니다.

전체 파일은 서버 전용입니다. SessionView에는 허용된 관측 시점까지의 봉만 반환합니다. 실전 사례의 원본을 바꿀 때는 같은 파일을 덮어쓰지 않고 새 ID와 manifest를 추가합니다.
