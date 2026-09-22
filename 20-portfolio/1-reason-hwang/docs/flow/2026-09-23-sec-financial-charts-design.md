# SEC 재무 차트 설계 구체화

- 날짜: 2026-09-23
- Scope: us-corporate-filings / tech-shared A2UI; 1-fe-host, 3-langgraph-fast
- 상태: 설계 문서 완료. 코드 구현 및 기능 실행 검증 전.

## 배경과 결정

사용자는 선택 공시 한 건, 목차 기반 선택 읽기, 본문 재무 표 우선, 6종 차트, 차트·표·지표 카드의 Dynamic 조합을 확정하고 설계 구체화를 요청했다. 별도 SEC 구조화 API는 후속 결정이며 이번 설계의 데이터 원본에 포함하지 않는다.

현재 normalizer는 HTML 표 구조를 제거하고 기존 Chart는 bar/pie만 지원하며 SEC 허용 목록에는 없다. 기존 요약 보고서에서 수치를 재추출하는 대신 원문 표 구조 보존 경로를 설계했다. BFF content는 전체 본문 응답이므로 로컬 전체 파싱과 모델의 선택 읽기를 명확히 구분했다.

공개 도구는 extract_financial_data와 render_financial_charts 두 개다. 모델은 셀 매핑과 표현을 제안하고 서버는 원문 셀의 수치·기간·단위·출처를 검증한다. 렌더에는 숫자 배열 대신 datasetId와 ID 기반 계획을 전달한다. 기존 Chart 호환성을 보존하는 FinancialChart 확장을 제안했다. 데이터셋 수명, Inline/Canvas 격리, 실패 보존, 예산, 차트 적합성, 구현 순서와 검증 시나리오를 구체화했다.

예산·새 카탈로그 버전·표 파서 선택은 구현을 위한 제안임을 표시했다. 첫 구현 단계에서 실제 저장 HTML 표본과 생성기의 버전 가정을 검증한다. 임의 파생 지표 계산은 v1 범위에서 제외한다.

## 갱신한 stock

- [재무 차트 설계](../stock/tech-shared/a2ui-system/sec-financial-charts.md): 상세 계약의 원본.
- [도메인 요구사항](../stock/us-corporate-filings/a2ui-system.md): SEC-CHART-001~006 확정 범위.
- [기존 SEC](../stock/tech-shared/a2ui-system/sec.md): 미구현 확장 연결, 현재 동작 보존.
- [A2UI 지도](../stock/tech-shared/a2ui-system/INDEX.md), [전체 지도](../INDEX.md): 탐색 경로와 설계/구현 상태 구분.

## 검증과 자원

문서만 변경했다. 변경 Markdown의 상대 파일 링크 존재 검사와 `git diff --check`를 수행하여 통과했다. 문서의 두 도구, 6종 차트, 단일 공시, 기존 출력 수명 및 미구현 표시를 검토했다. API·View·비즈니스 실행 코드 변경이 없어 Bruno/Storybook/브라우저 실행 검증은 이번 문서 작업의 적용 대상이 아니다. 향후 구현 gate는 설계 10절에 명시했다.

새 서버·브라우저·MCP 연결·임시 실행 환경을 생성하지 않았다. 기존 서비스는 변경하지 않았다. 시작 시 존재한 `1-fe-host/src/features/a2ui-demo/demo.tsx`의 사용자 변경은 보존하고 문서 커밋에서 제외한다.
