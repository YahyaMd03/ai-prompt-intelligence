"""
Run a single Postgres migration file against DATABASE_URL.
Use when you don't have psql. Loads backend/.env automatically.

Usage (from project root):
  python backend/scripts/run_migration.py 001_add_sessions.sql
"""
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
project_root = backend_dir.parent
sys.path.insert(0, str(backend_dir))
os.chdir(project_root)

import psycopg
from app.config import get_settings


def main():
    if len(sys.argv) < 2:
        print("Usage: python backend/scripts/run_migration.py <migration.sql>", file=sys.stderr)
        sys.exit(1)
    arg = Path(sys.argv[1])
    if arg.is_file():
        migration_path = arg
    else:
        migration_path = project_root / "infra" / "postgres" / "migrations" / arg.name
    if not migration_path.exists():
        print("Migration file not found:", migration_path, file=sys.stderr)
        sys.exit(1)
    sql = migration_path.read_text()
    settings = get_settings()
    print("Connecting to database...")
    try:
        with psycopg.connect(settings.database_url, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
        print("Migration applied successfully.")
    except psycopg.Error as e:
        print("Error:", e, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
