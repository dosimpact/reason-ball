# 프로젝트 폴더와 패키지 이름 변경 (RENAME-001)

- 날짜: 2026-09-29
- 배경·이유: 사용자가 프로젝트 폴더와 패키지 이름 모두 영어 채팅 프로젝트에 맞게 변경하도록 지정.
- 변경: 폴더 `20-portfolio/3-fsd-next-sample` → `20-portfolio/3-ai-english-chat`, 루트 패키지 `@fsd-next-sample/workspace` → `3-ai-english-chat`, 웹 앱 `@fsd-next-sample/web` → `@ai-english-chat/web`.
- 관련 설정: 루트 실행 스크립트와 Playwright 실행 필터, 상위 workspace 제외 경로, 현재 문서와 에이전트 지침의 참조를 갱신. 이전 유량 기록은 보존.
- 영향받는 저량: `docs/stock/system-design.md` §2 패키지 식별자 및 ADR-001 경로.
- 검증: 새 경로에서 pnpm 패키지 목록과 웹 앱 필터를 확인하고, 상위 workspace에서 독립 프로젝트가 제외되는지 확인. Git 공백 오류 검사 수행. 앱 기능 변경이 없어 런타임 테스트는 실행하지 않음.
