from __future__ import annotations

import json
from datetime import datetime
from uuid import UUID, uuid4

import psycopg

from app.domain.models import PromptOptions, RunStatus


class PromptRepository:
    def __init__(self, database_url: str, connect_timeout: int = 5):
        self._database_url = database_url
        self._connect_timeout = connect_timeout

    def _connect(self):
        return psycopg.connect(
            self._database_url,
            connect_timeout=self._connect_timeout,
        )

    def ensure_session(self, session_id: UUID) -> None:
        """Create session row if it does not exist (idempotent)."""
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sessions (id)
                VALUES (%s)
                ON CONFLICT (id) DO NOTHING
                """,
                (session_id,),
            )

    def create_run(self, prompt: str, session_id: UUID | None = None) -> UUID:
        run_id = uuid4()
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO prompt_runs (id, session_id, original_prompt, current_prompt, status)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (run_id, session_id, prompt, prompt, RunStatus.CREATED.value),
            )
            cur.execute(
                """
                INSERT INTO prompt_options (run_id)
                VALUES (%s)
                ON CONFLICT (run_id) DO NOTHING
                """,
                (run_id,),
            )
        return run_id

    def update_options(self, run_id: UUID, options: PromptOptions, source: str = "extract") -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO prompt_options
                (run_id, duration_seconds, language, platform, size, category, source, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (run_id) DO UPDATE
                SET duration_seconds = EXCLUDED.duration_seconds,
                    language = EXCLUDED.language,
                    platform = EXCLUDED.platform,
                    size = EXCLUDED.size,
                    category = EXCLUDED.category,
                    source = EXCLUDED.source,
                    updated_at = NOW()
                """,
                (
                    run_id,
                    options.duration_seconds,
                    options.language,
                    options.platform.value if options.platform else None,
                    options.size.value if options.size else None,
                    options.category.value if options.category else None,
                    source,
                ),
            )
            cur.execute(
                "UPDATE prompt_runs SET status = %s, updated_at = NOW() WHERE id = %s",
                (RunStatus.EXTRACTED.value, run_id),
            )

    def update_current_prompt(self, run_id: UUID, prompt: str, status: RunStatus) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE prompt_runs SET current_prompt = %s, status = %s, updated_at = NOW() WHERE id = %s",
                (prompt, status.value, run_id),
            )

    def insert_script(self, run_id: UUID, script_text: str, provider: str, model: str) -> UUID:
        script_id = uuid4()
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO generated_scripts (id, run_id, script_text, provider, model)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (script_id, run_id, script_text, provider, model),
            )
            cur.execute(
                "UPDATE prompt_runs SET status = %s, updated_at = NOW() WHERE id = %s",
                (RunStatus.SCRIPT_GENERATED.value, run_id),
            )
        return script_id

    def log_event(
        self,
        run_id: UUID | None,
        event_type: str,
        payload: dict,
        session_id: UUID | None = None,
    ) -> None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO event_logs (id, session_id, run_id, event_type, payload)
                VALUES (%s, %s, %s, %s, %s::jsonb)
                """,
                (uuid4(), session_id, run_id, event_type, json.dumps(payload)),
            )

    def get_run(self, run_id: UUID) -> dict | None:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT r.id, r.original_prompt, r.current_prompt, r.status,
                       o.duration_seconds, o.language, o.platform, o.size, o.category,
                       s.script_text
                FROM prompt_runs r
                LEFT JOIN prompt_options o ON o.run_id = r.id
                LEFT JOIN LATERAL (
                    SELECT script_text
                    FROM generated_scripts
                    WHERE run_id = r.id
                    ORDER BY created_at DESC
                    LIMIT 1
                ) s ON true
                WHERE r.id = %s
                """,
                (run_id,),
            )
            row = cur.fetchone()
        if row is None:
            return None
        return {
            "run_id": row[0],
            "original_prompt": row[1],
            "current_prompt": row[2],
            "status": row[3],
            "options": {
                "duration_seconds": row[4],
                "language": row[5],
                "platform": row[6],
                "size": row[7],
                "category": row[8],
            },
            "latest_script": row[9],
        }

    def list_runs(self, limit: int = 20) -> list[dict]:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, original_prompt, current_prompt, status, created_at, updated_at
                FROM prompt_runs
                ORDER BY updated_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [
            {
                "run_id": row[0],
                "original_prompt": row[1],
                "current_prompt": row[2],
                "status": row[3],
                "created_at": datetime.isoformat(row[4]),
                "updated_at": datetime.isoformat(row[5]),
            }
            for row in rows
        ]

    def log_error(
        self,
        level: str,
        message: str,
        *,
        run_id: UUID | None = None,
        session_id: UUID | None = None,
        error_code: str | None = None,
        details: str | None = None,
        request_id: str | None = None,
        path: str | None = None,
    ) -> None:
        """Persist an error or warning to the error_logs table. Ignores DB failures."""
        try:
            with self._connect() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO error_logs (id, session_id, run_id, level, message, error_code, details, request_id, path)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        uuid4(),
                        session_id,
                        run_id,
                        level,
                        message,
                        error_code,
                        details,
                        request_id,
                        path,
                    ),
                )
        except Exception:
            pass
