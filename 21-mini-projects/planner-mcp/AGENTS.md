# Planner MCP 작업 규칙

상위 저장소의 `AGENTS.md` 규칙을 함께 따릅니다.

## 문서 운영

- 문서는 두 종류로 관리합니다. `docs/design/`는 계속 유지하는 현재 설계, `docs/changes/`는 변경 사항과 결정 이유의 이력입니다.
- 작업 시작 시 `docs/design/README.md` → 관련 요구사항 → 관련 상세 설계를 읽습니다. 변경 이유가 필요할 때만 이력을 확인합니다.
- 현재 설계만 읽어도 작업할 수 있도록 유지합니다. 과거 변경 기록을 조합해야 현재 규칙을 알 수 있게 만들지 않습니다.
- 현재 설계의 항목별 원본은 설계 목차의 책임 구분을 따릅니다. 다른 문서에는 요약과 링크를 두고 상세 규칙을 중복 작성하지 않습니다.
- 요구사항·계약·설계 결정이 변경되면 관련 현재 설계를 먼저 갱신하고, 같은 작업에서 `docs/changes/NNNN-topic.md`에 변경 전후·이유·영향 문서·검증 결과를 기록합니다.
- 제안을 추가하거나 확정한 경우 그 상태를 기록합니다. 사용자 요구와 에이전트 제안을 구분하며 미정인 내용을 확정으로 승격하지 않습니다.
- 변경 기록은 과거 시점의 기록으로 보존합니다. 정정·대체가 필요하면 새 기록을 작성하고 기존 기록에는 후속 링크를 추가합니다.
- 오탈자·서식·깨진 링크만 수정한 경우 별도 변경 기록은 생략할 수 있습니다.
- 문서 추가·이동 시 해당 목차와 참조 링크를 갱신합니다. 완료 전 영향받은 요구사항·아키텍처·상세 설계·검증 기준의 일관성과 링크를 확인합니다.
- 이 규칙은 저장소 개발 문서에 적용합니다. 제품이 관리하는 프로젝트 문서 카탈로그와는 별개입니다.

## 프로젝트 작업

- 구현과 검증을 진행합니다. 기술·코드 작성 원칙의 원본은 `docs/design/00-principles.md`, 실행 기본값과 코드 연결은 `docs/design/09-implementation.md`입니다.
- 이 패키지는 기존 pnpm workspace와 루트 lockfile을 공유합니다.
- 패키지 대상 명령은 저장소 루트에서 `pnpm --filter planner-mcp <command>`로 실행합니다.
- 검증은 `pnpm --filter planner-mcp test`, `lint`, `typecheck`, `test:e2e`를 사용합니다. `test:e2e`는 생산 빌드 후 소유한 서버와 임시 데이터 디렉터리를 사용하고 종료 시 정리합니다.
- `src/app`은 Next 라우팅·서버 조합, `widgets`는 화면 조합, `features/flow-spec-syntax`는 순수 Flow 로직과 viewer, `entities/document`는 문서 스키마·타입별 보기, `shared`는 공통 경계입니다.
- 로컬 기본 데이터 `.data/`와 테스트 결과는 커밋하지 않습니다. 다른 개발 서버나 사용자의 데이터 디렉터리로 E2E를 실행하지 않습니다.
- 문서 관계·Flow 편집·Figma 수집의 추가 계약은 `docs/design/10-completion.md`를 따릅니다. Figma 토큰은 서버 환경변수로만 관리하며 테스트에서는 전용 서버 preload fixture로 외부 API를 대체합니다. 사용자 인증은 범위에서 제외합니다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
