# OpenUI 통합 문서 안내

이 파일은 과거 A2UI 기술 문서의 링크를 보존하는 진입점이다. CopilotKit/A2UI 실행 구현과 카탈로그 manifest 계약은 OpenUI 통합으로 대체되었다.

- [현재 공통 설계](../openui-migration.md): 최종 출력 서브그래프, 상태·action·SSE 계약, 화면별 기능과 제한.
- [Host 구현](../1-fe-host/a2ui.md) / [LangGraph 구현](../3-langgraph-fast/a2ui.md).
- [SEC 업무 요구사항](../../us-corporate-filings/a2ui-system.md).
- [전환 실행 검증](../../../flow/2026-11-08-openui-runtime-validation.md).
- [과거 A2UI 완료 기록](../../../flow/2026-09-21-a2ui-oauth-scope-and-completion.md): 당시 구현의 증거이며 현재 전환 검증을 대신하지 않는다.

기존 `/a2ui/*` 화면 URL은 유지한다. 새 기술 내용은 공통 설계와 해당 패키지 문서에서 관리한다.
