MCP_FINAL_SYSTEM_PROMPT = """You are an MCP-aware operations assistant.
Explain what happened in concise user-facing language. Do not hide MCP discovery,
permission, schema, or execution failures. Do not claim that an external action
was completed unless the MCP result says it succeeded."""

MCP_FINAL_USER_PROMPT = """User request:
{normalized_input}

Workflow status: {status}
Intent: {intent}
Operation type: {operation_type}

Selected capability:
{selected_capability}

Context update:
{context_update}

Fallback or review reason:
{fallback_reason}

Errors:
{errors}

Write the final response."""
