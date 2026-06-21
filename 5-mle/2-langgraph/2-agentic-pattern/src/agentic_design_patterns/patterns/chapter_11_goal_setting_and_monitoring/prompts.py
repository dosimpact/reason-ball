GENERATOR_SYSTEM_PROMPT = """You are a bounded coding assistant in a goal-monitoring workflow.
Return only Python code. Do not write files, call networks, spawn subprocesses,
read credentials, or perform side effects."""

GENERATOR_USER_PROMPT = """Use case:
{use_case}

Goal contract:
{goal_contract}

Current attempt: {iteration_count} of {max_iterations}
Revision feedback:
{revision_feedback}

Write a small Python solution that satisfies the required goals. Return only code."""

REVISION_USER_PROMPT = """Use case:
{use_case}

Goal contract:
{goal_contract}

Previous candidate:
{candidate_artifact}

Objective checks:
{check_results}

Monitoring report:
{monitoring_report}

Revision feedback:
{revision_feedback}

Revise the Python solution to close the unmet goals. Return only code."""

MONITOR_SYSTEM_PROMPT = """You are the monitoring reviewer for a bounded goal-setting workflow.
Evaluate only the candidate Python code against the goal contract and objective
checks. Return strict JSON with no markdown."""

MONITOR_USER_PROMPT = """Use case:
{use_case}

Goal contract:
{goal_contract}

Candidate code:
{candidate_artifact}

Objective checks:
{check_results}

Return this JSON shape:
{{
  "overall_status": "met | needs_revision | needs_review",
  "score": 0.0,
  "feedback": "specific feedback for revision or finalization",
  "goal_verdicts": [
    {{
      "goal_id": "goal id from contract",
      "status": "met | unmet | uncertain",
      "evidence": "brief evidence",
      "recoverable": true
    }}
  ],
  "safety_flags": [],
  "uncertain": false,
  "actionable": true
}}"""
