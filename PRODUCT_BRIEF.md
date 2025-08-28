AI Bug Reproduction Tool — natural language bug report → generate reproducible test case/code sandbox 

 

1) Product Description & Presentation 

One-liner 

“Paste a bug report (text, screenshots, logs) and get a deterministic, runnable repro: failing test, fixture data, and a shareable sandbox.” 

What it produces 

Minimal Repro Package (MRP): failing test file + fixtures + seed data + runner config (Jest/Pytest/Playwright/Cypress/RSpec). 

Executable sandbox: CodeSandbox/StackBlitz/ephemeral Docker env with the repro wired and a single npm test / pytest -k bug_123 command. 

Scenario script: human-readable steps + selectors (web), API calls (backend), or CLI sequence (services). 

Signal bundle: linked logs, HAR/session replay, DOM/state diffs at failure, flaky analysis. 

Exports: PR/MR with test + red test badge, PDF repro sheet, JSON bundle (signals, steps, env). 

Scope/Safety 

Read-only over source repo unless PR step; tokens scoped to clone + branch. 

Secrets scrubbed from logs and fixtures; synthetic data generators by default. 

Always marks tests as quarantined until reviewer confirmation. 

 

2) Target User 

QA & SDET teams turning vague reports into hard failures. 

Developers needing deterministic repros + failing tests fast. 

Support/CS escalating field issues with credible artifacts. 

Open-source maintainers triaging community bug reports. 

 

3) Features & Functionalities (Extensive) 

Ingestion & Understanding 

Accept freeform text, screenshots, screen recordings, HAR, logs (Sentry/New Relic/Datadog), console traces. 

RAG over codebase/docs (README/CONTRIBUTING/TESTING, routes, API schemas) to map report → subsystem, file hints, and test framework. 

Extract state & steps: URLs, forms, selectors, API payloads, timing, env flags, browser/OS. 

Repro Synthesis 

Web UI: generate Playwright/Cypress script; smart selector picking (role/aria/label over brittle CSS). 

API/Backend: build sequence of HTTP calls + DB seed (Docker Compose), or cURL smoke script. 

CLI/Service: command series with env vars and input fixtures. 

Data shaping: faker-based synth datasets; PII scrub + referential integrity. 

Timing control: clock freeze, network shaping, retry suppression to avoid flakes. 

Environment Capture 

Infer runtime from repo (Node, Python, Ruby, Java), lock toolchain (nvm/pyenv/asdf). 

Compose ephemeral containers with deterministic seeds; browser matrix (Chromium/WebKit/Firefox). 

Optional remote replay (Playwright trace viewer, rrweb snapshot). 

Validation & Minimization 

Delta-minimize steps (Zeller-style) until failure still reproduces. 

Flake detector: N runs; quarantine tag + stability score. 

Heuristics to remove unnecessary waits, sleeps, and unrelated requests. 

Collaboration & Delivery 

PR/MR generator: adds failing test under tests/regressions/. 

Issue comment bot: posts “how to run” and artifact links. 

One-click shareable sandbox link (web-runner) or Docker tarball. 

Observability & Governance 

Coverage of changed lines; who-owned module; suggested reviewers. 

Provenance graph: bug report → signals → steps → test lines. 

Audit log; retention controls for user-provided artifacts. 

 

4) Backend Architecture (Extremely Detailed & Deployment-Ready) 

4.1 Topology 

Frontend/BFF: Next.js 14 (Vercel) — Server Actions for uploads, repo tokens, exports; SSR timelines. 

API Gateway: NestJS (Node 20) — REST /v1, OpenAPI 3.1, Zod validation, Problem+JSON, RBAC (Casbin), RLS. 

Workers (Python 3.11 + FastAPI control) 

ingest-worker (parse report, OCR screenshots, transcribe videos). 

signal-worker (HAR/log/session clustering, selector mining). 

map-worker (RAG over repo/docs to map to modules & frameworks). 

synth-worker (generate test, fixtures, compose files). 

env-worker (toolchain lock, Docker/Playwright images, data seeding). 

validate-worker (run N times, minimize, detect flakes). 

export-worker (PR, sandbox bundle, PDF/JSON). 

Event bus: NATS topics (report.ingest, signals.attach, map.code, repro.synth, env.make, repro.validate, export.make) + Redis Streams for progress. 

Execution: containerized runners (DinD/Firecracker) with cached browsers, language toolchains, db images. 

Data 

Postgres 16 + pgvector (reports, embeddings, steps, runs). 

S3/R2 (artifacts: videos, traces, HARs, tarballs). 

Redis (queues, rate limits, warm caches). 

Observability: OpenTelemetry (spans per stage), Prometheus/Grafana, Sentry. 

Secrets: Cloud KMS; ephemeral tokens; vault for CI secrets. 

4.2 Data Model (Postgres + pgvector) 

CREATE TABLE orgs (id UUID PRIMARY KEY, name TEXT, plan TEXT DEFAULT 'pro', created_at TIMESTAMPTZ DEFAULT now()); 
CREATE TABLE users (id UUID PRIMARY KEY, org_id UUID, email CITEXT UNIQUE, role TEXT DEFAULT 'member'); 
 
CREATE TABLE projects (id UUID PRIMARY KEY, org_id UUID, name TEXT, repo_url TEXT, default_branch TEXT, created_at TIMESTAMPTZ DEFAULT now()); 
 
CREATE TABLE reports ( 
  id UUID PRIMARY KEY, project_id UUID, title TEXT, description TEXT, 
  reporter TEXT, source TEXT, severity TEXT, env JSONB, created_at TIMESTAMPTZ DEFAULT now() 
); 
 
CREATE TABLE signals ( 
  id UUID PRIMARY KEY, report_id UUID, kind TEXT,            -- har|screenshot|video|log 
  s3_key TEXT, meta JSONB, embedding VECTOR(1536) 
); 
CREATE INDEX ON signals USING hnsw (embedding vector_cosine_ops); 
 
CREATE TABLE mappings ( 
  id UUID PRIMARY KEY, report_id UUID, module TEXT, files TEXT[], framework TEXT, confidence NUMERIC 
); 
 
CREATE TABLE repros ( 
  id UUID PRIMARY KEY, report_id UUID, framework TEXT, entry TEXT,    -- e.g., tests/regressions/bug_123.spec.ts 
  docker_compose JSONB, seed JSONB, sandbox_url TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT now() 
); 
 
CREATE TABLE steps ( 
  id UUID PRIMARY KEY, repro_id UUID, order_idx INT, kind TEXT,       -- click|type|request|assert|cli 
  payload JSONB, minimized BOOLEAN DEFAULT false 
); 
 
CREATE TABLE runs ( 
  id UUID PRIMARY KEY, repro_id UUID, iteration INT, passed BOOLEAN, duration_ms INT, logs_s3 TEXT, video_s3 TEXT, trace_s3 TEXT 
); 
 
CREATE TABLE exports (id UUID PRIMARY KEY, repro_id UUID, kind TEXT, s3_key TEXT, pr_url TEXT, created_at TIMESTAMPTZ DEFAULT now()); 
 
CREATE TABLE audit_log (id BIGSERIAL PRIMARY KEY, org_id UUID, user_id UUID, action TEXT, target TEXT, meta JSONB, created_at TIMESTAMPTZ DEFAULT now()); 
  

Invariants 

RLS by project_id. 

Each repro must have ≥1 failing run before PR export. 

Sanitizers run on fixtures/logs before export. 

4.3 API Surface (REST /v1) 

Reports & Signals 

POST /reports {project_id, title, description, env} 

POST /reports/:id/signals {kind, file} (HAR, screenshot, video, logs) 

Map & Generate 

POST /repros/plan {report_id} → framework + module guess 

POST /repros/generate {report_id, target:"web|api|cli"} → creates test + env 

POST /repros/:id/validate {runs:20} → flake check + minimization 

Artifacts & Export 

GET /repros/:id/artifacts (video, trace, logs, compose) 

POST /exports/pr {repro_id, branch, title} 

POST /exports/sandbox {repro_id, host:"codesandbox|stackblitz|docker"} 

POST /exports/report {repro_id, format:"pdf|json"} 

Search (RAG) 

GET /search?project_id=UUID&q="TypeError cannot read property" 

Conventions: Idempotency-Key on mutations; SSE progress streams. 

4.4 Pipelines 

Ingest report → parse, OCR/ASR → attach signals. 

Map to module & framework via embeddings + code heuristics. 

Synthesize steps + fixtures + test file; compose env. 

Validate run loops; minimize steps; flake score & quarantine. 

Export sandbox + PR + repro report. 

4.5 Security & Compliance 

SSO (SAML/OIDC), least-privilege repo tokens; no prod credentials in runners. 

PII scrubbing; redaction in logs/fixtures; retention policies. 

Signed artifacts, immutable audit. 

 

5) Frontend Architecture (React 18 + Next.js 14 — Looks Matter) 

5.1 Design Language 

shadcn/ui + Tailwind with glass cards, neon accents, soft shadows; dark theme default. 

Framer Motion micro-animations (step minimization “shrink”, run badges pop), tasteful confetti when a red test is generated. 

5.2 App Structure 

/app 
  /(auth)/sign-in/page.tsx 
  /(app)/projects/page.tsx 
  /(app)/reports/page.tsx 
  /(app)/reports/[id]/page.tsx 
  /(app)/repros/[id]/page.tsx 
  /(app)/exports/page.tsx 
/components 
  ReportIntake/*          // text+files, env selectors 
  SignalTray/*            // HAR/logs/screenshots with chips 
  ModuleMapper/*          // files + confidence, RAG citations 
  StepEditor/*            // draggable steps, selector inspector 
  RunnerPanel/*           // live runs, traces, videos 
  FlakeMeter/*            // stability score, N-run stats 
  DiffMini/*              // DOM/state delta snapshots 
  ExportWizard/*          // PR, sandbox, PDF/JSON 
/store 
  useReportStore.ts 
  useReproStore.ts 
  useRunStore.ts 
  useExportStore.ts 
/lib 
  api-client.ts 
  sse-client.ts 
  zod-schemas.ts 
  rbac.ts 
  

5.3 Key UX Flows 

Report Intake → paste text, drop HAR/logs → env autodetect → “Generate Repro”. 

Mapping → module guess with citation popover (repo/docs lines). 

Step Editor → view synthesized steps; tweak selectors; play/record a quick patch. 

Runner → watch trace/video; failure line highlighted; N-run flake heatmap. 

Export → choose PR branch or sandbox; copy “How to run” snippet. 

5.4 Validation & Errors 

Zod schemas; Problem+JSON banners; guardrails (no export without failing run). 

Selector quality warnings; fixture PII flags; sandbox size limits. 

5.5 Accessibility & i18n 

Keyboard step navigation; transcript for videos; localized times; high-contrast chart palettes. 

 

6) SDKs & Integration Contracts 

Create report & attach HAR 

POST /v1/reports 
{ "project_id":"UUID", "title":"Checkout button throws TypeError", "description":"Crash after applying coupon", "env":{"browser":"chromium","version":"124","os":"macOS"} } 
 
POST /v1/reports/{id}/signals 
{ "kind":"har", "file":"checkout.har" } 
  

Generate & validate repro 

POST /v1/repros/plan      { "report_id":"UUID" } 
POST /v1/repros/generate  { "report_id":"UUID", "target":"web" } 
POST /v1/repros/{id}/validate { "runs":20 } 
  

Export PR & sandbox 

POST /v1/exports/pr      { "repro_id":"UUID", "branch":"repro/bug-123", "title":"Failing repro: coupon TypeError" } 
POST /v1/exports/sandbox { "repro_id":"UUID", "host":"codesandbox" } 
  

JSON bundle keys: reports[], signals[], mappings[], repros[], steps[], runs[], exports[]. 

 

7) DevOps & Deployment 

FE: Vercel (Next.js). 

APIs/Workers: Render/Fly/GKE; pools per worker class; autoscale on queue depth. 

DB: Managed Postgres + pgvector; PITR; read replicas. 

Cache/Bus: Redis + NATS; DLQ with backoff/jitter. 

Storage/CDN: S3/R2 for artifacts; CDN for trace/video. 

CI/CD: GitHub Actions (lint/typecheck/unit/integration, container scan, sign, deploy). 

SLOs 

Report→first runnable repro < 90 s p95 

Flake validation (20 runs) < 4 min p95 (parallel) 

PR export < 30 s p95 

 

8) Testing 

Unit: selector mining accuracy; step minimization; fixture sanitizer. 

Integration: ingest → map → synth → run → minimize → export. 

Golden suites: seeded demo apps with known bugs; deterministic repro assertion. 

Load/Chaos: large HARs, long logs, flaky networks; runner crash recovery. 

Security: secret redaction, artifact access controls, RLS coverage. 

 

9) Success Criteria 

Product KPIs 

Reproduction success from vague reports ≥ 80% on first pass. 

Time to failing test < 5 min median from report intake. 

Flake quarantine accuracy ≥ 90% (vs human label). 

PR adoption (merged repro tests) ≥ 70%. 

Engineering SLOs 

Pipeline success ≥ 99% excl. malformed artifacts. 

Deterministic rerun match rate ≥ 95%. 

Export error rate < 1%. 

 

10) Visual/Logical Flows 

A) Intake & Signals 

 User submits report + HAR/logs/screens → signals clustered → environment inferred. 

B) Map to Code 

 RAG maps to module/framework; suggest test runner; cite docs/paths. 

C) Synthesize Repro 

 Generate steps + fixtures + test + Docker/Compose → run locally in runner. 

D) Validate & Minimize 

 Loop runs for stability → shrink steps to minimal failure → tag flakes. 

E) Export & Share 

 Open PR with failing test, or share sandbox; attach repro sheet PDF & JSON bundle. 

 