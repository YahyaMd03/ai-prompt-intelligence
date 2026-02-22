import logging
from typing import Any
from uuid import UUID

import psycopg
from flask import Blueprint, jsonify, request
from pydantic import ValidationError as PydanticValidationError

from app.api.schemas import (
    EnhancePromptRequest,
    ExtractOptionsRequest,
    ExtractOptionsResponse,
    GenerateScriptRequest,
    PromptOptionsSchema,
)
from app.application.service import PromptWorkflowService
from app.config import get_settings
from app.domain.errors import AppError
from app.domain.models import Category, Platform, PromptOptions, Size
from app.infrastructure.logging import request_context_values
from app.infrastructure.prompt_guard import is_prompt_blocked

logger = logging.getLogger(__name__)


def _get_session_id() -> UUID | None:
    """Read X-Session-Id header; return UUID or None if missing/invalid."""
    raw = request.headers.get("X-Session-Id")
    if not raw:
        return None
    try:
        return UUID(raw.strip())
    except (ValueError, AttributeError):
        return None


def _persist_error(
    service: PromptWorkflowService,
    level: str,
    message: str,
    *,
    run_id: UUID | None = None,
    session_id: UUID | None = None,
    error_code: str | None = None,
    details: str | None = None,
) -> None:
    ctx = request_context_values()
    sid = session_id if session_id is not None else _get_session_id()
    service.repository.log_error(
        level,
        message,
        run_id=run_id,
        session_id=sid,
        error_code=error_code,
        details=details,
        request_id=ctx.get("request_id"),
        path=ctx.get("path"),
    )


def _user_facing_provider_error_details(exc: AppError) -> str:
    """Return a user-friendly message for provider errors; technical details stay in logs."""
    if exc.code != "provider_error":
        return str(exc)
    msg = str(exc).lower()
    if "did not return json" in msg or "could not parse provider json" in msg:
        return "Invalid prompt. Try again or rephrase your prompt."
    if "invalid groq response" in msg or "groq api error" in msg:
        return "The AI service returned an unexpected response. Try again in a moment."
    if "missing groq_api_key" in msg:
        return "AI service is not configured. Try again later or contact support."
    if "timeout" in msg or "timed out" in msg:
        return "The request took too long. Try again or use a shorter prompt."
    return "Something went wrong with the AI service. Try again in a moment."


def _to_options(data: dict) -> PromptOptions:
    def _enum_val(e: Any) -> str | None:
        if e is None:
            return None
        return e.value if hasattr(e, "value") else e

    platform = _enum_val(data.get("platform"))
    size = _enum_val(data.get("size"))
    category = _enum_val(data.get("category"))
    return PromptOptions(
        duration_seconds=data.get("duration_seconds"),
        language=data.get("language"),
        platform=Platform(platform) if platform and platform in [p.value for p in Platform] else None,
        size=Size(size) if size and size in [s.value for s in Size] else None,
        category=Category(category) if category and category in [c.value for c in Category] else None,
    )


def create_api_blueprint(service: PromptWorkflowService):
    api = Blueprint("api", __name__)

    @api.get("/health")
    def health():
        return jsonify({"status": "ok"})

    @api.post("/prompts/extract-options")
    def extract_options():
        session_id = _get_session_id()
        logger.info("extract_options POST received", extra=request_context_values())
        try:
            payload = ExtractOptionsRequest.model_validate(request.get_json(force=True))
            if get_settings().enable_prompt_guard and is_prompt_blocked(payload.prompt):
                return jsonify({"error": "Invalid request", "details": "Prompt not allowed."}), 400
            logger.info("extract_options validated, calling service", extra=request_context_values())
            run_id, options = service.extract_options(payload.prompt, session_id=session_id)
            logger.info("extract_options service done", extra={**request_context_values(), "run_id": str(run_id)})
            opts_schema = PromptOptionsSchema.model_validate(
                {k: (v.value if hasattr(v, "value") else v) for k, v in options.__dict__.items()}
            )
            data = ExtractOptionsResponse(
                run_id=run_id,
                options=opts_schema,
                missing_fields=[k for k, v in options.__dict__.items() if v is None],
            )
            return jsonify(data.model_dump(mode="json")), 200
        except (PydanticValidationError, ValueError) as exc:
            logger.warning("Invalid extract request", extra={**request_context_values(), "error": str(exc)})
            _persist_error(service, "warning", "Invalid extract request", session_id=session_id, details=str(exc))
            return jsonify({"error": "Invalid request", "details": str(exc)}), 400
        except psycopg.OperationalError as exc:
            logger.error("Database connection failed", extra={**request_context_values(), "error": str(exc)})
            return jsonify({"error": "database_unavailable", "details": "Cannot connect to database. Check DATABASE_URL points to a reachable Postgres instance."}), 503
        except AppError as exc:
            logger.error(
                "Extract failed",
                extra={
                    **request_context_values(),
                    "error": str(exc),
                    "error_code": exc.code,
                },
            )
            _persist_error(service, "error", "Extract failed", session_id=session_id, error_code=exc.code, details=str(exc))
            return jsonify({"error": exc.code, "details": _user_facing_provider_error_details(exc)}), 502

    @api.post("/prompts/enhance")
    def enhance_prompt():
        session_id = _get_session_id()
        try:
            payload = EnhancePromptRequest.model_validate(request.get_json(force=True))
            if get_settings().enable_prompt_guard and is_prompt_blocked(payload.prompt):
                return jsonify({"error": "Invalid request", "details": "Prompt not allowed."}), 400
            options = _to_options(payload.options.model_dump())
            enhanced = service.enhance_prompt(payload.run_id, payload.prompt, options, session_id=session_id)
            return jsonify({"run_id": str(payload.run_id), "enhanced_prompt": enhanced}), 200
        except (PydanticValidationError, ValueError) as exc:
            logger.warning("Invalid enhance request", extra={**request_context_values(), "error": str(exc)})
            _persist_error(service, "warning", "Invalid enhance request", session_id=session_id, details=str(exc))
            return jsonify({"error": "Invalid request", "details": str(exc)}), 400
        except psycopg.OperationalError as exc:
            logger.error("Database connection failed", extra={**request_context_values(), "error": str(exc)})
            return jsonify({"error": "database_unavailable", "details": "Cannot connect to database. Check DATABASE_URL points to a reachable Postgres instance."}), 503
        except AppError as exc:
            logger.error(
                "Enhance failed",
                extra={
                    **request_context_values(),
                    "error": str(exc),
                    "error_code": exc.code,
                },
            )
            _persist_error(service, "error", "Enhance failed", run_id=payload.run_id, session_id=session_id, error_code=exc.code, details=str(exc))
            return jsonify({"error": exc.code, "details": _user_facing_provider_error_details(exc)}), 502

    @api.post("/prompts/generate-script")
    def generate_script():
        session_id = _get_session_id()
        try:
            payload = GenerateScriptRequest.model_validate(request.get_json(force=True))
            if get_settings().enable_prompt_guard and is_prompt_blocked(payload.prompt):
                return jsonify({"error": "Invalid request", "details": "Prompt not allowed."}), 400
            options = (
                _to_options(payload.options.model_dump())
                if payload.options is not None
                else None
            )
            script = service.generate_script(payload.run_id, payload.prompt, options, session_id=session_id)
            return jsonify({"run_id": str(payload.run_id), "script": script}), 200
        except (PydanticValidationError, ValueError) as exc:
            logger.warning("Invalid script request", extra={**request_context_values(), "error": str(exc)})
            _persist_error(service, "warning", "Invalid script request", session_id=session_id, details=str(exc))
            return jsonify({"error": "Invalid request", "details": str(exc)}), 400
        except psycopg.OperationalError as exc:
            logger.error("Database connection failed", extra={**request_context_values(), "error": str(exc)})
            return jsonify({"error": "database_unavailable", "details": "Cannot connect to database. Check DATABASE_URL points to a reachable Postgres instance."}), 503
        except AppError as exc:
            logger.error(
                "Script generation failed",
                extra={
                    **request_context_values(),
                    "error": str(exc),
                    "error_code": exc.code,
                },
            )
            _persist_error(service, "error", "Script generation failed", run_id=payload.run_id, session_id=session_id, error_code=exc.code, details=str(exc))
            return jsonify({"error": exc.code, "details": _user_facing_provider_error_details(exc)}), 502

    @api.get("/runs/<run_id>")
    def get_run(run_id: str):
        try:
            data = service.repository.get_run(UUID(run_id))
            if data is None:
                return jsonify({"error": "not_found"}), 404
            return jsonify(data), 200
        except ValueError:
            return jsonify({"error": "invalid_run_id"}), 400
        except psycopg.OperationalError as exc:
            logger.error("Database connection failed", extra={**request_context_values(), "error": str(exc)})
            return jsonify({"error": "database_unavailable", "details": "Cannot connect to database. Check DATABASE_URL points to a reachable Postgres instance."}), 503

    @api.get("/runs")
    def list_runs():
        try:
            return jsonify({"runs": service.repository.list_runs()}), 200
        except psycopg.OperationalError as exc:
            logger.error("Database connection failed", extra={**request_context_values(), "error": str(exc)})
            return jsonify({"error": "database_unavailable", "details": "Cannot connect to database. Check DATABASE_URL points to a reachable Postgres instance."}), 503

    return api
