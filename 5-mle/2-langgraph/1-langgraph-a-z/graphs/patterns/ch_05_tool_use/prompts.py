TOOL_DECISION_SYSTEM_PROMPT = """You are a tool-use controller.
Return only JSON. Choose either a direct answer or one registered tool call."""

TOOL_DECISION_USER_PROMPT = """User request:
{normalized_input}

Available tools:
{tool_definitions}

Prior successful tool observations:
{tool_results}

Prior tool or validation errors:
{tool_errors}

Tool calls used: {tool_call_count} of {max_tool_calls}

Return one of these JSON shapes:
{{
  "action": "answer",
  "answer": "grounded final response"
}}

or

{{
  "action": "tool_call",
  "tool_call": {{
    "name": "registered_tool_name",
    "arguments": {{
      "required_argument": "value"
    }}
  }}
}}"""
