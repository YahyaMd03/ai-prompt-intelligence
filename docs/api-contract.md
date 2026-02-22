# API Contract

Base URL: `/api/v1` (e.g. `http://localhost:5000/api/v1`).

## Health

- `GET /health` → `{"status": "ok"}`.

## Prompts

- **Extract options**  
  `POST /prompts/extract-options`  
  Body: `{ "prompt": string }` (min 10, max 5000 chars).  
  Response 200: `{ "run_id": uuid, "options": { "duration_seconds"?, "language"?, "platform"?, "size"?, "category"? }, "missing_fields": string[] }`.  
  Allowed enums: platform (youtube, instagram, tiktok, facebook, generic), size (landscape, vertical, square), category (kids, education, marketing, storytelling, generic).

- **Enhance prompt**  
  `POST /prompts/enhance`  
  Body: `{ "run_id": uuid, "prompt": string, "options": options object }`.  
  Response 200: `{ "run_id": uuid, "enhanced_prompt": string }`.

- **Generate script**  
  `POST /prompts/generate-script`  
  Body: `{ "run_id": uuid, "prompt": string }`.  
  Response 200: `{ "run_id": uuid, "script": string }`.

## Runs

- `GET /runs/<run_id>` → 200 run payload or 404.
- `GET /runs` → 200 `{ "runs": [...] }`.

Errors: 400 (validation), 502 (provider/backend failure). Response shape: `{ "error": string, "details"?: string }`.
