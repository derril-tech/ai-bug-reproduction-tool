# ARCH.md — AI Bug Reproduction Tool

## 1) High-Level Architecture
- **Frontend/BFF**: Next.js 14 (Vercel). SSR timelines; Server Actions for uploads/exports.
- **API Gateway**: NestJS (Node 20). REST `/v1`, OpenAPI 3.1, Zod validation, RBAC (Casbin), RLS.
- **Workers** (Python 3.11 + FastAPI): `ingest-worker`, `signal-worker`, `map-worker`, `synth-worker`, `env-worker`, `validate-worker`, `export-worker`.
- **Event bus**: NATS (topics), Redis Streams (progress).
- **Runners**: containerized (Docker-in-Docker or Firecracker). Cached toolchains + browsers + DB images.
- **Data**: Postgres 16 + pgvector; S3/R2 for artifacts; Redis caches; OpenTelemetry, Prometheus/Grafana; Sentry.
- **Security**: KMS-wrapped secrets; scoped VCS tokens; read-only by default; immutable audit; PII scrubbers.

### ASCII Diagram
```
+---------+         +-----------+         +------------------+       +-------------+
|  Web UI | <-----> |  BFF/API  | <-----> |   NATS / Redis   | <---> |   Workers   |
| Next.js |  HTTPS  |  NestJS   | events  |  (queues/events) | jobs  |  (FastAPI)  |
+----+----+         +-----+-----+         +---------+--------+       +------+------+
     |                    |                         |                        |
     | SSR/Uploads        | SQL/Vector              | Signals                | Runners
     |                    v                         v                        v
     |              +-----------+            +-------------+          +-------------+
     |              | Postgres  |            |   S3 / R2   |          |  Sandbox    |
     +------------> | +pgvector |            |  Artifacts  |          |  (Docker)   |
                    +-----------+            +-------------+          +-------------+
```

## 2) Key Pipelines
1. **Ingest**: parse report (OCR screenshots, transcribe videos), attach signals (HAR/logs).  
2. **Map**: RAG over repo/docs to infer module/framework + runner (Playwright/Pytest/etc).  
3. **Synthesize**: generate steps, fixtures, seed data; compose env; wire deterministic flags.  
4. **Validate**: N-run loop, stability scoring, Zeller-style delta minimization; mark flake/quarantine.  
5. **Export**: PR with failing test; sandbox bundle (web/docker); PDF repro sheet; JSON bundle.

## 3) Data Model (DDL Sketch)
```sql
CREATE TABLE orgs      (id uuid primary key, name text, plan text default 'pro', created_at timestamptz default now());
CREATE TABLE users     (id uuid primary key, org_id uuid, email citext unique, role text default 'member');
CREATE TABLE projects  (id uuid primary key, org_id uuid, name text, repo_url text, default_branch text, created_at timestamptz default now());

CREATE TABLE reports   (
  id uuid primary key, project_id uuid, title text, description text,
  reporter text, source text, severity text, env jsonb, created_at timestamptz default now()
);

CREATE TABLE signals   (
  id uuid primary key, report_id uuid, kind text, s3_key text, meta jsonb, embedding vector(1536)
);
CREATE INDEX ON signals USING hnsw (embedding vector_cosine_ops);

CREATE TABLE mappings  (id uuid primary key, report_id uuid, module text, files text[], framework text, confidence numeric);

CREATE TABLE repros    (
  id uuid primary key, report_id uuid, framework text, entry text,
  docker_compose jsonb, seed jsonb, sandbox_url text, status text, created_at timestamptz default now()
);

CREATE TABLE steps     (
  id uuid primary key, repro_id uuid, order_idx int, kind text,
  payload jsonb, minimized boolean default false
);

CREATE TABLE runs      (
  id uuid primary key, repro_id uuid, iteration int, passed boolean,
  duration_ms int, logs_s3 text, video_s3 text, trace_s3 text
);

CREATE TABLE exports   (id uuid primary key, repro_id uuid, kind text, s3_key text, pr_url text, created_at timestamptz default now());
CREATE TABLE audit_log (id bigserial primary key, org_id uuid, user_id uuid, action text, target text, meta jsonb, created_at timestamptz default now());
```

**Invariants**
- RLS by `project_id` at the API layer (scoped queries).  
- Each repro must demonstrate ≥1 failing run before allowing PR/export.  
- All artifacts pass sanitizers (PII/log redaction) pre-export.

## 4) Event Topics
- `report.ingest` → `signals.attach` → `map.code` → `repro.synth` → `env.make` → `repro.validate` → `export.make`

## 5) Runners & Determinism
- **Playwright** default for web UI (Chromium/WebKit/Firefox matrices).  
- **Timing controls**: `fakeTimers/clock.freeze`, network throttle, disable retries.  
- **Environment**: pinned Node/Python, OS image, DB container (seeded).  
- **Selectors**: role/aria/label preferred; fallback to CSS/XPath with stability score.

## 6) Repro Minimization (Pseudo)
```python
def ddmin(steps, run_once):
    # Zeller delta debugging inspired minimization
    n = 2
    while len(steps) >= 2:
        chunk_size = math.ceil(len(steps) / n)
        reduced = False
        for i in range(0, len(steps), chunk_size):
            candidate = steps[:i] + steps[i+chunk_size:]
            if run_once(candidate) == "FAILS":
                steps = candidate; n = max(n-1, 2); reduced = True; break
        if not reduced: n = min(n*2, len(steps))
    return steps
```

## 7) RAG Mapping
- Index README/CONTRIBUTING/TESTING, route files, API schemas, ADRs.  
- Map error signatures (logs/HAR) → probable module paths using pgvector similarity.  
- Select runner based on framework probes + repo heuristics.

## 8) Security & Compliance
- **Least-privilege tokens**; read-only clones; PR step is opt-in and auditable.  
- **PII scrubbing** for logs/fixtures; synthetic data by default; retention windows.  
- **Immutable audit**; artifact signing; per-tenant KMS envelopes.

## 9) Observability
- OTel spans per stage (`report.ingest`, `repro.synth`, `validate.loop`, …).  
- Prom metrics: ingest latency, repro success rate, flake score distribution, time-to-failing-test.  
- Sentry: runner crashes, sandbox export failures.

## 10) External Integrations
- **PR/MR**: GitHub/GitLab/Bitbucket.  
- **Sandboxes**: CodeSandbox/StackBlitz; Docker tarball for offline.  
- **Signal providers**: Datadog, Sentry, New Relic (log/link ingestion).

## 11) REST API (excerpt)
```
POST /v1/reports                       # create report
POST /v1/reports/{id}/signals          # attach HAR/log/video/screenshot
POST /v1/repros/plan                   # map to module & framework
POST /v1/repros/generate               # synthesize test + env
POST /v1/repros/{id}/validate          # N-run flake check & minimization
POST /v1/exports/pr                    # open PR/MR with failing test
POST /v1/exports/sandbox               # export sandbox bundle
POST /v1/exports/report                # PDF/JSON repro sheet
GET  /v1/repros/{id}/artifacts         # traces/videos/logs/compose
```

## 12) Performance & Scaling
- Parallel workers by queue; prewarmed browser images; layer-cached packages.  
- Batching OCR/ASR; dedupe HAR requests; streaming uploads to S3.  
- Target p95s: ingest→repro < 90s; validate 20 runs < 4m; export PR < 30s.

## 13) Edge Cases
- **Noisy reports**: run heuristic filters; prompt user to confirm minimal steps.  
- **Heavily SPA obfuscated selectors**: fall back to DOM path w/ resilience hints.  
- **Flaky external APIs**: record/replay or local mocks.  
- **Auth flows**: headless login fixtures; token stubs w/ rotation disabled in sandbox.
