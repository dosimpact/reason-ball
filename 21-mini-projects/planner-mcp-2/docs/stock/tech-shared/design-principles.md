# 설계 원칙

- FSD 의존 방향: app → widgets → entities/shared. 서버 IO는 app/server에서만 수행합니다.
- 순수 규칙(nextStatus, validateOverview)은 SQLite·HTTP·React에 의존하지 않습니다.
- 서비스의 각 작업은 트랜잭션에서 입력·참조·revision 검사 후 저장합니다. REST와 MCP는 같은 서비스를 호출합니다.
- UI는 자연어 본문과 정형 공용부를 분리하며, 체크리스트 문자열을 파싱해 상태로 사용하지 않습니다.
- SLAP: 라우트는 입력 변환·서비스 호출·오류 응답에 집중하고, 화면은 문서·템플릿·Overview 편집 컴포넌트로 나눕니다.

- CodeWeave는 `src/modules/codeweave/core`의 독립 라이브러리다. FSD 앱 레이어는 공개 `index.ts`만 소비하고, core는 앱·프레임워크·IO에 의존하지 않는다. 외부 SDK adapter는 core 바깥에 둔다.
