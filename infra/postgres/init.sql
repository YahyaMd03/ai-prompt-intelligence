-- CREATE TYPE platform_enum AS ENUM ('youtube', 'instagram', 'tiktok', 'facebook', 'generic');
-- CREATE TYPE size_enum AS ENUM ('landscape', 'vertical', 'square');
-- CREATE TYPE category_enum AS ENUM ('kids', 'education', 'marketing', 'storytelling', 'generic');
-- CREATE TYPE run_status_enum AS ENUM ('created', 'extracted', 'enhanced', 'script_generated', 'failed');

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS prompt_runs (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  original_prompt TEXT NOT NULL,
  current_prompt TEXT NOT NULL,
  status run_status_enum NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_options (
  run_id UUID PRIMARY KEY REFERENCES prompt_runs(id) ON DELETE CASCADE,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  language TEXT,
  platform platform_enum,
  size size_enum,
  category category_enum,
  source TEXT NOT NULL DEFAULT 'extract',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generated_scripts (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES prompt_runs(id) ON DELETE CASCADE,
  script_text TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_logs (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  run_id UUID REFERENCES prompt_runs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  run_id UUID REFERENCES prompt_runs(id) ON DELETE SET NULL,
  level TEXT NOT NULL CHECK (level IN ('error', 'warning')),
  message TEXT NOT NULL,
  error_code TEXT,
  details TEXT,
  request_id TEXT,
  path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
