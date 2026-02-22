# Architecture

## Overview

- **Frontend**: React (Vite) SPA. Single Prompt Processing page: Prompt Box, Extract Options, editable options, Enhance Prompt, Generate Video Script, script output.
- **Backend**: Flask API with layered structure (api → application → domain, infrastructure). Versioned routes under `/api/v1/`.
- **Database**: Postgres. Tables: `prompt_runs`, `prompt_options`, `generated_scripts`, `event_logs`. Enums for platform, size, category, run status.
- **Groq**: Live provider with mock fallback. Used for option extraction, prompt enhancement, and cinematic script generation.

## Layer Boundaries

- **api**: Blueprints, Pydantic request/response schemas. No direct DB or Groq.
- **application**: Use-cases (extract, enhance, generate script). Depends on repository and provider interfaces.
- **domain**: Entities, enums, errors. No framework or infra imports.
- **infrastructure**: Repository (Postgres), Groq provider (live + mock), structured logging.

## Data Flow

1. User enters prompt → Extract Options → backend creates run, calls Groq (or mock), stores options, returns run_id + options + missing_fields.
2. User may edit options → Enhance Prompt → backend updates options, calls Groq, updates current_prompt, returns enhanced_prompt (refills Prompt Box).
3. User may edit prompt → Generate Video Script → backend calls Groq, stores script, returns script (displayed in script panel).

History is persisted per run; no auth in v1.
