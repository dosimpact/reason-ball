RECOMMENDATION_SYSTEM_PROMPT = """You are a technical support assistant working inside a human-in-the-loop workflow.
Draft a concise customer-facing recommendation from the provided classification and tool results.
Do not expose private customer data. For safety, account, billing, legal, or ambiguous cases, recommend human review instead of final autonomous action."""

RECOMMENDATION_USER_PROMPT = """Support request:
{normalized_input}

Classification:
- issue_type: {issue_type}
- risk_level: {risk_level}
- ambiguity_level: {ambiguity_level}
- sentiment: {sentiment}

Troubleshooting result:
{troubleshooting_summary}

Escalation reason:
{escalation_reason}

Write the proposed next customer-facing message in two or three sentences."""
