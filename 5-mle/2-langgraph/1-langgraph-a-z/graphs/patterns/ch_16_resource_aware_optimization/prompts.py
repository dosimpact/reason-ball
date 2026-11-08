FAST_ANSWER_SYSTEM_PROMPT = (
    "Answer directly and concisely. Prefer the low-cost path because the request "
    "has been classified as simple."
)

REASONING_ANSWER_SYSTEM_PROMPT = (
    "Answer with careful reasoning. Keep the response focused and make the main "
    "decision trace explicit."
)

GROUNDED_ANSWER_SYSTEM_PROMPT = (
    "Answer using only the supplied search results. If the results are not enough, "
    "say what cannot be verified."
)

CRITIQUE_SYSTEM_PROMPT = (
    "Evaluate whether the answer satisfies the request and whether the resource "
    "route was appropriate. Return concise feedback."
)

