"""OAuth proxy supports reasoning models without a temperature parameter."""

import os

from llama_index.llms.openai_like import OpenAILike


def extraction_api_key():
    """Never forward the independent public embedding credential to the proxy."""
    return os.getenv("SEC_EXTRACTION_API_KEY", "oauth")

class OAuthExtractionLLM(OpenAILike):
    def _get_model_kwargs(self, **kwargs):
        params = super()._get_model_kwargs(**kwargs)
        params.pop("temperature", None)
        params["reasoning_effort"] = "low"
        return params

    def to_json(self, **kwargs):
        # Toolkit wraps exceptions with model config; never serialize credentials.
        return (
            '{"provider":"oauth-proxy","reasoning_effort":"low","version":"sec-extraction/2","max_tokens":12000,"model":"'
            + self.model
            + '"}'
        )
