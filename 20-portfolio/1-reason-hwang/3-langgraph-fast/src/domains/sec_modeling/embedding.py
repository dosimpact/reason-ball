import os

from openai import OpenAI

MODEL = "text-embedding-3-small"
DIMENSIONS = 1536


def embedding_credentials():
    key = os.getenv("SEC_EMBEDDING_API_KEY") or os.getenv("OPENAI_API_KEY", "")
    if not key.startswith("sk-"):
        raise ValueError(
            "SEC_EMBEDDING_API_KEY requires an OpenAI embedding credential"
        )
    return key, os.getenv("SEC_EMBEDDING_BASE_URL", "https://api.openai.com/v1")


def embed(texts):
    key, base = embedding_credentials()
    with OpenAI(api_key=key, base_url=base, timeout=90) as client:
        results = client.embeddings.create(
            model=MODEL, input=texts, dimensions=DIMENSIONS
        )
    vectors = [row.embedding for row in sorted(results.data, key=lambda r: r.index)]
    if len(vectors) != len(texts) or any(len(v) != DIMENSIONS for v in vectors):
        raise ValueError("Embedding response dimension/count mismatch")
    return vectors
