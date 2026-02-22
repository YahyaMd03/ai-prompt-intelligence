from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

import requests

from app.domain.errors import ProviderError

logger = logging.getLogger(__name__)
from app.domain.models import Category, Platform, PromptOptions, Size


class GroqProvider(ABC):
    @abstractmethod
    def extract_options(self, prompt: str) -> tuple[PromptOptions, dict | None]:
        raise NotImplementedError

    @abstractmethod
    def enhance_prompt(self, prompt: str, options: PromptOptions) -> tuple[str, dict | None]:
        raise NotImplementedError

    @abstractmethod
    def generate_script(self, prompt: str, options: PromptOptions | None = None) -> tuple[str, dict | None]:
        raise NotImplementedError

    @property
    @abstractmethod
    def provider_name(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def model_name(self) -> str:
        raise NotImplementedError

    def get_last_usage(self) -> dict | None:
        """Return token usage from the last API call, if available. Default: None."""
        return None


def _coerce_options(data: dict[str, Any]) -> PromptOptions:
    platform = data.get("platform")
    size = data.get("size")
    category = data.get("category")
    return PromptOptions(
        duration_seconds=data.get("duration_seconds"),
        language=data.get("language"),
        platform=Platform(platform) if platform in Platform._value2member_map_ else None,
        size=Size(size) if size in Size._value2member_map_ else None,
        category=Category(category) if category in Category._value2member_map_ else None,
    )


class GroqLiveProvider(GroqProvider):
    def __init__(self, api_key: str, model_name: str, timeout_seconds: int = 20):
        self._api_key = api_key
        self._model_name = model_name
        self._timeout = timeout_seconds
        self._url = "https://api.groq.com/openai/v1/chat/completions"
        self._last_usage: dict | None = None

    @property
    def provider_name(self) -> str:
        return "groq-live"

    @property
    def model_name(self) -> str:
        return self._model_name

    def _chat(self, system_prompt: str, user_prompt: str) -> tuple[str, dict | None]:
        """Call Groq chat completions. Returns (content, usage). usage may be None if not in response."""
        if not self._api_key:
            raise ProviderError("Missing GROQ_API_KEY for live provider")
        payload = {
            "model": self._model_name,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        logger.info(
            "groq request",
            extra={
                "groq_model": self._model_name,
                "groq_system_prompt": system_prompt,
                "groq_user_prompt": user_prompt,
            },
        )
        response = requests.post(
            self._url,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=self._timeout,
        )
        if response.status_code >= 400:
            logger.warning(
                "groq error response",
                extra={
                    "groq_status_code": response.status_code,
                    "groq_response_text": response.text,
                },
            )
            raise ProviderError(f"Groq API error: {response.status_code} {response.text}")
        body = response.json()
        try:
            content = body["choices"][0]["message"]["content"]
            usage = body.get("usage")
            self._last_usage = usage
            logger.info(
                "groq response",
                extra={
                    "groq_content": content,
                    "groq_usage": usage,
                },
            )
            return content, usage
        except (KeyError, IndexError, TypeError) as exc:
            logger.warning(
                "groq invalid response structure",
                extra={"groq_body_keys": list(body.keys()) if isinstance(body, dict) else None},
            )
            raise ProviderError("Invalid Groq response structure") from exc

    def get_last_usage(self) -> dict | None:
        return self._last_usage

    def extract_options(self, prompt: str) -> tuple[PromptOptions, dict | None]:
        system = (
            "Extract video options from the user prompt into a strict JSON object. "
            "Keys: duration_seconds (int), language (string or null), platform (string or null), size (string or null), category (string or null). "
            "Rules: "
            "duration_seconds: convert to seconds (e.g. '1 minute' or '1-min' -> 60, '30 seconds' -> 30, '2 min' -> 120). "
            "platform: map explicitly: 'Instagram', 'Instagram Reels', 'Reels' -> instagram; 'YouTube' -> youtube; 'TikTok' -> tiktok; 'Facebook' -> facebook; else generic. "
            "size: 'square'/'square format' -> square; 'vertical'/'portrait' -> vertical; 'landscape' -> landscape. "
            "category: 'marketing'/'marketing tone' -> marketing; 'kids' -> kids; 'education'/'educational' -> education; 'storytelling' -> storytelling; else generic. "
            "language: infer from prompt (e.g. 'in English' -> 'english') or null. "
            "Allowed values only: platform=youtube|instagram|tiktok|facebook|generic; size=landscape|vertical|square; category=kids|education|marketing|storytelling|generic. "
            "Return only the JSON object, no markdown or explanation."
        )
        output, usage = self._chat(system, prompt)
        payload = _extract_json(output)
        return _coerce_options(payload), usage

    def enhance_prompt(self, prompt: str, options: PromptOptions) -> tuple[str, dict | None]:
        options_json = json.dumps(
            {
                "duration_seconds": options.duration_seconds,
                "language": options.language,
                "platform": options.platform.value if options.platform else None,
                "size": options.size.value if options.size else None,
                "category": options.category.value if options.category else None,
            }
        )
        system = (
            "Rewrite the prompt into a production-ready AI video generation brief. "
            "Keep constraints explicit, concise, and practical. Return plain text only."
        )
        user = f"Original prompt:\n{prompt}\n\nResolved options JSON:\n{options_json}"
        content, usage = self._chat(system, user)
        return content.strip(), usage

    def generate_script(self, prompt: str, options: PromptOptions | None = None) -> tuple[str, dict | None]:
        system = (
            "Generate a cinematic scene-by-scene video script. "
            "Include for each scene: visual direction, narration, mood, camera/shot cues, and transition."
        )
        if options:
            opts = (
                f"Duration: {options.duration_seconds or 'unspecified'}s. "
                f"Platform: {options.platform.value if options.platform else 'unspecified'}. "
                f"Size: {options.size.value if options.size else 'unspecified'}. "
                f"Category: {options.category.value if options.category else 'unspecified'}. "
                f"Language: {options.language or 'unspecified'}."
            )
            user = f"Constraints:\n{opts}\n\nPrompt:\n{prompt}"
        else:
            user = prompt
        content, usage = self._chat(system, user)
        return content.strip(), usage


def _extract_json(text: str) -> dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ProviderError("Provider did not return JSON")
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ProviderError("Could not parse provider JSON response") from exc
