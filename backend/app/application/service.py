from __future__ import annotations

import logging
from uuid import UUID

from app.domain.models import PromptOptions, RunStatus
from app.infrastructure.groq_provider import GroqProvider
from app.infrastructure.repository import PromptRepository

logger = logging.getLogger(__name__)


class PromptWorkflowService:
    def __init__(self, repository: PromptRepository, provider: GroqProvider):
        self.repository = repository
        self.provider = provider

    def extract_options(self, prompt: str, session_id: UUID | None = None) -> tuple[UUID, PromptOptions]:
        if session_id is not None:
            self.repository.ensure_session(session_id)
        logger.info("extract_options: create_run starting")
        run_id = self.repository.create_run(prompt, session_id=session_id)
        logger.info("extract_options: create_run done, calling provider.extract_options")
        options, usage = self.provider.extract_options(prompt)
        logger.info("extract_options: provider done, updating options")
        self.repository.update_options(run_id, options, source="extract")
        payload = {
            "provider": self.provider.provider_name,
            "model": self.provider.model_name,
        }
        if usage is not None:
            payload["usage"] = usage
        self.repository.log_event(run_id, "extract_options", payload, session_id=session_id)
        return run_id, options

    def enhance_prompt(
        self, run_id: UUID, prompt: str, options: PromptOptions, session_id: UUID | None = None
    ) -> str:
        self.repository.update_options(run_id, options, source="user")
        enhanced, usage = self.provider.enhance_prompt(prompt, options)
        self.repository.update_current_prompt(run_id, enhanced, RunStatus.ENHANCED)
        payload = {
            "provider": self.provider.provider_name,
            "model": self.provider.model_name,
        }
        if usage is not None:
            payload["usage"] = usage
        self.repository.log_event(run_id, "enhance_prompt", payload, session_id=session_id)
        return enhanced

    def generate_script(
        self,
        run_id: UUID,
        prompt: str,
        options: PromptOptions | None = None,
        session_id: UUID | None = None,
    ) -> str:
        script, usage = self.provider.generate_script(prompt, options)
        self.repository.insert_script(
            run_id,
            script_text=script,
            provider=self.provider.provider_name,
            model=self.provider.model_name,
        )
        self.repository.update_current_prompt(run_id, prompt, RunStatus.SCRIPT_GENERATED)
        payload = {
            "provider": self.provider.provider_name,
            "model": self.provider.model_name,
        }
        if usage is not None:
            payload["usage"] = usage
        self.repository.log_event(run_id, "generate_script", payload, session_id=session_id)
        return script
