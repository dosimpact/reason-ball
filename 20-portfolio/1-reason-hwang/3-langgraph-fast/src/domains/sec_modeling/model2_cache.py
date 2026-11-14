"""Reuse legacy raw outputs while keeping application metadata outside source inputs."""

import hashlib
from pathlib import Path

from graphrag_toolkit.lexical_graph.utils.llm_cache import LLMCache
from llama_index.core import PromptTemplate

from domains.sec_modeling.model2_policy import (
    PROPOSITIONS_PROMPT,
    TOPICS_PROMPT,
    extraction_policy_hash,
)


class LegacyValidatedPromptCache(LLMCache):
    """Only exact previous prompt variants qualify; downstream validation always runs."""

    def predict(self, prompt, **prompt_args):
        marker = "Policy: " + extraction_policy_hash()
        for semantic_prompt in (PROPOSITIONS_PROMPT, TOPICS_PROMPT):
            if prompt.template != marker + "\n" + semantic_prompt:
                continue
            legacy = PromptTemplate(semantic_prompt + "\n" + marker)
            args = prompt_args.copy()
            for key in prompt_args.get("exclude_cache_keys", []):
                args.pop(key, None)
            cache_key = f"{self.llm.to_json()},{legacy.format(**args)}"
            path = Path("cache/llm") / (
                hashlib.sha256(cache_key.encode()).hexdigest() + ".txt"
            )
            if self.enable_cache and path.is_file():
                raw = path.read_text()
                if semantic_prompt == TOPICS_PROMPT:
                    from graphrag_toolkit.lexical_graph.indexing.extract.topic_extractor import (
                        parse_extracted_topics,
                    )

                    from domains.sec_modeling.model2_topics import validated_collection

                    parsed, _ = parse_extracted_topics(raw)
                    propositions = [
                        value
                        for value in prompt_args.get("text", "").splitlines()
                        if value
                    ]
                    try:
                        validated_collection(parsed.model_dump(), propositions)
                    except ValueError:
                        # Invalid legacy output gets a fresh prefix prompt, never a
                        # relaxed acceptance of invented facts or missing source text.
                        continue
                elif marker.replace(":", "") in raw.replace(":", ""):
                    continue
                return raw
        return super().predict(prompt, **prompt_args)
