# Planner MCP 2 실행 기준

- 패키지: planner-mcp-2, Node.js 24+, pnpm workspace·루트 lockfile 공유.
- 개발·생산 기본 포트: 4000, 0.0.0.0에 바인딩. Storybook: 6106.
- 실행: `pnpm --filter planner-mcp-2 dev`; 생산: build 후 start.
- 저장: PLANNER_DATA_DIR 또는 패키지 .data 디렉터리의 planner.sqlite. WAL 사용. 첫 초기화에 공통 템플릿 5개와 전용 설계·검증 템플릿 3개 생성. 기존 저장소에도 전용 양식은 1회 추가하며 사용자 편집·삭제와 기존 문서 snapshot을 보존.
- 검증: test, lint, typecheck, test:e2e. test:e2e는 build·build-storybook도 수행하며 임시 DB·소유 포트만 사용.
- 구조: app/server에서 SQLite·MCP·HTTP 경계, entities/planner에서 스키마·순수 규칙·공용 뷰, widgets/workspace에서 화면 조합, shared/api에서 HTTP 호출.
- 기본값: 단일 사용자, 외부 허용 주소는 PLANNER_ALLOWED_ORIGINS로 지정. 문서 revision 충돌 검출. 사람 확인은 AI 검증 전에도 가능. 최종 verified는 모든 항목의 AI passed와 사람 확인이 모두 필요. 이전 검증 실행의 별도 버전 이력은 저장하지 않음.
- UI 업무 흐름과 Storybook은 Chromium, 실제 MCP는 SDK Streamable HTTP 클라이언트로 검증.

- 외부 접속: http://dodonet.iptime.org:14000 → 내부 4000. .env.local의 PLANNER_ALLOWED_ORIGINS에 정확한 외부 Origin을 등록합니다. 예시는 .env.example을 참고합니다.

## CodeWeave core

- 경계: `src/modules/codeweave/core/index.ts`. 상대 `.js` import만 사용하며 runtime 외부 의존성 없음.
- `pnpm --filter planner-mcp-2 test:codeweave`: 공개 API 회귀 테스트.
- `pnpm --filter planner-mcp-2 build:codeweave`: ES2022 ESM·선언 파일 생성. 출력 `.codeweave-build/`는 git 제외. DOM·Node 타입·Next.js config를 상속하지 않는다.
- `pnpm --filter planner-mcp-2 check:codeweave`: 독립 빌드 후 임시 디렉터리에서 ESM import·컴파일·수정 smoke 검증.
- 상세: [CodeWeave](../../codeweave/INDEX.md). 아직 npm publish나 Next.js UI·MCP adapter 연결은 하지 않았다.

- dev/build는 `build:codeweave`를 먼저 실행합니다. Next는 독립 ESM 산출물 `.codeweave-build`를 읽으며 core 수정 후 dev 재시작이 필요합니다. 산출물은 커밋하지 않습니다.
