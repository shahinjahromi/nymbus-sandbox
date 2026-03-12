# Traceability: Requirements → Source Code Changes

Each entry below links a requirement to the source code changes made to implement it. **Only delta changes** are made per requirement; full file regeneration is not used.

Format per entry:

- **Date:** YYYY-MM-DD
- **Requirement ID:** e.g. REQ-F-001
- **Requirement title:** Short title
- **Files changed:** List of file paths
- **Summary:** What was implemented or modified

---

## Entries

### 1. Initial sandbox implementation (pre-process)

- **Date:** 2026-03-12
- **Requirement ID:** (implicit: sandbox with OAuth and production-like APIs; later formalized as REQ-F-001)
- **Requirement title:** Sandbox environment with OAuth and core APIs
- **Files changed:**
  - `package.json`
  - `tsconfig.json`
  - `.env.example`
  - `.gitignore`
  - `src/config.ts`
  - `src/types/index.ts`
  - `src/auth/oauth.ts`
  - `src/auth/middleware.ts`
  - `src/services/developer-registry.ts`
  - `src/services/mock-data.ts`
  - `src/routes/auth.ts`
  - `src/routes/accounts.ts`
  - `src/routes/transactions.ts`
  - `src/routes/customers.ts`
  - `src/routes/transfers.ts`
  - `src/index.ts`
  - `openapi/sandbox-api.yaml`
  - `README.md`
- **Summary:** Initial Nymbus sandbox: OAuth2 client_credentials, developer registry, mock data, accounts/transactions/customers/transfers API, OpenAPI spec, README.

---

### 2. Requirements process and traceability (REQ-NF-001)

- **Date:** 2026-03-12
- **Requirement ID:** REQ-NF-001
- **Requirement title:** Requirements folder, logging, traceability, delta-only code, test pairing, build-with-tests, defect log
- **Files changed:**
  - `requirements/PROCESS.md` (new)
  - `requirements/README.md` (new)
  - `requirements/TRACEABILITY.md` (this file, new)
  - `requirements/DEFECTS.md` (new)
  - `requirements/functional/REQ-F-001-sandbox-environment.md` (new)
  - `requirements/non-functional/REQ-NF-001-implementation-process.md` (new)
  - `package.json` (add test script, build runs tests; add vitest, supertest)
  - `vitest.config.ts` (new)
  - `tests/req-f-001-sandbox.test.ts` (new — test for REQ-F-001)
  - `tests/req-nf-001-process.test.ts` (new — test for REQ-NF-001)
  - `src/app.ts` (new — express app extracted for testing)
  - `src/index.ts` (modified — now imports app and only starts server)
  - `.cursor/rules/requirements-process.mdc` (new — Cursor rule for process)
- **Summary:** Added requirements folder, process doc, traceability log, defect log, initial functional (REQ-F-001) and non-functional (REQ-NF-001) requirement docs, Vitest + Supertest, tests for both requirements, app extraction for testability, build that runs tests, and Cursor rule enforcing the process.

---

### 3. Two-phase deployment model (REQ-NF-002)

- **Date:** 2026-03-12
- **Requirement ID:** REQ-NF-002
- **Requirement title:** Two-phase deployment (Azure backend; Phase 1 Vercel front-end, Phase 2 Azure front-end)
- **Files changed:**
  - `requirements/non-functional/REQ-NF-002-two-phase-deployment.md` (new)
  - `requirements/design/DEPLOYMENT.md` (new)
  - `requirements/PROCESS.md` (added §7 deployment design, checklist item for Phase 1/2)
  - `requirements/README.md` (design folder and DEPLOYMENT.md referenced)
  - `.cursor/rules/requirements-process.mdc` (added §6 deployment model)
  - `tests/req-nf-002-deployment.test.ts` (new — test for REQ-NF-002)
- **Summary:** Documented two-phase deployment (backend always Azure; Phase 1 front-end on Vercel, Phase 2 on Azure). Added design doc with LLM instructions for host-agnostic front-end and Azure backend, process and Cursor rule updates, and test proving deployment doc exists and describes both phases.

---

### 4. SOLID principles and financial DB design (REQ-NF-003, REQ-NF-004)

- **Date:** 2026-03-12
- **Requirement ID:** REQ-NF-003, REQ-NF-004
- **Requirement title:** Architecture conforms to SOLID; DB design conforms to financial-system best practices
- **Files changed:**
  - `requirements/non-functional/REQ-NF-003-solid-principles.md` (new)
  - `requirements/non-functional/REQ-NF-004-financial-db-practices.md` (new)
  - `requirements/design/SOLID.md` (new)
  - `requirements/design/DATABASE-FINANCIAL.md` (new)
  - `requirements/PROCESS.md` (added §8 SOLID, §9 Database financial, checklist items)
  - `requirements/README.md` (design folder: SOLID, DATABASE-FINANCIAL)
  - `.cursor/rules/requirements-process.mdc` (added §7 SOLID, §8 Financial DB)
  - `tests/req-nf-003-solid.test.ts` (new — test for REQ-NF-003)
  - `tests/req-nf-004-database-financial.test.ts` (new — test for REQ-NF-004)
- **Summary:** Added REQ-NF-003 (SOLID per Medium article) and REQ-NF-004 (financial DB best practices per Medium article). Created design docs with LLM instructions; updated process, Cursor rule, and tests to assert design docs exist and describe principles/practices.

---

*(Add new entries at the bottom when implementing further requirements.)*
