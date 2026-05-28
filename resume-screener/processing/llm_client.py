"""Azure OpenAI wrapper with retry, fallback model, and token tracking."""

import json
import time
from openai import AzureOpenAI, RateLimitError, APIError
from config import (
    AZURE_OPENAI_KEY,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_MODEL_NAME,
    AZURE_OPENAI_FALLBACK_MODEL_NAME,
    AZURE_OPENAI_API_VERSION,
    MAX_RETRIES,
    RETRY_DELAY_SECONDS,
)
from utils.logger import get_logger, log_with_context

logger = get_logger(__name__)

_client = None


def _get_client() -> AzureOpenAI:
    """Lazy-initialize Azure OpenAI client."""
    global _client
    if _client is None:
        _client = AzureOpenAI(
            api_key=AZURE_OPENAI_KEY,
            api_version=AZURE_OPENAI_API_VERSION,
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
        )
    return _client


def call_llm(
    system_prompt: str,
    user_content: str,
    trace_id: str = "",
    stage: str = "llm_call",
) -> tuple[str, dict]:
    """Call Azure OpenAI with retry and fallback logic.
    
    Returns:
        tuple: (response_text, token_usage_dict)
        token_usage_dict has keys: prompt_tokens, completion_tokens, total_tokens
    
    Raises:
        Exception: If all retries fail on both primary and fallback models.
    """
    client = _get_client()
    models_to_try = [AZURE_OPENAI_MODEL_NAME]
    if AZURE_OPENAI_FALLBACK_MODEL_NAME:
        models_to_try.append(AZURE_OPENAI_FALLBACK_MODEL_NAME)

    last_error = None

    for model in models_to_try:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    temperature=0,
                )

                content = response.choices[0].message.content
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                }

                log_with_context(
                    logger, "INFO",
                    f"LLM call successful (model={model}, attempt={attempt})",
                    trace_id=trace_id, stage=stage, tokens_used=usage["total_tokens"],
                )
                return content, usage

            except (RateLimitError, APIError) as e:
                last_error = e
                log_with_context(
                    logger, "WARNING",
                    f"LLM call failed (model={model}, attempt={attempt}): {e}",
                    trace_id=trace_id, stage=stage,
                )
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY_SECONDS * attempt)

            except Exception as e:
                last_error = e
                log_with_context(
                    logger, "ERROR",
                    f"LLM unexpected error (model={model}, attempt={attempt}): {e}",
                    trace_id=trace_id, stage=stage,
                )
                break  # Don't retry on unexpected errors

    raise Exception(f"All LLM attempts failed. Last error: {last_error}")


def parse_llm_json(raw_response: str, trace_id: str = "") -> dict | None:
    """Safely parse JSON from LLM response, handling markdown fences.
    
    Returns None on failure (never crashes).
    """
    cleaned = raw_response.strip()
    # Remove markdown code fences if present
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first and last lines (fences)
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        log_with_context(
            logger, "ERROR",
            f"Failed to parse LLM JSON response: {e}",
            trace_id=trace_id, stage="json_parse",
        )
        return None
