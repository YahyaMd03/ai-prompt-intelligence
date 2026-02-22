---
name: prompt-workflow-implementation
description: Implements or changes the prompt workflow (extract options, enhance prompt, generate script). Use when adding or modifying steps in the Prompt Processing page or backend workflow endpoints.
---

# Prompt Workflow Implementation

## Contract

1. **Extract Options**: Button sends current Prompt Box text to `POST /api/v1/prompts/extract-options`. Backend creates a run, calls Groq (or mock), returns `run_id`, editable `options`, and `missing_fields`. Partial data is allowed; missing fields stay editable.
2. **Enhance Prompt**: Sends `run_id`, current prompt, and current options to `POST /api/v1/prompts/enhance`. Response `enhanced_prompt` must replace the content of the Prompt Box; the box remains editable.
3. **Generate Video Script**: Sends `run_id` and current Prompt Box content to `POST /api/v1/prompts/generate-script`. Response `script` is shown in the script output panel (scene-by-scene, visuals, narration, mood, cinematic cues).

## Rules

- Do not block the workflow when options are incomplete; allow user to edit and proceed.
- Backend must validate request bodies with Pydantic and return schema-consistent JSON.
- Persist runs and options in Postgres; use the repository and existing enums/constraints.

## References

- Backend: `app.api.routes`, `app.application.service`, `app.domain.models`
- Frontend: `src/App.tsx`, `src/api.ts`, `src/types.ts`
