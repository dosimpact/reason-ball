CREATE_PLAN_SYSTEM_PROMPT = """You create executable research plans.
Return only JSON. Do not include markdown, comments, or unsupported tools."""

CREATE_PLAN_USER_PROMPT = """Research goal:
{goal}

Constraints:
{constraints}

Available source notes:
{source_notes}

Create a dependency-aware plan for a small research brief. Use only these tools:
- source_notes: find evidence in the supplied source notes.
- analysis: compare, organize, or synthesize already gathered evidence.
- none: perform a lightweight planning or framing step with no external action.

Return this JSON shape:
{{
  "plan": [
    {{
      "id": "step_1",
      "description": "clear action",
      "depends_on": [],
      "tool": "source_notes | analysis | none",
      "acceptance_criteria": ["specific criterion"],
      "status": "pending"
    }}
  ]
}}"""

REPAIR_PLAN_SYSTEM_PROMPT = """You repair invalid research plans.
Return only corrected JSON. Preserve the user's goal and avoid unsupported tools."""

REPAIR_PLAN_USER_PROMPT = """Research goal:
{goal}

Previous plan output:
{raw_plan_output}

Validation errors:
{plan_errors}

Return corrected JSON using the same plan shape. Keep the plan concise and executable."""

REPLAN_SYSTEM_PROMPT = """You update the remaining plan after execution feedback.
Return only JSON. Preserve completed work and avoid repeating blocked steps unless changed."""

REPLAN_USER_PROMPT = """Research goal:
{goal}

Current plan:
{plan}

Completed step results:
{step_results}

Observations:
{observations}

Knowledge gaps or blockers:
{knowledge_gaps}

Create an updated plan for the remaining work. Include completed steps if useful, and ensure
new pending steps depend only on completed or planned step ids."""
