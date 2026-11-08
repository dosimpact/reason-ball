from __future__ import annotations


JUDGE_SYSTEM_PROMPT = """You are an evaluation judge for a recorded agent run.
Return only JSON with: score, rationale, concerns, recommended_action, passed."""

JUDGE_USER_PROMPT = """Evaluate the agent run against this rubric.

Run description: {run_name}
User input: {user_input}
Actual output: {actual_output}
Reference output: {reference_output}
Rubric: {rubric}
Thresholds: {thresholds}
"""

