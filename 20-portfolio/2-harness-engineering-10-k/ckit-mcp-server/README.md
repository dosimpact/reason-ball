# @popup-studio/ckit-mcp

MCP Server for ckit-codex -- PDCA methodology automation for OpenAI Codex.

## Installation

```bash
npm install @popup-studio/ckit-mcp
```

## Usage

Add to your MCP client configuration (e.g., `config.toml`):

```toml
[mcp.servers.ckit]
command = "npx"
args = ["-y", "@popup-studio/ckit-mcp"]
```

Or run directly:

```bash
npx @popup-studio/ckit-mcp
```

The server communicates via STDIO using JSON-RPC 2.0 (MCP protocol).

## Available Tools

| Tool | Description |
|------|-------------|
| `ckit_init` | Initialize ckit session with PDCA context |
| `ckit_get_status` | Get current PDCA status for project or feature |
| `ckit_pre_write_check` | Check PDCA compliance before writing code |
| `ckit_post_write` | Guidance after code changes with next steps |
| `ckit_complete_phase` | Mark a PDCA phase as complete |
| `ckit_pdca_plan` | Generate plan document template |
| `ckit_pdca_design` | Generate design document template |
| `ckit_pdca_analyze` | Analyze gaps between design and implementation |
| `ckit_pdca_next` | Get next PDCA phase recommendation |
| `ckit_analyze_prompt` | Analyze user prompt for intent and triggers |
| `ckit_select_template` | Select PDCA template for a phase |
| `ckit_memory_read` | Read from ckit session memory |
| `ckit_memory_write` | Write to ckit session memory |

## Development

```bash
# Run the server
node index.js

# Run tests
node --test tests/
```

## License

Apache-2.0
