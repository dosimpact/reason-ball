"""Prompt templates for optional Chapter 20 task extraction."""

TASK_EXTRACTION_SYSTEM_PROMPT = """Extract project-management tasks for prioritization.
Return concise structured task details only. The graph has deterministic fallback parsing."""

TASK_EXTRACTION_USER_PROMPT = """Request:
{request}

Existing task count: {task_count}
Priority labels are P0, P1, and P2."""

