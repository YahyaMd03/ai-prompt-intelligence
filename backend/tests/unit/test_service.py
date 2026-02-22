"""Unit tests for PromptWorkflowService."""
import uuid

import pytest

from app.application.service import PromptWorkflowService
from app.domain.models import PromptOptions
from tests.conftest import FakeGroqProvider, InMemoryRepository


def test_extract_options_creates_run_and_returns_options():
    repo = InMemoryRepository()
    provider = FakeGroqProvider()
    service = PromptWorkflowService(repository=repo, provider=provider)
    prompt = "Create a 30 second kids educational video for YouTube in English, vertical format."
    run_id, options = service.extract_options(prompt)
    assert isinstance(run_id, uuid.UUID)
    assert options.duration_seconds == 30
    assert options.platform is not None
    run = repo.get_run(run_id)
    assert run is not None
    assert run["original_prompt"] == prompt
    assert run["status"] == "extracted"


def test_enhance_prompt_updates_run_and_returns_enhanced_text():
    repo = InMemoryRepository()
    run_id = repo.create_run("Original prompt.")
    repo.update_options(run_id, PromptOptions(duration_seconds=30, language="english"), source="extract")
    provider = FakeGroqProvider()
    service = PromptWorkflowService(repository=repo, provider=provider)
    enhanced = service.enhance_prompt(run_id, "Original prompt.", PromptOptions(duration_seconds=30, language="english"))
    assert "Original prompt" in enhanced
    run = repo.get_run(run_id)
    assert run["current_prompt"] == enhanced
    assert run["status"] == "enhanced"


def test_generate_script_stores_script_and_returns_it():
    repo = InMemoryRepository()
    run_id = repo.create_run("Kids hygiene video.")
    provider = FakeGroqProvider()
    service = PromptWorkflowService(repository=repo, provider=provider)
    script = service.generate_script(run_id, "Kids hygiene video.")
    assert "Scene" in script
    run = repo.get_run(run_id)
    assert run["latest_script"] == script
    assert run["status"] == "script_generated"
