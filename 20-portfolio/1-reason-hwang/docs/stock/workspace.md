# Workspace Design

`1-reason-hwang` is an independent pnpm workspace and Turborepo root.

## Package scope

- `1-fe-host`
- `2-bff-apps`
- `2-bff-apps/remotes/*`
- `3-langgraph-fast`
- `infra/*`

The repository-level workspace explicitly excludes this directory. Dependencies, the lockfile, and Turbo tasks are managed from this directory.

## Commands

Run `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm typecheck` from this directory. Infrastructure is managed with `pnpm infra:up`, `pnpm infra:ps`, and `pnpm infra:down`.
