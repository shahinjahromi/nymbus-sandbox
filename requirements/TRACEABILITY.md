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

### 5. Backend functional scope expansion (REQ-F-002, REQ-F-003, REQ-F-004)

- **Date:** 2026-03-12
- **Requirement ID:** REQ-F-002, REQ-F-003, REQ-F-004
- **Requirement title:** Developer tenancy isolation, tenant seed/reset lifecycle, payment rail and card simulation
- **Files changed:**
  - `requirements/functional/REQ-F-002-developer-tenant-isolation.md` (new)
  - `requirements/functional/REQ-F-003-tenant-seeding-and-reset.md` (new)
  - `requirements/functional/REQ-F-004-payment-rail-and-card-simulation.md` (new)
  - `requirements/TRACEABILITY.md` (this file)
- **Summary:** Logged backend functional requirements from user input: multi-tenant developer account isolation, deterministic tenant seed/wipe/reseed workflows, and simulation of ACH/wire/card lifecycle transactions, with future implementation expected to conform to Stoplight-hosted API specifications.

---

### 6. Full OpenAPI parity and independent core simulator backend (REQ-F-005)

- **Date:** 2026-03-12
- **Requirement ID:** REQ-F-005
- **Requirement title:** Full Nymbus Core contract parity with independent simulator backend and owned DB
- **Files changed:**
  - `requirements/functional/REQ-F-005-full-core-contract-parity.md` (new)
  - `requirements/TRACEABILITY.md` (this file)
- **Summary:** Logged requirement that backend must implement all endpoints and contract models from imported Nymbus OpenAPI files, expose Stoplight-compatible paths independently of Stoplight runtime, and rely on project-owned backend code plus database design/persistence for simulator behavior.

---

### 7. Developer portal functional scope (REQ-F-006, REQ-F-007, REQ-F-008)

- **Date:** 2026-03-12
- **Requirement ID:** REQ-F-006, REQ-F-007, REQ-F-008
- **Requirement title:** Portal auth/credentials, tenant operations visibility, simulation and interest accrual controls
- **Files changed:**
  - `requirements/functional/REQ-F-006-developer-portal-auth-and-credentials.md` (new)
  - `requirements/functional/REQ-F-007-tenant-operations-observability.md` (new)
  - `requirements/functional/REQ-F-008-simulation-and-interest-accrual-controls.md` (new)
  - `requirements/TRACEABILITY.md` (this file)
- **Summary:** Logged frontend portal requirements for developer registration/login/password reset OTP, API spec access, credential generation, tenant-scoped visibility of users/accounts/ledger/transactions, seed/reset operations, API call activity logs, external ACH/wire/card simulation actions, and account yield configuration with daily interest accrual behavior persisted by backend.

---

### 8. Nymbus-relevant portal gap closure (REQ-F-009, REQ-F-010, REQ-F-011, REQ-F-012, REQ-NF-005)

- **Date:** 2026-03-12
- **Requirement ID:** REQ-F-009, REQ-F-010, REQ-F-011, REQ-F-012, REQ-NF-005
- **Requirement title:** Credential lifecycle controls, diagnostics/idempotency visibility, contract change visibility, environment scoping, security guardrails
- **Files changed:**
  - `requirements/functional/REQ-F-009-sandbox-credential-lifecycle-controls.md` (new)
  - `requirements/functional/REQ-F-010-sandbox-api-diagnostics-and-idempotency-visibility.md` (new)
  - `requirements/functional/REQ-F-011-openapi-contract-version-and-change-visibility.md` (new)
  - `requirements/functional/REQ-F-012-environment-scoping-and-credential-separation.md` (new)
  - `requirements/non-functional/REQ-NF-005-sandbox-security-rate-limits-and-auditability.md` (new)
  - `requirements/TRACEABILITY.md` (this file)
- **Summary:** Added portal/security requirements scoped to Nymbus contract relevance and current project scope. Explicitly excluded non-requested items (webhook management without documented contract support, production endpoint monitoring, SDK-related requirements, embedded “Try It” functionality, and multi-tenant organization facilities).

---

### 9. Requirement test pairing for new portal/security scope (REQ-F-009, REQ-F-010, REQ-F-011, REQ-F-012, REQ-NF-005)

- **Date:** 2026-03-12
- **Requirement ID:** REQ-F-009, REQ-F-010, REQ-F-011, REQ-F-012, REQ-NF-005
- **Requirement title:** Tests added for credential lifecycle, diagnostics/idempotency, contract visibility, environment scoping, security guardrails
- **Files changed:**
  - `tests/req-f-009-credential-lifecycle-controls.test.ts` (new)
  - `tests/req-f-010-sandbox-api-diagnostics-and-idempotency-visibility.test.ts` (new)
  - `tests/req-f-011-openapi-contract-version-and-change-visibility.test.ts` (new)
  - `tests/req-f-012-environment-scoping-and-credential-separation.test.ts` (new)
  - `tests/req-nf-005-sandbox-security-rate-limits-and-auditability.test.ts` (new)
  - `requirements/TRACEABILITY.md` (this file)
- **Summary:** Added requirement-paired Vitest checks validating that new requirement documents exist and contain the expected scope constraints, including sandbox-only monitoring boundaries and exclusions for SDK/Try-It features.

---

### 10. Initial implementation slice for portal + tenant-scoped backend (REQ-F-006, REQ-F-007, REQ-F-009, REQ-F-010, REQ-F-012, REQ-NF-005)

- **Date:** 2026-03-12
- **Requirement ID:** REQ-F-006, REQ-F-007, REQ-F-009, REQ-F-010, REQ-F-012, REQ-NF-005
- **Requirement title:** Portal auth and credential lifecycle, tenant data isolation, idempotency/logging, sandbox audit/security controls
- **Files changed:**
  - `src/services/developer-registry.ts` (credential lifecycle with tenant scoping)
  - `src/auth/oauth.ts` (tenant-aware token issuance/validation)
  - `src/auth/middleware.ts` (tenant/credential context propagation)
  - `src/services/tenant-store.ts` (new tenant-scoped data layer)
  - `src/services/api-activity-log.ts` (new request activity capture and listing)
  - `src/services/idempotency-store.ts` (new idempotency replay storage)
  - `src/services/audit-log.ts` (new append-only sandbox audit trail)
  - `src/services/portal-auth.ts` (new portal user/session/OTP service)
  - `src/routes/accounts.ts` (tenant-scoped reads)
  - `src/routes/customers.ts` (tenant-scoped reads)
  - `src/routes/transactions.ts` (tenant-scoped reads)
  - `src/routes/transfers.ts` (tenant-scoped writes + idempotency)
  - `src/routes/portal.ts` (new portal API and minimal portal client UI)
  - `src/app.ts` (portal route wiring)
  - `src/types/express.d.ts` (request context typing)
  - `tests/req-f-006-portal-auth.test.ts` (new runtime flow test)
  - `tests/req-f-009-portal-credential-lifecycle.test.ts` (new runtime lifecycle test)
  - `tests/req-f-010-idempotency-and-api-activity.test.ts` (new runtime idempotency/logging test)
  - `README.md` (portal usage documentation)
  - `requirements/TRACEABILITY.md` (this file)
- **Summary:** Implemented first runnable full-stack slice: portal registration/login/password-reset OTP, tenant-scoped credential creation/list/revoke/rotate, tenant-scoped API data views, transfer idempotency replay with `x-idempotency-key`, API activity logs, and sandbox audit trail endpoints/UI access. Added runtime tests to validate core flows.

---

### 11. REQ-F-008 then REQ-F-007 implementation slice (simulation/yield first, then tenant operations)

- **Date:** 2026-03-12
- **Requirement ID:** REQ-F-008, REQ-F-007
- **Requirement title:** Simulation and interest controls implemented ahead of tenant operations visibility and seed/reset lifecycle
- **Files changed:**
  - `src/services/tenant-store.ts` (added incoming ACH/wire simulation, card event simulation, yield config persistence, daily accrual engine, account seed/reset operations)
  - `src/routes/portal.ts` (added portal API endpoints for simulation, yield/accrual, tenant users/accounts/transactions, account seed/reset)
  - `README.md` (expanded portal API endpoint documentation)
  - `tests/req-f-008-transfer-card-simulations.test.ts` (new)
  - `tests/req-f-008-account-yield-config.test.ts` (new)
  - `tests/req-f-008-daily-interest-accrual.test.ts` (new)
  - `tests/req-f-007-tenant-data-visibility.test.ts` (new)
  - `tests/req-f-007-seed-clear-lifecycle.test.ts` (new)
  - `tests/req-f-007-api-activity-log.test.ts` (new)
  - `requirements/TRACEABILITY.md` (this file)
- **Summary:** Implemented REQ-F-008 first as requested (simulation controls plus APY config and daily accrual), then implemented REQ-F-007 operational views and seed/reset lifecycle endpoints. Added runtime tests for both requirement groups and validated full suite pass.

---

### 12. REQ-F-002/003/004 tenant lifecycle and simulation parity slice

- **Date:** 2026-03-12
- **Requirement ID:** REQ-F-002, REQ-F-003, REQ-F-004
- **Requirement title:** Tenant isolation operations, tenant dataset seed/reset lifecycle, and expanded rail/card simulation behaviors
- **Files changed:**
  - `src/services/tenant-store.ts` (added tenant user/account creation, tenant-level reset/seed, outgoing ACH simulation, stricter card transition validity checks)
  - `src/routes/portal.ts` (added `POST /portal-api/users`, `POST /portal-api/accounts`, `POST /portal-api/tenant/reset`, `POST /portal-api/tenant/seed`, `POST /portal-api/simulations/ach-outgoing`, plus improved card transition error responses)
  - `tests/req-f-002-tenant-isolation.test.ts` (new)
  - `tests/req-f-003-seeding-reset.test.ts` (new)
  - `tests/req-f-004-rails-card-simulation.test.ts` (new)
  - `README.md` (expanded portal endpoint documentation)
  - `requirements/TRACEABILITY.md` (this file)
- **Summary:** Implemented missing runtime controls to satisfy remaining tenant and lifecycle requirements: developers can now create tenant-scoped users/accounts, perform tenant-wide dataset reset and deterministic reseed, simulate outgoing ACH flows, and receive lifecycle-valid card transition handling for auth/post/void/refund operations. Added dedicated runtime tests for REQ-F-002/003/004 and validated targeted pass.

---

### 13. REQ-F-005 contract parity tranche: versioned routing + baseline coverage tests

- **Date:** 2026-03-12
- **Requirement ID:** REQ-F-005
- **Requirement title:** Full Core contract parity (incremental slice: versioned path support and local-runtime validation)
- **Files changed:**
  - `src/app.ts` (mounted core routers under `/v1.0` through `/v1.5` and exposed supported versions at root)
  - `tests/req-f-005-openapi-endpoint-coverage.test.ts` (new)
  - `tests/req-f-005-contract-model-parity.test.ts` (new)
  - `tests/req-f-005-stoplight-independence.test.ts` (new)
  - `README.md` (documented versioned API support)
  - `requirements/TRACEABILITY.md` (this file)
- **Summary:** Implemented a concrete REQ-F-005 progression slice by enabling versioned route access for implemented core resources and adding baseline tests for versioned endpoint routability, representative contract model shape checks, and local runtime persistence/idempotency behavior independent of Stoplight runtime.

---

*(Add new entries at the bottom when implementing further requirements.)*
