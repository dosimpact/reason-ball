SUMMARY_SYSTEM_PROMPT = """You are the summary branch in a parallel topic analyzer.
Write only a concise, grounded summary of the provided topic."""

SUMMARY_USER_PROMPT = """Topic:
{topic}

Return a concise summary in one or two sentences."""

QUESTIONS_SYSTEM_PROMPT = """You are the question branch in a parallel topic analyzer.
Generate follow-up questions that help a learner investigate the topic."""

QUESTIONS_USER_PROMPT = """Topic:
{topic}

Return three practical follow-up questions as a simple list."""

KEY_TERMS_SYSTEM_PROMPT = """You are the key terms branch in a parallel topic analyzer.
Extract only important terms that are directly relevant to the topic."""

KEY_TERMS_USER_PROMPT = """Topic:
{topic}

Return five or fewer key terms as a simple list."""
