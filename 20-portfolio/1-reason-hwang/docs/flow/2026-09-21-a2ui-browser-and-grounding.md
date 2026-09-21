# A2UI 브라우저 왕복과 수치 바인딩 보강

- 날짜: 2026-09-21 (KST)
- 요구사항: A2UI-DYN-001, A2UI-ACT-001, A2UI-STATE-001, A2UI-VAL-001
- Stock: [A2UI 시스템](../stock/tech-shared/a2ui-system.md)

## 관찰과 결정

Playwright MCP에서 OAuth 실제 모델로 항공편 카드를 생성하고 선택 완료 상태를 확인했다. Dynamic 지역 조회는 부산 $320,000 → 서울 $360,000 → 부산 $320,000 순서로 검증했다. 같은 결과를 재조회해도 갱신하도록 activity renderer의 중복 제거 기준을 메시지 ID와 내용의 조합으로 수정했다. 새 대화에서는 기존 카드가 사라지는 것을 확인했다.

후속 대시보드 생성에서 모델이 총 쿼터를 $650,000으로 잘못 계산했다. 프롬프트 강화만으로 처리하지 않고 서버 집계값을 `/facts/`에 주입하고 Metric/InfoRow/Chart/Table의 데이터 바인딩을 강제했다. 숫자 리터럴을 거절하며 모델의 사후 수치 답변도 막았다. SDK가 생성 시 바인딩 경로를 검사하므로 모델은 검증용 data를 반환하고, 서버는 렌더링 전에 이를 권위 있는 facts로 교체한다.

## 실행 증거와 범위

- MCP: browser_navigate, browser_snapshot, browser_click, browser_fill_form, browser_evaluate, browser_take_screenshot.
- [Fixed 선택 완료](evidence/a2ui-2026-09-21/a2ui-fixed-selected.png)
- [Dynamic 부산 조회](evidence/a2ui-2026-09-21/a2ui-dynamic-busan.png)
- 수치 바인딩 도입 후 Python 계약·그래프·모델 설정·facts 테스트 21개 PASS.
- 첫 실제 모델 재검증은 data 생략으로 SDK unresolved binding 검사를 통과하지 못해 FAIL. data 포함 후 재검증 진행 중.
- 위 브라우저 캡처는 수치 바인딩 변경 전 증거다. 최신 버전 브라우저 재검증, 취소 복구, 별도 API-key 실모델, 전체 최종 검증은 아직 완료하지 않았다.
- 브라우저 E2E·Storybook·빌드는 병렬 실행하지 않는다. 관련 없는 서버는 종료하지 않는다.
