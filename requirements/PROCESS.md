# Requirements & Implementation Process

This document defines how requirements and source code changes are managed for the Nymbus Sandbox project. **All parties (including the LLM) must follow these rules.**

---

## 1. Requirements folder

- The repository **must** include a **`requirements/`** folder.
- Every **functional** requirement MUST be logged in an appropriate file under **`requirements/functional/`**.
- Every **non-functional** requirement MUST be logged in an appropriate file under **`requirements/non-functional/`**.
- Use a consistent ID scheme (e.g. `REQ-F-001`, `REQ-NF-001`) and reference it in traceability.

---

## 2. Changes to previous requirements

- Any **change to a previous requirement** MUST be **noted** in the same requirement file (e.g. a "Change history" or "Revisions" section at the bottom).
- Record: date, summary of change, and (if applicable) which requirement ID was amended.
- Do not silently overwrite requirement text; preserve or summarize prior version when changing.

---

## 3. Source code generation (delta only)

- **All future prompts for source code generation** must result in **delta-only changes**: only the code that implements the **change** or **new requirement** may be added/edited.
- **Do not** re-generate entire codebases or entire files based on "all requirements." Focus only on the **minimal change** needed to satisfy the new or changed requirement.
- When in doubt, edit the smallest set of files/lines necessary.

---

## 4. Traceability: code changes ↔ requirements

- **Every** source-code change made in response to a requirement MUST be logged in **`requirements/TRACEABILITY.md`**.
- Each log entry MUST include:
  - **Date** (of the change)
  - **Requirement ID** (e.g. REQ-F-001) and short title
  - **Files changed** (list of paths)
  - **Brief summary** of what was implemented or modified
- This allows tracing any source code change back to the requirement that drove it.

---

## 5. One requirement → one test case

- **Every requirement** MUST be paired with **at least one test case** that, when executed successfully, **proves** the requirement is implemented correctly.
- Tests SHOULD live in the repo (e.g. under `tests/` or `src/` with a test runner) and be referenced from the requirement (e.g. test file and test name or ID).
- Requirement docs SHOULD state the corresponding test case(s) (file + name or ID).

---

## 6. Build and test execution

- **Every build** MUST entail **execution of the test cases**.
- After running tests, the build process (or the LLM when reporting) MUST produce either:
  - **Evidence of successful execution** (e.g. test output showing all tests passed), or
  - **A list of defects** identified by the test run (test name, expected vs actual, or failure message).
- **Defects MUST be logged** (e.g. in **`requirements/DEFECTS.md`** or equivalent) **before** the LLM attempts to fix them. That is: first log the defect(s), then optionally attempt fixes in a follow-up step.
- The pipeline: **Build → Run tests → Log success or log defects → (if defects) optionally fix**.

---

## 7. Deployment design (two-phase model)

- The design MUST support **Phase 1:** backend (DB + APIs) on **Azure**, front-end on **Vercel**; and **Phase 2:** backend and front-end both on **Azure**.
- When implementing features, follow **`requirements/design/DEPLOYMENT.md`**: keep backend Azure-deployable; keep front-end host-agnostic (config-driven API URL, no lock-in to Vercel-only or Azure-only).
- See **REQ-NF-002** for the full requirement.

---

## 8. SOLID principles (architecture)

- The design and implementation MUST conform to **SOLID** principles as described in [Software Architecture: S.O.L.I.D Principles](https://medium.com/@ankurpratik/software-architecture-s-o-l-i-d-principles-967930d2812b).
- When implementing or changing code, follow **`requirements/design/SOLID.md`**: single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion.
- See **REQ-NF-003** for the full requirement.

---

## 9. Database design for financial systems

- The database design MUST conform to best practices for financial systems as described in [The Ideal Database for Financial Transactions](https://medium.com/@keemsisi/the-ideal-database-for-financial-transactions-unraveling-the-best-options-d5fef359fe09).
- Follow **`requirements/design/DATABASE-FINANCIAL.md`**: ACID for core transactional data, auditability, security, DECIMAL for money, indexing, audit trails where required.
- See **REQ-NF-004** for the full requirement.

---

## 10. Summary checklist (for each new/updated requirement)

- [ ] Requirement logged under `requirements/functional/` or `requirements/non-functional/`
- [ ] If changing an existing requirement: change noted in that requirement’s change history
- [ ] Code changes are **delta-only** (no full file/codebase regeneration)
- [ ] **`requirements/TRACEABILITY.md`** updated with: requirement ID, files changed, summary
- [ ] **At least one test case** added/updated that proves the requirement; requirement doc references it
- [ ] Build run includes test execution; result is **success** (evidence) or **defects** logged in **`requirements/DEFECTS.md`** before any fix attempt
- [ ] If touching front-end or deployment: design remains compatible with **Phase 1** (Azure backend + Vercel front-end) and **Phase 2** (Azure backend + Azure front-end) per **`requirements/design/DEPLOYMENT.md`**
- [ ] If touching architecture or modules: follow **`requirements/design/SOLID.md`** (REQ-NF-003).
- [ ] If touching database or financial data: follow **`requirements/design/DATABASE-FINANCIAL.md`** (REQ-NF-004).
