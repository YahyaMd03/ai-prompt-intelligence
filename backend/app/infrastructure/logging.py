import logging
import sys
import uuid
from typing import Any

from flask import g, request
from pythonjsonlogger import jsonlogger


# Standard LogRecord attribute names; anything else (e.g. groq_* from extra=) we include in JSON.
_RESERVED = {
    "args", "asctime", "created", "exc_info", "exc_text", "filename",
    "funcName", "levelname", "levelno", "lineno", "module", "msecs",
    "message", "msg", "name", "pathname", "process", "processName",
    "relativeCreated", "stack_info", "thread", "threadName",
}


class ExtraFieldsJsonFormatter(jsonlogger.JsonFormatter):
    """JSON formatter that includes standard fields plus any extra= attributes (e.g. groq_*)."""

    def add_fields(self, log_record: dict, record: logging.LogRecord, message_dict: dict) -> None:
        super().add_fields(log_record, record, message_dict)
        for key, value in record.__dict__.items():
            if key not in _RESERVED and key not in log_record and value is not None:
                log_record[key] = value


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    formatter = ExtraFieldsJsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s %(path)s"
    )
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())


def request_context_values() -> dict[str, Any]:
    return {
        "request_id": getattr(g, "request_id", None),
        "path": request.path if request else None,
    }


def attach_request_id() -> None:
    g.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
