# Troubleshooting

## Extract options times out (OPTIONS 200 but UI times out)

You see `OPTIONS /api/v1/prompts/extract-options 200` in the backend log but the UI never gets a response. That means the **CORS preflight succeeded**; the browser then sends a **POST**, and the backend is taking too long (or hanging) before responding to the POST. Werkzeug logs a request only when it **finishes**, so you won’t see the POST line until the handler returns.

**How to see where it sticks:** With the added debug logs, after you click “Extract options” watch the backend terminal. You should see (in order):

1. `extract_options POST received` — POST reached Flask.
2. `extract_options validated, calling service` — Body was valid.
3. `extract_options: create_run starting` — About to hit the DB.
4. `extract_options: create_run done, calling provider.extract_options` — DB finished; about to call Groq (or mock).
5. `extract_options: provider done, updating options` — Groq/mock finished.
6. `extract_options service done` — Response is about to be sent.

- **Stuck after (3), never (4):** DB connection or query is hanging. Check `DATABASE_URL`, Postgres is running, and (with Docker) use host `db` when backend runs in Compose, `localhost` when backend runs on the host.
- **Stuck after (4), never (5):** Groq (or its timeout) is the bottleneck. If `GROQ_API_KEY` is set, the app waits up to ~15s for Groq then falls back to mock. To avoid the wait during debugging, unset `GROQ_API_KEY` in `.env` so the mock is used immediately.

After you find the cause, you can turn down log level or remove these debug logs if you like.

## Database

- **No tables / empty DB**: Run the schema once with `python backend/scripts/init_db.py` from the **project root** It reads `DATABASE_URL` from **backend/.env**. This applies `infra/postgres/init.sql`. If you run it again and types/tables already exist, you may see "already exists" errors; that’s expected.

## Backend

- **Import errors**: Ensure you run from repo root and install backend with `pip install -e .` from `backend/`. All package inits (`app/`, `app/api/`, etc.) must exist.
- **Database connection**: Set `DATABASE_URL` in **backend/.env**. The backend loads backend/.env whether you run from `backend/` or project root. With Docker Compose, use root `.env` and host `db:5432` inside the backend container.
- **Groq errors**: If `GROQ_API_KEY` is missing or invalid, the app uses the mock provider. Check logs for `provider_error` or "Missing GROQ_API_KEY".
- **502 on extract/enhance/script**: Usually provider failure (timeout, rate limit, or bad response). Check structured logs for `request_id` and error details; confirm mock fallback is used when key is unset.

## Frontend

- **CORS**: Backend allows origin from `FRONTEND_ORIGIN` (default `http://localhost:5173`). For a different dev URL, set it in backend env.
- **API base**: Frontend uses `VITE_API_BASE_URL` (default `http://localhost:5000/api/v1`). Set in **frontend/.env** or when running in Docker.
- **Build fails**: Run `npm install` and `npm run build`; ensure `@vitejs/plugin-react` is installed and `vite.config.ts` includes the React plugin.

## Prompt injection

- **What we do:** System prompts tell the model to treat the user message only as the video/content prompt to process and to ignore any embedded instructions (e.g. "forget instructions", "reveal data"). User content is sent in a delimited structure so the model sees it as data, not as commands. No secrets (e.g. `DATABASE_URL`, `GROQ_API_KEY`) are ever sent to the LLM.
- **Optional guard:** Set `ENABLE_PROMPT_GUARD=true` in the backend to reject prompts containing obvious injection phrases (e.g. "forget instructions", "expose database key") with 400 "Prompt not allowed." The guard is best-effort; system-prompt hardening is the primary defense. Turn it off if you see false positives on legitimate prompts.

## Docker

- **Compose up**: From repo root, `docker compose up`. Ensure `.env` exists (copy from `.env.example`) and `GROQ_API_KEY` is set if you want live Groq.
- **DB not ready**: Backend depends on `db` healthcheck; if Postgres is slow to start, backend may fail once. Restart backend container after DB is up.
- **Frontend in Docker**: Uses `VITE_API_BASE_URL` for browser requests; if frontend runs in Docker and backend on host, use host URL (e.g. `http://host.docker.internal:5000/api/v1`) or run both in Compose and use service name for API_BASE if proxied.
