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

## Workspace Layout

- `apps/*` for runnable applications
- `packages/*` for shared packages and libraries


## 디렉처리 구조 고민 

```


```
