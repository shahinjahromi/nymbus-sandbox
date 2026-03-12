# Requirements

This folder holds all **functional** and **non-functional** requirements for the Nymbus Sandbox project, plus process and traceability artifacts.

## Structure

| Path | Purpose |
|------|--------|
| **`PROCESS.md`** | Process rules: how requirements are logged, how code changes are traced, delta-only implementation, test pairing, build/test/defect logging. |
| **`TRACEABILITY.md`** | Log of source code changes in response to requirements (requirement ID → date, files changed, summary). |
| **`DEFECTS.md`** | List of defects identified by test runs (logged before any fix attempt). |
| **`functional/`** | One file per functional requirement (or grouped). Use IDs like `REQ-F-001`. |
| **`non-functional/`** | One file per non-functional requirement. Use IDs like `REQ-NF-001`. |
| **`design/`** | Design docs and LLM instructions: **`DEPLOYMENT.md`** (two-phase Azure/Vercel), **`SOLID.md`** (SOLID principles), **`DATABASE-FINANCIAL.md`** (financial DB best practices). |

## Naming

- **Functional:** `REQ-F-NNN` (e.g. REQ-F-001, REQ-F-002).
- **Non-functional:** `REQ-NF-NNN` (e.g. REQ-NF-001).
- Files can be named e.g. `REQ-F-001-sandbox-oauth-api.md` for clarity.

## Change history for requirements

When a requirement is **changed**, add a **Change history** / **Revisions** section at the bottom of that requirement file with:

- Date
- Summary of what changed
- Optional: link to TRACEABILITY entry for the implementation of the change

## Traceability

Every code change that implements a requirement must be recorded in **`TRACEABILITY.md`** with requirement ID, date, files changed, and a short summary.

## Tests and build

- Every requirement has at least one test case that proves it.
- Every build runs tests and produces either success evidence or a defect log in **`DEFECTS.md`** before fixes are attempted.
