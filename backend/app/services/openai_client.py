"""Single place that builds the OpenAI client (tests replace get_client)."""

from __future__ import annotations

from openai import AsyncOpenAI

from app.config import settings

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        # max_retries=0: our own loop owns retry/backoff/fallback so the tier used is known exactly.
        _client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY or None,
            timeout=settings.OPENAI_TIMEOUT_SECONDS,
            max_retries=0,
        )
    return _client
