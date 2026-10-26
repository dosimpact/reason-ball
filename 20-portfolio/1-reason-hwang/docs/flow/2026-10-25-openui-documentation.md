# 2026-10-25 OpenUI 사용 사례 문서 보완

- 범위: tech-shared / 1-fe-host, OPENUI-DOC-001.
- 배경: OpenUI 구현·실행 문서는 있었으나 `/sec-chat`과 `/sec-api-agent`의 사용 차이와 핵심 코드 위치를 문서 지도에서 바로 파악하기 어려웠다.
- 변경: 기존 Host stock에 두 화면 비교표, 실제 소스 링크, AG-UI와 OpenUI 역할, 메모리 대화 보관 범위, 카탈로그 생성 명령과 의존성 선언을 추가했다. 루트·tech-shared 지도에서 직접 연결했다.
- 이유: 기존 canonical 문서를 보완하여 별도 중복 설계 문서를 만들지 않고 탐색성을 높인다. `/chat`의 OpenUI 생성과 `/research`의 Markdown 반환을 구분한다.

## 반영한 stock

- [Host OpenUI 안내](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md#openui-doc-001-사용-사례와-코드-안내)
- [문서 지도](../INDEX.md)
- [Tech-shared 지도](../stock/tech-shared/INDEX.md)

## 검증

- 코드 대조: Host package.json, AnswerView, 관리자 page/session-storage/프록시, Python `/chat`과 compose_ui, 검증 API 및 생성물 동기화 스크립트를 확인했다.
- PASS: 변경한 문서의 로컬 파일 링크 존재 여부 검사. 앵커는 추가한 제목과 대조했다.
- PASS: `git diff --check -- docs` 및 변경 범위·문서 구조 확인.
- API·View·비즈니스 로직 변경 없음. docs/validation/INDEX.md의 문서 전용 검증 규칙에 따라 Bruno·Storybook·브라우저 실행은 적용 대상이 아니다. 과거 실행 증거를 새 실행 결과로 간주하지 않는다.
- 자원 정리: 서버·브라우저·MCP 연결·임시 데이터 생성 없음. 기존 사용자 자원은 사용하거나 종료하지 않았다.
- 후속 상태: 문서 보완 완료. 런타임 재검증은 이번 변경 범위에 포함하지 않는다.
