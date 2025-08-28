# PLAN.md — AI Bug Reproduction Tool

## 0) TL;DR
Turn a natural-language bug report (text/screenshots/HAR/logs) into a **deterministic, runnable repro**: a failing test + fixtures + seed data + a one‑command runner in a shareable sandbox (CodeSandbox/StackBlitz/Docker). Human-in-the-loop, secrets scrubbed, quarantined tests until review.

---

## 1) Goals & Non‑Goals
### Goals
- Convert vague bug reports into **Minimal Repro Packages (MRPs)** automatically.
- Produce **executable sandboxes** and **failing tests** (Playwright/Cypress/Jest/Pytest/RSpec/etc.).
- Stabilize repros via **clock freeze**, **network shaping**, **retry suppression**, and **delta minimization**.
- Export **PR/MR** with failing test and **repro sheet (PDF)**; attach **JSON bundle**.
- Keep **evidence-first**: link logs/HAR/console traces/session replay to each step/assertion.

### Non‑Goals (v1)
- Auto‑fixing application code (patch suggestions may be v2).
- Long-lived hosting of third‑party repos or production data.
- Full-blown APM replacement (we ingest signals; we don’t replace Datadog/New Relic).

---

## 2) Primary Users & JTBD
- **QA/SDETs**: “Turn a user’s vague report into a deterministic failure I can hand to devs.”
- **Developers**: “Get a small, runnable repro that fails quickly and isolates causes.”
- **Support**: “Escalate field issues with credible artifacts (steps + logs + env).”
- **OSS Maintainers**: “Triage community issues with shareable minimal repros.”

---

## 3) Deliverables (v1)
- **Minimal Repro Package (MRP)**: test file + fixtures + seed data + runner config.
- **Executable sandbox**: CodeSandbox/StackBlitz (web) or **Docker** tarball.
- **Scenario script**: human-readable steps (selectors/API calls/CLI).
- **Signal bundle**: logs/HAR/DOM+state diffs; **flake analysis** (N-run stats).
- **Exports**: **PR/MR**, **PDF repro sheet**, **JSON bundle**.

---

## 4) Scope (v1) vs Later
### v1
- Inputs: text, screenshots, HAR, logs (Datadog/NewRelic/Sentry), short screen recordings.
- Runners: **Playwright** (web UI), **Cypress** (optional), **Pytest/Jest** (API/units), **Docker Compose** for DB seed.
- Env capture: node/py/ruby auto-detect; **nvm/pyenv/asdf** lockfiles.
- Data shaping: faker-based synthetic datasets, PII scrub.
- **Minimization** & **flake detector** (N=20 default).
- Exports: PR, sandbox (web/docker), PDF/JSON.

### v1.x / v2
- Rerun on CI with flake quarantine gates.
- Record & replay via rrweb/Playwright traces with visual diffs.
- Service/CLI flows; JVM/Go stacks.
- Guided fix suggestions.

---

## 5) Milestones & Timeline
**M0 – Foundations (Week 0–2)**
- Repo, CI, IaC; env secrets; SSO.  
- Skeleton API (NestJS) + BFF (Next.js).  
- Runner images: Playwright, Python, Node, DB seeds.

**M1 – Ingestion & Mapping (Week 3–4)**
- Upload flows (reports + signals).  
- OCR/ASR for screenshots/videos.  
- RAG over repo/docs to map framework/module; selector mining from HAR/logs.

**M2 – Repro Synthesis (Week 5–6)**
- Step generator (web/API/CLI).  
- Fixtures + seed data + compose.yaml.  
- Deterministic controls (clock freeze, network shaping, retry off).

**M3 – Validate & Minimize (Week 7–8)**
- N-run loop, stability score; Zeller-style delta minimization.  
- Flake quarantine + badge.

**M4 – Export & Collaboration (Week 9)**
- PR/MR export; sandbox export; PDF/JSON repro sheet; issue bot comments.

**M5 – Hardening & GA (Week 10–12)**
- Security review (PII scrub), perf tuning, SLO bake, docs, pricing & packaging.

---

## 6) Success Metrics (KPIs) & SLOs
- **Reproduction success** ≥ **80%** first pass.  
- **Time to failing test** < **5 min** median.  
- **Flake quarantine accuracy** ≥ **90%** (vs human).  
- **PR adoption** (merged repro tests) ≥ **70%**.

SLOs: Ingest→first repro < **90s p95**; flake validation (20 runs) < **4m p95**; PR export < **30s p95**.

---

## 7) Risks & Mitigations
- **Flaky environments** → determinism controls, N-run verification, sandbox pinning.  
- **PII leakage** → sanitizer on fixtures/logs; redaction rules; retention policies.  
- **Repo diversity** → framework probes + graceful fallbacks; user-selectable runner.  
- **Third-party rate limits** → local mocks/fixtures; HAR replay; backoff.  
- **Security** → scoped tokens; read-only by default; immutable audit.

---

## 8) Dependencies
- Playwright/Cypress runners & browser images.
- OCR/ASR toolchain (tesseract/whisper small).  
- pgvector, NATS, Redis, S3-compatible storage.  
- VCS providers (GitHub/GitLab/Bitbucket) for PR export.
- CodeSandbox/StackBlitz/Docker hub for sandboxes.

---

## 9) Pricing & Packaging (draft)
- **Team**: n projects, limited monthly repro exports.  
- **Pro**: priority runners, CI plug-ins, SSO.  
- **Enterprise**: on-prem runners, DLP/PII policies, custom SLOs.

---

## 10) Launch Checklist (v1)
- [ ] Security review (PII, tokens).  
- [ ] Docs: “How to prepare a good report”, “How we minimize steps”.  
- [ ] Example repos + golden bug suites.  
- [ ] Incident playbook for runner outages.  
- [ ] Sales/demo sandbox with seeded bugs.
