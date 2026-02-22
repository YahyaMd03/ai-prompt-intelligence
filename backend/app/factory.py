from __future__ import annotations

from typing import Optional

from flask import Flask
from flask_cors import CORS

from app.api.routes import create_api_blueprint
from app.application.service import PromptWorkflowService
from app.config import get_settings
from app.infrastructure.groq_provider import GroqLiveProvider, GroqProvider
from app.infrastructure.logging import attach_request_id, configure_logging
from app.infrastructure.repository import PromptRepository


def create_app(
    repository: Optional[PromptRepository] = None,
    provider: Optional[GroqProvider] = None,
) -> Flask:
    settings = get_settings()
    configure_logging(settings.log_level)

    if repository is None:
        repository = PromptRepository(settings.database_url, connect_timeout=5)
    if provider is None:
        provider = GroqLiveProvider(
            api_key=settings.groq_api_key,
            model_name=settings.groq_model,
            timeout_seconds=settings.groq_timeout_seconds,
        )
    service = PromptWorkflowService(repository=repository, provider=provider)

    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": settings.frontend_origin}})
    app.before_request(attach_request_id)
    app.register_blueprint(create_api_blueprint(service), url_prefix="/api/v1")
    return app
