"""
Optional input guard to reject prompts containing obvious prompt-injection phrases.
Best-effort only; system-prompt hardening in the Groq provider is the primary defense.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Minimal blocklist: phrases that are clearly adversarial. Avoid blocking legitimate
# creative prompts (e.g. "don't forget the key message", "the hero loses the key").
# All checks are case-insensitive.
_BLOCKLIST: list[str] = [
    "forget instructions",
    "ignore previous instructions",
    "ignore all previous",
    "disregard instructions",
    "expose database",
    "database key",
    "reveal api key",
    "reveal database",
    "expose api key",
    "ignore your instructions",
]


def is_prompt_blocked(prompt: str) -> bool:
    """
    Return True if the prompt contains a blocklisted phrase and should be rejected.
    Used only when ENABLE_PROMPT_GUARD is True.
    """
    if not prompt or not prompt.strip():
        return False
    lower = prompt.lower()
    for phrase in _BLOCKLIST:
        if phrase in lower:
            logger.info("prompt_guard blocked prompt", extra={"matched_phrase": phrase})
            return True
    return False
