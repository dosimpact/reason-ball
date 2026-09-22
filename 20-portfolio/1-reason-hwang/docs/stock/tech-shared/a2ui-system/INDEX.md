# A2UI 기술 문서 지도

이 폴더는 `1-reason-hwang` A2UI 기술 내용의 현재 원본이다. 공통 개념부터 패키지 구현, 도메인 적용, 운영 순서로 읽는다. 기존 기능 상태는 **OAuth 검증 범위 구현·검증 완료**이다. SEC 재무 차트 확장은 설계 단계이며 미구현이다. 과거 결정·실행 증거는 `docs/flow/`에 보존한다.

| 문서 | 내용 |
| --- | --- |
| [시스템 설계](a2ui-system.md) | 요구사항, Dynamic/Fixed 차이, 전체 구조, 고정 버전, 신뢰 경계 |
| [Registry와 카탈로그](registry-and-catalog.md) | 61개 UI 파일/66개 어댑터 목록, 4개 하위 카탈로그, 생성·확장 절차 |
| [React Host](frontend.md) | CopilotKit Provider/Runtime, surface 렌더링, 데이터 편집 갤러리 |
| [LangGraph](langgraph.md) | 그래프 실행, 상태·모델 설정, API, 동시 실행 제한 |
| [프로토콜·사용자 action·진행 SSE](protocol-and-events.md) | messages와 데이터 모델, action 왕복, 진행 상태·취소 처리 |
| [SEC 재무 차트 설계](sec-financial-charts.md) | 미구현: 목차 선택 읽기, 데이터 추출/차트 렌더 두 도구, 6종 차트, 수치·출처 검증 |
| [SEC 적용](sec.md) | 회사→공시→근거 보고서, 조회 필터, revision, 인용 검증과 제한 |
| [운영과 검증](operations-and-validation.md) | 실행 명령, 설정·포트, 검사 순서, 증거와 남은 항목 |

## 자주 묻는 질문

- **Dynamic와 Fixed 차이?** Dynamic은 모델이 허용된 카탈로그에서 화면 구조를 선택한다. Fixed는 작성한 트리에 데이터를 채운다. 자세한 비교는 [시스템 설계](a2ui-system.md#dynamic-fixed-sec-비교).
- **A2UI는 messages에 들어가는가?** 도구 결과의 A2UI operation envelope는 ToolMessage로 남는다. surface 데이터와 진행 스트림을 모두 messages에 누적하는 구조는 아니다. [상태 계약](protocol-and-events.md#상태의-소유권).
- **React는 CopilotKit 전용인가?** 프로토콜 자체는 React/CopilotKit에 종속되지 않는다. 현재 구현은 CopilotKit의 Provider·renderer·runtime을 사용하므로 대체하려면 렌더·바인딩·action·스트림 연결도 구현해야 한다.
- **사용자 adoption/action은?** 이번 범위에서 채택한 의미는 사용자가 입력·선택·제출한 값을 서버에 반영하는 action이다. 분석 결과 승인·영구 저장 업무는 별도 구현하지 않았다.
- **로딩 중 무엇을 하는지 볼 수 있는가?** [진행 이벤트](protocol-and-events.md#진행-sse)는 실제 LangGraph 단계만 표시한다.

## 문서 유지 규칙

기술 내용은 이 폴더에 한 번만 갱신한다. 패키지의 기존 `a2ui.md`는 이곳으로 연결하는 진입점이다. SEC 업무 요구사항은 [도메인 문서](../../us-corporate-filings/a2ui-system.md), 기존 저장·수집 API는 [도메인 시스템](../../us-corporate-filings/system-design.md)이 소유한다. 이력은 [통합 기록](../../../flow/2026-09-21-a2ui-document-consolidation.md)에 연결한다.

- [요구사항별 완료 감사](acceptance-audit.md): 증거 범위와 현재 남은 gate.
