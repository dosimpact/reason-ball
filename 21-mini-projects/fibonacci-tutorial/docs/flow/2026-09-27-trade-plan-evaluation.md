# TradePlan·TradeEvaluation 학습 흐름

- 날짜: 2026-09-27
- 맥락: 튜토리얼 안에서 거래 의사결정을 계획으로 기록하고, Replay 또는 시간 경과 뒤 같은 계획을 평가하려는 요청.
- 변경: 연습 유닛에 계획 작성·확정·평가 흐름을 추가. 계획·평가 분리, JSON Schema 버전, 원본 불변성, 사후 Binance 평가, 모호한 OHLC 판정 상태를 설계.
- 이유: 미래 정보를 보지 않고 내린 판단과 이후 관측 결과를 재현 가능하게 비교하기 위해.
- 영향 stock: `docs/stock/business-design.md`의 학습 흐름, `docs/stock/system-design.md`의 계획·평가 계약, `docs/validation/INDEX.md`의 검증 항목.
- 검증: 계획·stock·검증 문서의 용어와 링크 확인 예정. 구현·API·브라우저 검증은 없음.
- 후속 상태: 저장 방식, JSON Schema 상세 필드, 체결·수수료·슬리피지 정책은 상세 설계에서 확정.
