# 2026-10-06: GitHub-inspired shared interface

Requirement: UI-GH-01.

## Context and decision

The user requested a GitHub design system update for the application at `http://localhost:2805/`, implemented by a Sol subagent. The existing app used mint/teal surfaces, a wide sidebar, and larger controls. The accepted direction is a compact GitHub Primer-inspired light interface with neutral surfaces and repository-style hierarchy.

Reference: [Primer product getting started](https://primer.style/product/getting-started/). This uses Primer conventions through local CSS; it does not add the Primer React library.

## Change and rationale

- Added a repository header, truthful catalog count, SDK documentation link, and category context.
- Restyled grouped navigation, active selection, system typography, buttons, fields, panels, and semantic palette tokens. Added explicit focus styles and `aria-current` for accessibility.
- Retained existing active-example/group/mobile-menu state and backend contracts. Added an initial SDK response empty state to explain the next interaction.
- Created canonical business/system stock documents because none existed in this project's documentation area. The existing detailed example plans and learning roadmap remain the catalog's sources.
- During implementation, an automated CSS consolidation matched selector suffixes within grouped rules. The stylesheet was rebuilt from the clean HEAD with semantic palette substitutions, and only complete shared selector blocks were merged. Form/button grouping and unrelated layout rules were restored before browser verification.

Affected stock sections: business design UI-GH-01; system design styling ownership and runtime boundaries.

## Validation and follow-up

- Final scoped `pnpm --filter langgraph-sdk-examples lint` and `pnpm --filter langgraph-sdk-examples build` passed after the CSS repair. `git diff --check` passed.
- Production bundling reports the existing large-chunk warning for the broad example/CopilotKit bundle; bundle optimization is outside this visual change.
- Playwright MCP desktop (1280/1440 px) and mobile (390 px) visual/navigation checks passed: group toggles, SDK/chat/artifact/CopilotKit selection, mobile menu auto-close, representative overflow checks, and visible keyboard focus. See `progress/e2e-progress.md`; local screenshots are `.playwright-mcp/github-desktop.png` and `.playwright-mcp/github-mobile.png`.
- Visual review caught and corrected a self-referential surface token, restoring white action text and the repository icon. Final production build passed after this correction.
- CopilotKit runtime info returns HTTP 502; only its frontend shell was verified. The initial favicon 404 predates this work. No runtime/provider success is claimed.
- The original frontend listener disappeared during verification. After confirming port 2805 was free, the parent started this package with `pnpm dev` and left it running for review.
- The optional assistant-loading check observed `http://localhost:2931/assistants/search` connection refused. No graph server was started or reconfigured for this UI request, so live graph/provider behavior is not verified by this change.
