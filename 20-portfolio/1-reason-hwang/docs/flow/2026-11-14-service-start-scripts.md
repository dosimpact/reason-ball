# 2026-11-14 Service start scripts

- Scope: tech-shared / workspace; START-SERVICES-001.
- Context: User requested one start command for three services and three individual start commands.
- Change: Root `start` selects `@reason-hwang/fe-host`, `@reason-hwang/bff-apps`, and `@reason-hwang/langgraph-fast-api`. Added `start:fe-host`, `start:bff-apps`, and `start:langgraph-fast-api`, each selecting only its service. Existing package start behavior is retained; build prerequisites and infrastructure must already be prepared.
- Stock synchronized: [Workspace command table](../stock/tech-shared/workspace.md#root-commands).
- Validation: Executed all four script definitions through Turbo dry run and asserted exact task package sets and nonempty start commands: 4 PASS. Scoped `git diff --check`: PASS. Runtime service startup was not performed. No API, View, or business behavior changed; corresponding runtime gates do not apply.
- Cleanup: No servers, browsers, or temporary files created. Existing user changes and running services preserved.
