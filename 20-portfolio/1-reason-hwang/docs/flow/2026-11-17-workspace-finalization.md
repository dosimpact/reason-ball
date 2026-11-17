# 2026-11-17 작업 최종 정리와 커밋

## 배경과 변경

사용자가 남은 작업 전체의 완료와 커밋을 요청했다. 이미 커밋된 선택형 Canvas, SEC Research Chat 이름 변경, 선택 기업 공시 수집 도구에 이어 남아 있던 전용 기술적 분석 화면의 FastAPI 전환과 관련 문서를 함께 정리한다. 기존 사용자가 작성한 Canvas 계획은 내용 수정 없이 커밋에 포함한다.

- `/technical-analysis`, `/technical-analysis/canvas`는 FastAPI 런타임을 사용한다. 개발 채팅은 별도 개발 런타임을 유지한다.
- 메뉴 회귀 검사는 전용 화면의 FastAPI 요청과 개발 채팅 요청을 구분한다.
- 현재 상태는 [Host 구조](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md), [OpenUI](../stock/tech-shared/1-fe-host/open-ui.md), [기술적 분석 지도](../stock/technical-analysis/INDEX.md), [시스템 설계](../stock/technical-analysis/system-design.md)에 반영한다. 기존 TA-Lib 비교·근거 설명의 미커밋 문서 변경도 보존한다.

## 검증

이번 최종 정리에서 다시 실행한 검사:

- `pnpm -C 1-fe-host typecheck`: PASS.
- `pnpm -C 1-fe-host test:chat`: 29 PASS, 0 FAIL.
- `pnpm -C 1-fe-host exec eslint src/_pages/chat/ui/page.tsx tests/e2e/technical-analysis-navigation.spec.ts`: PASS.
- `git diff --check`: PASS.

[초기 FastAPI 전환 기록](2026-11-16-technical-analysis-fastapi-migration.md)의 단위 테스트 실패·브라우저 미실행은 당시 상태다. 최신 단위 검사 결과는 위와 같으며, 전용 메뉴 2개와 Canvas 흐름의 브라우저 성공은 [Canvas 검증 기록](2026-11-17-canvas-item-workspace.md)에 있다. [SEC 이름 변경](2026-11-17-sec-research-chat-name.md)과 [수집 도구 API·브라우저 검증](2026-11-17-sec-chat-collection-tool.md)도 완료했다. 이번 커밋 정리에서는 브라우저/API를 추가 실행하지 않았다.

전체 lint의 기존 별도 오류는 Canvas 기록에 명시되어 있으며 전체 lint 통과를 의미하지 않는다. 공유 링크 등 후속 기능은 이번 완료 범위에 포함하지 않는다.

## 자원 정리

이번 정리에서는 서버나 브라우저를 생성하지 않았다. 앞선 검증에서 생성한 서버·브라우저의 정리 결과는 위 검증 기록에 보존했다. 사용자 실행 서버는 유지한다.
