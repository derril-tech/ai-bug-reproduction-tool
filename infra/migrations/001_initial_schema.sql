-- Initial database schema for AI Bug Reproduction Tool
-- Run this after enabling pgvector extension

-- Organizations table
CREATE TABLE IF NOT EXISTS orgs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'pro',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
    email CITEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    repo_url TEXT,
    default_branch TEXT DEFAULT 'main',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    reporter TEXT,
    source TEXT,
    severity TEXT,
    env JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Signals table (HAR files, screenshots, videos, logs)
CREATE TABLE IF NOT EXISTS signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('har', 'screenshot', 'video', 'log')),
    s3_key TEXT,
    meta JSONB,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create HNSW index for vector similarity search
CREATE INDEX IF NOT EXISTS signals_embedding_idx ON signals USING hnsw (embedding vector_cosine_ops);

-- Mappings table (RAG results)
CREATE TABLE IF NOT EXISTS mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    module TEXT,
    files TEXT[],
    framework TEXT,
    confidence NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Repros table
CREATE TABLE IF NOT EXISTS repros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    framework TEXT,
    entry TEXT,
    docker_compose JSONB,
    seed JSONB,
    sandbox_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Steps table
CREATE TABLE IF NOT EXISTS steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repro_id UUID REFERENCES repros(id) ON DELETE CASCADE,
    order_idx INT NOT NULL,
    kind TEXT NOT NULL,
    payload JSONB,
    minimized BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Runs table
CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repro_id UUID REFERENCES repros(id) ON DELETE CASCADE,
    iteration INT NOT NULL,
    passed BOOLEAN NOT NULL,
    duration_ms INT,
    logs_s3 TEXT,
    video_s3 TEXT,
    trace_s3 TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Exports table
CREATE TABLE IF NOT EXISTS exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repro_id UUID REFERENCES repros(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('pr', 'sandbox', 'report')),
    s3_key TEXT,
    pr_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target TEXT,
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS reports_project_id_idx ON reports(project_id);
CREATE INDEX IF NOT EXISTS signals_report_id_idx ON signals(report_id);
CREATE INDEX IF NOT EXISTS mappings_report_id_idx ON mappings(report_id);
CREATE INDEX IF NOT EXISTS repros_report_id_idx ON repros(report_id);
CREATE INDEX IF NOT EXISTS steps_repro_id_idx ON steps(repro_id);
CREATE INDEX IF NOT EXISTS runs_repro_id_idx ON runs(repro_id);
CREATE INDEX IF NOT EXISTS exports_repro_id_idx ON exports(repro_id);
CREATE INDEX IF NOT EXISTS audit_log_org_id_idx ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at);

-- Row Level Security (RLS) policies
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE repros ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
