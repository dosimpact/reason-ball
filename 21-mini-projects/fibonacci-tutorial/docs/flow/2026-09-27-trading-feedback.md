# 리스크 관리·청산 맥락 보완

- 날짜: 2026-09-27
- 맥락: 기존 Lesson 1–6을 유지하면서 무효화·손절, 5파 이후 청산, 선택형 가이드라인을 보완하자는 피드백.
- 변경: Lesson 4에 카운팅 무효화와 Stop Loss 비교, Lesson 6에 5파 완료 후 청산 판단을 추가. 균등·교대는 선택형 힌트로 분리.
- 이유: 규칙에 따른 카운팅 판정, 실제 매매의 손절·익절 결정, 확률적 가이드라인을 혼동하지 않도록 하기 위해.
- 영향 stock: `docs/stock/business-design.md`의 Lesson 4·6 및 힌트 요구.
- 검증: 이론 표현은 Elliott Wave International의 [3대 규칙과 가이드라인](https://www.elliottwave.com/articles/elevate-your-elliott-wave-analysis/), [균등](https://www.elliottwave.com/waveopedia/equality/), [교대](https://www.elliottwave.com/waveopedia/alternation/), [5파 이후 조정](https://www.elliottwave.com/free/introduction-to-the-wave-principle/) 설명과 대조. Markdown 16개 파일의 로컬 링크 누락 0건; 구현 검증은 없음.
- 후속 상태: Stop Loss 가격·체결 규칙과 청산 평가 기준은 상세 설계에서 정함. 프로젝트 스캐폴딩은 이번 변경 범위에 포함하지 않음.
