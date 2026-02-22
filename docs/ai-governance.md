# AI Governance

## Cursor Rules (`.cursor/rules/`)

- **architecture-boundaries.mdc**: Layer separation; no cross-layer leakage.
- **api-schema-safety.mdc**: Schema-first request/response; Pydantic validation and serialization.
- **testing-verification-gate.mdc**: New behavior requires tests; run pytest and frontend tests.
- **observability-requirements.mdc**: Structured logging, request IDs, error context.
- **ai-change-safety.mdc**: Generated code must be reviewed, validated, and tested; no skipping checks or committing secrets.

## Cursor Skills (`.cursor/skills/`)

- **prompt-workflow-implementation**: Step-by-step contract for extract / enhance / generate script and UI behavior.
- **groq-prompt-contracts**: Groq prompt templates and JSON/output contracts; live vs mock and fallback.
- **release-readiness-check**: Checklist before merge (tests, lint, types, observability, docs, secrets, Docker smoke).

## Usage

- Keep rules and skills in the repo so all contributors and AI sessions use the same constraints.
- When changing workflow or Groq behavior, update the corresponding skill so future edits stay consistent.
