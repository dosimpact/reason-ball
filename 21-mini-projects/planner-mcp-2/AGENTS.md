# Repository Guidelines

## Project Structure & Module Organization

This repository is a pnpm workspace managed with Turborepo. Keep the top-level layout predictable:

- `apps/` for runnable applications.
- `packages/` for shared packages and reusable modules.
- `assets/` for static files such as images, audio, sample data, or fixtures.
- `docs/` for design notes, architecture decisions, and user-facing documentation.
- `21-mini-projects/` for independent workspace mini projects. `todo-list-mcp` is a single Next.js UI/API/MCP application.

Avoid placing implementation files directly in the repository root unless they are standard project entry points or configuration files.

## Build, Test, and Development Commands

Use committed package scripts from the repository root:

- `pnpm install`: install workspace dependencies.
- `pnpm dev`: run development tasks through Turborepo.
- `pnpm build`: run production builds through Turborepo.
- `pnpm test`: run test tasks through Turborepo.
- `pnpm lint`: run lint tasks through Turborepo.
- `pnpm typecheck`: run type-check tasks through Turborepo.

Prefer scripts committed in the project manifest over one-off local commands.

For Todo MCP, use `pnpm --filter todo-list-mcp dev` and scoped `test`, `test:e2e`, `typecheck`, `lint`, and `build` scripts. E2E runs headless against an owned server and temporary JSON, then releases its port. Never reuse or terminate unrelated development servers. Keep its core transformations pure and follow SLAP; local runtime JSON is not committed.

## Coding Style & Naming Conventions

Use consistent, language-appropriate formatting once the stack is selected. Until formatter configuration exists, keep files readable with two-space indentation for web assets and four-space indentation for Python-style code. Use descriptive names:

- `camelCase` for JavaScript/TypeScript variables and functions.
- `PascalCase` for classes and components.
- `snake_case` for Python modules, functions, and variables.
- `kebab-case` for static asset filenames.

Add formatter and linter configs early, then treat their output as authoritative.

## Testing Guidelines

Place tests under `tests/` or next to source files using the convention selected by the framework. Name test files clearly, such as `feature.test.ts`, `module.spec.js`, or `test_module.py`. Cover core logic, public interfaces, and regression cases before adding broad end-to-end tests.

## Documentation: Stock and Flow

Maintain project documentation as two complementary systems:

- **Stock documents (저량 문서)** are the canonical, current-state source of truth. Keep one consolidated business design and one consolidated system/development design per project. They must describe the latest agreed product behavior and implemented architecture without requiring readers to reconstruct the present state from historical logs.
- **Flow documents (유량 문서)** are append-only, point-in-time change records. Record decisions, requirement changes, architecture changes, migrations, validation results, and important implementation notes as they occur. Include the date, context, change, rationale, affected stock sections, and validation or follow-up status.

Use the following operating rules:

1. Read the relevant stock documents before planning or implementing a material change.
2. During work, create or update a dated flow record so the change history and reasoning are preserved.
3. Before declaring the work complete, fold every accepted current-state change into the relevant stock documents. A flow record does not replace this synchronization.
4. When code, stock, and flow disagree, verify the implementation and accepted decision, then update the stock document to the confirmed current state and note the reconciliation in flow.
5. Link stock and flow documents using stable requirement or decision IDs when practical, and link validation evidence to the requirement it verifies.
6. Do not copy historical narrative into stock documents unless it is necessary to understand the current design. Do not rewrite or erase historical flow records; supersede them with a new dated entry.
7. Store stock documents in a predictable project documentation area such as `docs/stock/`. Store flow records in a dated history area such as `docs/flow/`.

For `20-portfolio/3-fsd-next-sample`, use `docs/stock/` for the consolidated business, system, and test designs and `docs/flow/` for dated progress, audit, decision, migration, and validation records. Start with `docs/README.md` for the document map.

## Commit & Pull Request Guidelines

Use concise, imperative commit subjects such as `Add game loop` or `Fix score reset`. Pull requests should include a short summary, test results, linked issues when applicable, and screenshots or recordings for visible UI changes.

## Agent-Specific Instructions

Before editing, inspect the repository state and avoid overwriting user-created files. Keep changes scoped to the requested task, and update this guide when project tooling or structure changes.


## Response Format (MANDATORY)

ALWAYS include at the end of each response:
- **Learning Points**: 3-5 key concepts the user should learn
- **Next Step**: Specific action with command/tool suggestion
- Use clear terms and avoid forcing responses into fixed project-type categories.


---

# Planner MCP 작업 규칙

## Phase — 변경 전 설계

- 계획·구현·검토 전에 [문서 맵](docs/INDEX.md)을 읽습니다. 공용 → 구체 순서로 [공통 기술 지도](docs/stock/tech-shared/INDEX.md), 관련 패키지 기술 문서, `docs/stock/<domain-feature-name>/`의 도메인 설계를 확인합니다.
- 코드 원칙·명령·포트·아키텍처·검증 정책은 맵이 연결하는 원본에 유지하고 이 문서에 중복하지 않습니다.
- 편집 전에 git status를 확인하고 사용자 파일과 관련 없는 변경을 보존합니다. `docs/human-input/`은 사용자 원문이며 임의로 덮어쓰지 않습니다.
- `.env`, 토큰, `.data/`, 빌드·테스트 출력·캐시는 커밋하지 않습니다.

## Phase — 구현

- 설계를 먼저 확정하고 구현합니다. [설계 원칙](docs/stock/tech-shared/design-principles.md)의 SLAP·순수함수·FSD 경계를 따릅니다.
- 기존 pnpm workspace와 루트 lockfile을 공유합니다. 저장소 루트에서 `pnpm --filter planner-mcp-2 <command>`를 실행합니다. 실행 기본값은 [패키지 구현 문서](docs/stock/tech-shared/planner-mcp-2/implementation.md)를 따릅니다.

## Phase — 검증

- [검증 원칙](docs/validation/INDEX.md)을 읽고 변경 유형별 필수 검증을 모두 수행합니다.
- 서버 API 변경은 Bruno 스킬 원칙의 실제 HTTP E2E, 순수 View 변경은 Storybook, 업무 로직 변경은 MCP 브라우저 사용자 흐름 검증을 수행합니다.
- 소유한 테스트 서버·임시 데이터만 사용하며 다른 개발 서버·사용자 데이터를 사용하거나 종료하지 않습니다.
- 실행 증거는 flow에 남기고 필수 검증 미실행·실패를 완료로 처리하지 않습니다.

## Phase — 문서화

- docs 하위 문서 지도·진입 파일은 INDEX.md, 프로젝트 루트 소개는 README.md로 유지합니다.
- 공용 결정은 `docs/stock/tech-shared/`, 패키지 상세는 그 아래 `planner-mcp-2/`, 업무 규칙은 `docs/stock/<domain-feature-name>/`에 둡니다.
- stock만으로 현재 상태를 이해할 수 있도록 합의된 요구·계약·구현을 동기화합니다. 사용자 요구와 구현 기본값·미정 제안을 구분합니다.
- 변경 맥락·이유·영향 stock·검증 결과는 날짜가 있는 `docs/flow/`에 기록합니다. 완료된 flow는 수정하지 않고 후속 기록으로 대체합니다. 사용자 요청으로 이력을 통합하는 경우 원문 복구 커밋·기록 대응표·검증 한계를 보존합니다.
- `docs/changes/`는 초기 기록의 통합 보관본입니다. 새 기록은 flow에 작성하며 이동·통합 시 목차와 참조를 갱신합니다.
- 이 문서 운영은 저장소 개발 문서에 대한 규칙이며 제품의 템플릿·프로젝트 문서 관리와 구분합니다.

## Phase — Commit

- 설계·구현·검증·문서화 사이클을 완료한 뒤 요청 범위의 파일만 커밋합니다. 관련 없는 변경은 포함하지 않습니다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Planner MCP 2 원본 보호

- `master-requirement.md`는 사용자 지시에 따라 수정하지 않습니다. 구현 기본값과 최소 설계·검증 증거는 docs/stock 및 docs/flow에 기록합니다.

## CodeWeave 모듈 경계

- `src/modules/codeweave/core`는 향후 npm으로 분리할 독립 모듈입니다. 앱은 공개 `index.ts`로 접근하며 core에 Next.js·React·DB·MCP SDK 의존성을 추가하지 않습니다. 문법·API·검증 명령은 [CodeWeave 설계](docs/stock/codeweave/INDEX.md)에 유지합니다.
