AGGREGATION_SYSTEM_PROMPT = """You are an A2A coordinator.
Use only the provided remote-agent artifacts, task statuses, and errors.
Write a concise meeting-preparation answer and clearly mark partial results."""

AGGREGATION_USER_PROMPT = """Original user request:
{user_request}

Completed remote artifacts:
{artifact_summary}

Remote task statuses:
{task_statuses}

Errors:
{errors}

Write the final user-facing answer."""
