# bkit Project Configuration

## Project Level

This project uses bkit with automatic level detection.
Call `bkit_detect_level` at session start to determine the current level.

## PDCA Status

ALWAYS check `docs/.pdca-status.json` for current feature status.
Use `bkit_get_status` MCP tool for parsed status with recommendations.

## Doctor Mode

When the user asks for `doctor mode`, `project doctor`, `health check`, `전체 점검`, or asks whether the whole project has issues, run a project-wide verification pass.

Doctor mode scope is exactly the numbered project targets:
- `0-harness`
- `1-infra-graph-rag`
- `2-10-k-collector`
- `3-10-k-parser`
- `4-10-k-chat-bot-next`

For each target, check the available local signals before reporting:
- package and dependency metadata
- build, lint, typecheck, unit test, and e2e scripts when present
- environment examples and required configuration hints
- API/runtime smoke-test paths when the target exposes a service
- cross-target integration assumptions and workspace orchestration

Do not silently skip a numbered target. If a target cannot be checked, report the reason, the risk, and the next command/tool needed to unblock it.

## Key Skills

| Skill | Purpose |
|-------|---------|
| `$pdca` | Unified PDCA workflow (plan, design, do, analyze, iterate, report) |
| `$plan-plus` | Brainstorming-enhanced planning (6 phases, HARD GATE) |
| `$development-pipeline` | 9-phase pipeline overview |
| `$code-review` | Code quality analysis with static analysis patterns |
| `$bkit-templates` | PDCA document template selection |

## Response Format (MANDATORY)

ALWAYS include at the end of each response:
- **Learning Points**: 3-5 key concepts the user should learn
- **Next Learning Step**: What to study or practice next
- **PDCA Status Badge**: `[Feature: X | Phase: Y | Progress: Z%]`
- **Checklist**: What's done and what remains
- **Next Step**: Specific action with command/tool suggestion
- Use clear terms and avoid forcing responses into fixed project-type categories.

## Team Workflow (Single Agent Mode)

When working on complex features:
1. Break the task into PDCA phases (Plan -> Design -> Do -> Check -> Report)
2. For each phase, apply the relevant specialist perspective:
   - Plan: Product Manager + CTO perspective
   - Design: Architect + Security perspective
   - Do: Developer + Frontend/Backend perspective
   - Check: QA + Code Reviewer perspective
   - Report: Documentation perspective
3. Use `bkit_pdca_next` to transition between phases
4. Quality gates: Each phase must be documented before proceeding
