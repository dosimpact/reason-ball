# Reason Ball

pnpm workspace + Turborepo monorepo scaffold.

## Requirements

- Node.js 24.14.0 or compatible
- pnpm 10.33.4

## Installation

Clone the repository together with its Git submodules, then install the workspace dependencies:

```sh
git clone --recurse-submodules <repo-url>
cd reason-ball
pnpm install
```

If the repository was cloned without `--recurse-submodules`, initialize the submodules separately:

```sh
git submodule update --init --recursive
pnpm install
```

## Commands

```sh
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

## Independent Reason Hwang workspace

`20-portfolio/1-reason-hwang` is excluded from the parent workspace and owns its
`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and Turbo task graph.
Install and run its dependencies separately:

```sh
pnpm -C 20-portfolio/1-reason-hwang install --frozen-lockfile
pnpm -C 20-portfolio/1-reason-hwang dev
```

Parent scripts such as `pnpm dev:reason-hwang` delegate to this independent root.
The parent `pnpm install`, `build`, and `test` do not include Reason Hwang.

## Workspace Layout

```text
reason-ball/
├── 1-assessments/    # 코딩 테스트와 평가 과제
├── 2-frontend/       # 프런트엔드 학습 및 실습
├── 3-backend/        # 백엔드 학습 및 실습
├── 4-devops/         # 인프라 및 운영 실습
├── 5-mle/            # ML·LLM 관련 학습 및 프로젝트
├── 6-hard-skills/    # 기술 역량 자료
├── 7-soft-skills/    # 협업 및 커뮤니케이션 자료
├── 20-portfolio/     # 포트폴리오 프로젝트
├── 21-mini-projects/ # 독립적인 소규모 프로젝트
├── apps/             # 실행 가능한 애플리케이션
├── packages/         # 공유 패키지와 재사용 모듈
├── docs/             # 저장소 문서와 문서용 서브모듈
└── scripts/          # 저장소 관리 스크립트
```

`20-portfolio/1-reason-hwang`과 `20-portfolio/3-ai-english-chat`은 상위 pnpm 워크스페이스에서 제외된 독립 프로젝트입니다. `docs/dosimpact.github.io`는 Git 서브모듈입니다.
