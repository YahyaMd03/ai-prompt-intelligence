---
name: release-readiness-check
description: Checklist before merge or release. Use when preparing a PR, cutting a release, or verifying the project after changes.
---

# Release Readiness Check

1. **Tests**: Run `cd backend && pytest` and `cd frontend && npm run test`. All must pass.
2. **Lint**: Run `cd backend && ruff check app tests` (or project lint script). Fix any reported issues.
3. **Types**: Run `cd frontend && npm run build` to ensure TypeScript compiles.
4. **Observability**: Confirm new or changed code logs appropriately (request context, errors) per `.cursor/rules/observability-requirements.mdc`.
5. **Docs**: Update README or `docs/` if behavior or setup steps changed.
6. **Secrets**: Ensure no API keys or credentials are committed; use `.env` and `.env.example` only.
7. **Docker**: Optionally run `docker compose up` and smoke-test the full flow (extract → enhance → generate script).
