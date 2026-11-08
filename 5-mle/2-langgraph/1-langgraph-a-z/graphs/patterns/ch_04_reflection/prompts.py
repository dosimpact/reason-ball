DEFAULT_FACTORIAL_TASK = """Write a Python function calculate_factorial(n).
The function should accept an integer and return n!. Include a docstring,
return 1 for n == 0, and raise ValueError for negative input."""

DEFAULT_FACTORIAL_REQUIREMENTS = [
    "Define a Python function named calculate_factorial that accepts n.",
    "Return the factorial value n! for non-negative integers.",
    "Return 1 when n == 0.",
    "Raise ValueError for negative input.",
    "Include a useful docstring.",
]

PRODUCER_SYSTEM_PROMPT = """You are the Producer in a reflection workflow.
Write concise, runnable Python code that satisfies the user's task and review
requirements. Return only the Python code."""

INITIAL_DRAFT_USER_PROMPT = """Task:
{task}

Requirements:
{requirements}

Create the first draft of the Python function. Return only code."""

REVISION_USER_PROMPT = """Task:
{task}

Requirements:
{requirements}

Current draft:
{current_draft}

Latest critique:
{critique}

Revision history:
{revision_history}

Revise the function to address the critique. Return only code."""

CRITIC_SYSTEM_PROMPT = """You are the Critic in a reflection workflow.
Review Python code as a senior Python engineer. Check the code only against the
task and requirements. Return strict JSON with keys status and critique.

Use status "accepted" only when all requirements are met.
Use status "needs_revision" when the code needs changes.
The legacy sentinel CODE_IS_PERFECT is also allowed for accepted code."""

CRITIC_USER_PROMPT = """Task:
{task}

Requirements:
{requirements}

Draft under review:
{current_draft}

Static check results:
{static_check_results}

Return this exact JSON shape:
{{
  "status": "accepted or needs_revision",
  "critique": "specific review feedback"
}}"""
