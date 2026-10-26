# 2026-10-20 벤더 인터랙티브 보고서

- 배경(IUI-005/107): 범용 프롬프트만으로는 표 위주 출력·ID 누락·미기재 값의 0 보정을 막지 못했다.
- 결정: 문서 업로드 → 표 구조화 → 원문 KPI/차트/필터/조치 구성 → 모델 해설 → 계약 검증 경로를 도입했다. 모델은 숫자와 차트를 다시 쓰지 않으며, 해설 실패 시 안내와 원문 보고서를 제공한다. HTML은 비실행 텍스트로 추출한다.
- 보강: 명시적 시간 단위와 누락값을 구분하고, 동일 예산과 충돌하는 증액 해설을 제한했다. ID 인라인 코드 및 대화/필터/체크 상태 복원을 추가했다.
- 당시 최종 검증: Python 13 tests/Ruff, frontend 337 tests/typecheck/lint/build, 프롬프트 cmp PASS. Chrome 18/18(당시 MD/HTML 16개 실제 provider + fixture 2개); 실제 해설 15개/계약 거절 fallback 1개였다. KPI/ID·parser·필터·슬라이더·복사·복원·모바일을 확인했다.
- 한계: AI 해설의 의미적 정확성과 임의 문서 해석은 미보장. 탭 제거는 [연속 보고서](2026-10-20-continuous-reports.md), 현재 fixture는 [합성 데이터](2026-10-20-public-sample-data.md)로 후속 변경됐다.
- 반영·증거: [IUI-107](../stock/system.md#iui-107-보고서-생성과-원문-보존), Git 제외 `frontend/output/playwright/`와 `frontend/output/validation/vendor-reports/`. 원본 식별자는 공개용 표기로 정리했다.
