"""voyage-multilingual-2 embeddings for Nepali + English topic chunks."""

import os
from typing import Optional

import voyageai

_client: Optional[voyageai.Client] = None

EMBED_MODEL = "voyage-multilingual-2"
BATCH_SIZE = 32  # Voyage API limit per request


def _get_client() -> voyageai.Client:
    global _client
    if _client is None:
        _client = voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])
    return _client


async def embed_text(text: str) -> list[float]:
    """Embed a single text string. Returns a 1024-dim float vector."""
    client = _get_client()
    result = client.embed([text], model=EMBED_MODEL)
    return result.embeddings[0]


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Embed multiple texts, batching automatically to stay within API limits.
    Returns embeddings in the same order as the input.
    """
    client = _get_client()
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        result = client.embed(batch, model=EMBED_MODEL)
        all_embeddings.extend(result.embeddings)

    return all_embeddings
