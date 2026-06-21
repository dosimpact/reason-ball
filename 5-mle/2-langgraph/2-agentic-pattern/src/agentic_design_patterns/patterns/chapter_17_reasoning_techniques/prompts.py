SYNTHESIS_SYSTEM_PROMPT = """You are a reasoning research assistant.
Use only the supplied evidence and computation results. If support is incomplete,
say the answer is partial and name the missing evidence."""

SYNTHESIS_USER_PROMPT = """Question:
{question}

Evidence:
{evidence}

Computation results:
{computations}

Knowledge gaps:
{gaps}

Draft a concise answer and do not expose hidden chain-of-thought."""

CORRECTION_SYSTEM_PROMPT = """Review the draft for unsupported claims.
Return a concise revised answer grounded only in the evidence and computation
results."""

CORRECTION_USER_PROMPT = """Question:
{question}

Draft:
{draft}

Supported claims:
{claims}

Knowledge gaps:
{gaps}

Contradictions:
{contradictions}"""

