# @reason-ball/pgv-state-mcp

MCP server for `apb-pgv` Plan -> Gradate -> Validate state and document scaffolding.

## Usage

Build the server:

```bash
pnpm --filter @reason-ball/pgv-state-mcp build
```

Codex configuration:

```toml
[mcp.servers.pgv-state-mcp]
command = "node"
args = ["packages/pgv-state-mcp/dist/index.js"]
startup_timeout_sec = 10
tool_timeout_sec = 60
required = true
```

## Tools

| Tool | Description |
| --- | --- |
| `pgv_state_init` | Initialize `.apb-workspace/docs` and the PGV status file. |
| `pgv_state_get_status` | Read project or feature PGV status. |
| `pgv_state_pgv_plan` | Create `01-plan/{feature}.plan.md` and enter plan phase. |
| `pgv_state_pgv_gradate` | Create `02-gradate/{feature}.gradate.md` and enter gradate phase. |
| `pgv_state_pgv_validate` | Create `03-validate/{feature}.validate.md` and enter validate phase. |

State is stored in `.apb-workspace/docs/.apb-status.json`.
