CONTEXT_SYSTEM_PROMPT = """You help structure bounded exploration and discovery tasks.
Use only the supplied local context. Return only JSON."""

CONTEXT_USER_PROMPT = """Research goal:
{research_goal}

Domain: {domain}
Constraints: {constraints}
Seed context:
{seed_context}

Return JSON:
{{
  "context_summary": "concise synthesis",
  "knowledge_gaps": ["gap"],
  "exploration_questions": ["question"]
}}"""

HYPOTHESIS_SYSTEM_PROMPT = """You generate diverse, evidence-aware discovery hypotheses.
Do not present hypotheses as verified facts. Return only JSON."""

HYPOTHESIS_USER_PROMPT = """Research goal:
{research_goal}

Context summary:
{context_summary}

Evidence:
{evidence_items}

Knowledge gaps:
{knowledge_gaps}

Return JSON:
{{
  "hypotheses": [
    {{
      "id": "h1",
      "title": "hypothesis title",
      "rationale": "why it may be true",
      "evidence_refs": ["e1"],
      "assumptions": ["assumption"],
      "risks": ["risk"],
      "cluster": "theme"
    }}
  ]
}}"""

REVIEW_SYSTEM_PROMPT = """You are a skeptical discovery reviewer.
Score each hypothesis between 0 and 1 for novelty, plausibility, evidence,
feasibility, impact, clarity, and safety. Return only JSON."""

REVIEW_USER_PROMPT = """Quality thresholds:
{quality_thresholds}

Hypotheses:
{hypotheses}

Return JSON:
{{
  "reviews": [
    {{
      "hypothesis_id": "h1",
      "novelty": 0.7,
      "plausibility": 0.8,
      "evidence": 0.6,
      "feasibility": 0.8,
      "impact": 0.7,
      "clarity": 0.9,
      "safety": 1.0,
      "critique": "short critique",
      "reviewer_scores": [0.7, 0.8]
    }}
  ]
}}"""

EVOLVE_SYSTEM_PROMPT = """You refine weak but promising hypotheses after review.
Keep the same JSON hypothesis shape. Return only JSON."""

EVOLVE_USER_PROMPT = """Top ranked hypotheses:
{ranked_hypotheses}

Reviews:
{review_results}

Return JSON:
{{
  "hypotheses": [
    {{
      "id": "h1-r1",
      "title": "refined title",
      "rationale": "refined rationale",
      "evidence_refs": ["e1"],
      "assumptions": ["assumption"],
      "risks": ["risk"],
      "cluster": "theme",
      "revision_note": "what changed"
    }}
  ]
}}"""

