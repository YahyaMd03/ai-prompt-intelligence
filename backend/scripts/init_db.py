"""
Run the Postgres schema (tables and enums) against DATABASE_URL.
Use when the database is empty (e.g. new Railway Postgres). Safe to run once;
running again may error if types/tables already exist.
"""
import os
import sys
from pathlib import Path

# Backend dir and project root; app.config loads backend/.env
backend_dir = Path(__file__).resolve().parent.parent
project_root = backend_dir.parent
sys.path.insert(0, str(backend_dir))
os.chdir(project_root)

import psycopg
from app.config import get_settings


def main():
    settings = get_settings()
    init_sql = project_root / "infra" / "postgres" / "init.sql"
    if not init_sql.exists():
        print("Schema file not found:", init_sql, file=sys.stderr)
        sys.exit(1)
    sql = init_sql.read_text()
    print("Connecting to database...")
    try:
        with psycopg.connect(settings.database_url, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
        print("Schema applied successfully.")
    except psycopg.Error as e:
        print("Error:", e, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
