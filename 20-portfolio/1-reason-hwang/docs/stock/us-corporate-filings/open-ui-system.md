# SEC OpenUI 화면 범위

## OPENUI-SEC-REMOVE-001: SEC 전용 데모 제거

`/open-ui/sec`(이전 `/a2ui/sec`)의 회사 검색·공시 선택·보고서 생성 데모와
전용 `generative_ui` SEC mode/action은 제공하지 않는다. 해당 화면의
`SEC-OPEN-UI-01`~`09` 요구사항은 현재 구현 범위에서 폐기한다.

현재 SEC 업무 화면은 다음과 같다.

- `/sec-api-agent`: SEC 도구를 사용하는 대화형 기업·공시 조회, 수집·분석 업무.
- `/sec-chat`: 기업 확인과 최신 10-K 근거를 사용하는 대화형 분석.

이 변경은 BFF의 SEC 수집·저장·조회 API와 DB, LangGraph의 10-K 파싱·조회,
공유 원문 클라이언트·보고서 계획·인용 검증, 공통 OpenUI 출력 계층을 제거하지 않는다.

## 관련 설계

- [SEC Intelligent UI](intelligent-ui.md)
- [공시 수집·저장 시스템](system-design.md)
- [OpenUI 공통 계약](../tech-shared/openui-migration.md)
- [LangGraph 구현](../tech-shared/3-langgraph-fast/open-ui.md)
