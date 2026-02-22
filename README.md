# AI Prompt Intelligence

Offline assessment app: **Prompt Processing** that extracts structured options from a user prompt, handles partial data, enhances the prompt via Groq, and generates a cinematic video script.

## Stack

- **Backend**: Python 3.11+ / Flask (API)
- **Frontend**: React (Vite, TypeScript)
- **Database**: Postgres

## Key Technical Decisions

- **Layered backend**: api → application → domain, with infrastructure (repository, Groq provider, logging) so new features don’t cause widespread impact and the system stays testable.
- **Schema-first API**: All request/response payloads are defined with Pydantic; validation and serialization are consistent and type-safe.
- **Groq with mock fallback**: Live Groq is used when `GROQ_API_KEY` is set; otherwise a deterministic mock provider is used so the app and tests run without API keys.
- **No auth in v1**: Single workflow with history persisted in Postgres; no user accounts.
- **Project-scoped AI guidance**: Cursor rules and skills live in `.cursor/rules/` and `.cursor/skills/` and are committed so all contributors and AI-assisted edits follow the same constraints.

## Prerequisites

- Python 3.11+, Node 18+, Postgres (or use Docker Compose).
- Optional: [Groq API key](https://console.groq.com/) for live extraction/enhancement/script generation.

## Quick Start

1. **Env (separate per app)**
   - **Backend**: `cp backend/.env.example backend/.env` and set `DATABASE_URL`, optionally `GROQ_API_KEY`.
   - **Frontend**: `cp frontend/.env.example frontend/.env` and set `VITE_API_BASE_URL` if the API is not at `http://localhost:5000/api/v1`.
   - **Docker Compose** uses a single root `.env` (copy from root `.env.example` if you use Compose).

2. **With Docker Compose**
   ```bash
   docker compose up
   ```
   - Frontend: http://localhost:5173  
   - Backend: http://localhost:5000  
   - Postgres: localhost:5432 (user `postgres`, db `prompt_intelligence`)

3. **Local run (no Docker)**
   - Postgres: create a database (local or any hosted provider). Set `DATABASE_URL` in **backend/.env**.
   - **Seed the schema** (when the DB is empty): from project root, `python backend/scripts/init_db.py` (reads `DATABASE_URL` from backend/.env).
   - Backend:
     ```bash
     cd backend && pip install -e . && python -m app.main
     ```
     Uses **backend/.env**.
   - Frontend:
     ```bash
     cd frontend && npm install && npm run dev
     ```
     Uses **frontend/.env** (e.g. `VITE_API_BASE_URL`).

## Product Flow

1. **Prompt Box**: User enters initial prompt (e.g. “Create a 30 second kids educational video about cleanliness for YouTube in English, vertical format.”).
2. **Extract Options**: Click “Extract Options” → backend extracts duration, language, platform, size, category (partial OK); values appear in editable fields.
3. **Enhance Prompt**: Click “Enhance Prompt” → backend returns a production-ready brief and **refills the Prompt Box**; user can edit further.
4. **Generate Video Script**: Click “Generate Video Script” → backend returns a scene-by-scene cinematic script (visuals, narration, mood, cues); shown in the script panel.

## Testing

- **Backend**: `cd backend && pytest`
- **Frontend**: `cd frontend && npm run test`
- **Lint (backend)**: `cd backend && ruff check app tests`

## Observability and Debugging

- Backend uses structured (JSON) logging. Each request has a `request_id` (from `X-Request-ID` or generated). Use it to trace logs for a single request.
- Failures are logged with level and context; 502 responses indicate provider or server errors (see logs and `docs/troubleshooting.md`).
- Health: `GET /api/v1/health`.

## Documentation

- [Architecture](docs/architecture.md)
- [API contract](docs/api-contract.md)
- [AI governance (Cursor rules & skills)](docs/ai-governance.md)
- [Troubleshooting](docs/troubleshooting.md)

## Limitations and Risks

- No authentication; anyone with network access can call the API and create runs.
- Groq live provider is subject to rate limits and availability; mock is used when key is missing or on failure.
- History is stored indefinitely in Postgres; consider retention or cleanup for production.
