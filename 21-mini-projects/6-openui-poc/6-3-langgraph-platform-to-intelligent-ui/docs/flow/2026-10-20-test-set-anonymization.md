# 2026-10-20 Korean fixture 정리 및 ID 익명화

- 변경(IUI-005/107): HTML 8개와 `.DS_Store`를 제거하고 Markdown 8개만 남겼다. 공급업체/잔존 캠페인·상품 ID를 익명화하고 파일명을 `A00000001_rpt_sample.md`~`A00000008_rpt_sample.md`로 단순화했다. E2E 직접 참조 경로도 수정했다.
- 당시 검증: 원문 셀 보존/파싱 9 tests PASS, E2E 목록 14개 확인. 이름 변경 시 본문 바이트를 유지했다. provider/브라우저 재실행은 없었다.
- 후속 결정: ID 변경만으로 상품명·실적 정보가 제거되지는 않아 [독립 합성 데이터로 교체](2026-10-20-public-sample-data.md)했다. 현재 데이터 정책은 해당 기록과 [IUI-107](../stock/system.md#iui-107-보고서-생성과-원문-보존)을 따른다.
