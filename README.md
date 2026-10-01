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

- `apps/*` for runnable applications
- `packages/*` for shared packages and libraries


## 디렉처리 구조 고민 

```


```
