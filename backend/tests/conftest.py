"""Pytest fixtures for backend tests."""
import re
import uuid
from typing import Any

import pytest

from app.config import get_settings
from app.domain.models import Category, Platform, PromptOptions, RunStatus, Size
from app.factory import create_app
from app.infrastructure.groq_provider import GroqLiveProvider, GroqProvider
from app.infrastructure.repository import PromptRepository


class FakeGroqProvider(GroqProvider):
    """Deterministic fake for tests only. Does not call Groq API."""

    @property
    def provider_name(self) -> str:
        return "groq-fake"

    @property
    def model_name(self) -> str:
        return "fake-v1"

    def extract_options(self, prompt: str) -> tuple[PromptOptions, dict | None]:
        lowered = prompt.lower()
        duration = None
        if "minute" in lowered or " min " in lowered or "min " in lowered:
            m = re.search(r"(\d+)\s*min(?:ute)?s?", lowered)
            if m:
                duration = int(m.group(1)) * 60
        if duration is None:
            m = re.search(r"(\d+)\s*(?:second|sec)s?", lowered)
            if m:
                duration = int(m.group(1))
        platform = "instagram" if "instagram" in lowered or "reels" in lowered else (
            "youtube" if "youtube" in lowered else (
            "tiktok" if "tiktok" in lowered else (
            "facebook" if "facebook" in lowered else "generic")))
        size = "square" if "square" in lowered else ("vertical" if "vertical" in lowered or "portrait" in lowered else "landscape")
        category = "marketing" if "marketing" in lowered else (
            "kids" if "kids" in lowered else (
            "education" if "education" in lowered or "educational" in lowered else (
            "storytelling" if "storytelling" in lowered else "generic")))
        language = "english" if "english" in lowered else None
        options = PromptOptions(
            duration_seconds=duration,
            language=language,
            platform=Platform(platform),
            size=Size(size),
            category=Category(category),
        )
        return options, {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}

    def enhance_prompt(self, prompt: str, options: PromptOptions) -> tuple[str, dict | None]:
        text = (
            f"{prompt}\n\n"
            "Production Constraints:\n"
            f"- Duration: {options.duration_seconds or 'unspecified'} seconds\n"
            f"- Language: {options.language or 'unspecified'}\n"
            f"- Platform: {options.platform.value if options.platform else 'unspecified'}\n"
            f"- Frame Size: {options.size.value if options.size else 'unspecified'}\n"
            f"- Category: {options.category.value if options.category else 'unspecified'}\n"
            "- Tone: cinematic, emotionally resonant, clear educational value."
        )
        return text, {"prompt_tokens": 15, "completion_tokens": 25, "total_tokens": 40}

    def generate_script(self, prompt: str, options: PromptOptions | None = None) -> tuple[str, dict | None]:
        opts = ""
        if options:
            opts = f" (Duration: {options.duration_seconds or '?'}s, Platform: {options.platform.value if options.platform else '?'}, Category: {options.category.value if options.category else '?'})"
        script = (
            "Scene 1:\n"
            "Visuals: Sunrise over a school hallway, playful color palette.\n"
            "Narration: \"Clean hands, bright day!\"\n"
            "Mood: Warm and hopeful.\n"
            "Cinematic: Slow dolly-in, soft lens flare, upbeat music swell.\n\n"
            "Scene 2:\n"
            "Visuals: Kids wash hands step-by-step with bubbly close-ups.\n"
            "Narration: \"Soap, scrub, rinse - keep germs away.\"\n"
            "Mood: Energetic and empowering.\n"
            "Cinematic: Macro inserts, rhythmic cut pattern, whoosh transition.\n\n"
            f"Prompt basis: {prompt}{opts}"
        )
        return script, {"prompt_tokens": 50, "completion_tokens": 100, "total_tokens": 150}


class InMemoryRepository:
    """In-memory implementation of repository interface for tests."""

    def __init__(self) -> None:
        self._runs: dict[uuid.UUID, dict[str, Any]] = {}
        self._options: dict[uuid.UUID, dict[str, Any]] = {}
        self._scripts: list[dict[str, Any]] = []

    def ensure_session(self, session_id: uuid.UUID) -> None:
        pass

    def create_run(self, prompt: str, session_id: uuid.UUID | None = None) -> uuid.UUID:
        run_id = uuid.uuid4()
        self._runs[run_id] = {
            "original_prompt": prompt,
            "current_prompt": prompt,
            "status": RunStatus.CREATED,
        }
        self._options[run_id] = {}
        return run_id

    def update_options(self, run_id: uuid.UUID, options: PromptOptions, source: str = "extract") -> None:
        self._options[run_id] = {
            "duration_seconds": options.duration_seconds,
            "language": options.language,
            "platform": options.platform.value if options.platform else None,
            "size": options.size.value if options.size else None,
            "category": options.category.value if options.category else None,
        }
        self._runs[run_id]["status"] = RunStatus.EXTRACTED

    def update_current_prompt(self, run_id: uuid.UUID, prompt: str, status: RunStatus) -> None:
        self._runs[run_id]["current_prompt"] = prompt
        self._runs[run_id]["status"] = status

    def insert_script(
        self, run_id: uuid.UUID, script_text: str, provider: str, model: str
    ) -> uuid.UUID:
        script_id = uuid.uuid4()
        self._scripts.append(
            {"id": script_id, "run_id": run_id, "script_text": script_text, "provider": provider, "model": model}
        )
        return script_id

    def log_event(
        self,
        run_id: uuid.UUID | None,
        event_type: str,
        payload: dict,
        session_id: uuid.UUID | None = None,
    ) -> None:
        pass

    def log_error(
        self,
        level: str,
        message: str,
        *,
        run_id: uuid.UUID | None = None,
        session_id: uuid.UUID | None = None,
        error_code: str | None = None,
        details: str | None = None,
        request_id: str | None = None,
        path: str | None = None,
    ) -> None:
        pass

    def get_run(self, run_id: uuid.UUID) -> dict | None:
        if run_id not in self._runs:
            return None
        r = self._runs[run_id]
        o = self._options.get(run_id, {})
        latest = next(
            (s["script_text"] for s in reversed(self._scripts) if s["run_id"] == run_id),
            None,
        )
        return {
            "run_id": run_id,
            "original_prompt": r["original_prompt"],
            "current_prompt": r["current_prompt"],
            "status": r["status"].value,
            "options": o,
            "latest_script": latest,
        }

    def list_runs(self, limit: int = 20) -> list[dict]:
        return []


@pytest.fixture
def in_memory_repo() -> InMemoryRepository:
    return InMemoryRepository()


@pytest.fixture
def fake_provider() -> FakeGroqProvider:
    """Deterministic fake for tests that need no API key or stable responses."""
    return FakeGroqProvider()


@pytest.fixture
def provider():
    """Use real Groq API when GROQ_API_KEY is set, otherwise fake (e.g. CI)."""
    settings = get_settings()
    if settings.groq_api_key and settings.groq_api_key.strip():
        return GroqLiveProvider(
            api_key=settings.groq_api_key,
            model_name=settings.groq_model,
            timeout_seconds=settings.groq_timeout_seconds,
        )
    return FakeGroqProvider()


@pytest.fixture
def app(in_memory_repo: InMemoryRepository, provider: GroqProvider):
    return create_app(repository=in_memory_repo, provider=provider)


@pytest.fixture
def client(app):
    return app.test_client()
