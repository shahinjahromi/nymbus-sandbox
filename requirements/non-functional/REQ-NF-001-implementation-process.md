# REQ-NF-001: Implementation process (requirements, traceability, delta, tests, build)

**ID:** REQ-NF-001  
**Type:** Non-functional (process)  
**Status:** Implemented

## Description

The implementation approach must satisfy:

1. **Requirements folder:** Repo includes a `requirements/` folder; every functional requirement is logged under `requirements/functional/` and every non-functional under `requirements/non-functional/`.
2. **Change tracking:** Every change to a previous requirement is noted (e.g. in a change history in the requirement file).
3. **Delta-only code:** Future source code generation prompts result only in **change/delta** implementations; no re-generation of entire codebase from all requirements.
4. **Traceability log:** Every code change in response to a requirement is logged (requirement ID, date, files changed, summary) so source changes can be traced to requirements.
5. **Test pairing:** Every requirement is paired with at least one test case that, when run successfully, proves the requirement is implemented.
6. **Build and tests:** Every build entails running the test cases. Outcome is either evidence of successful execution or a list of defects; defects are logged (e.g. in `requirements/DEFECTS.md`) **before** any attempt to fix them.

## Acceptance criteria

- [x] `requirements/` exists with `PROCESS.md`, `README.md`, `TRACEABILITY.md`, `DEFECTS.md`, and subfolders `functional/` and `non-functional/`.
- [x] Process document states: log requirements, note changes, delta-only code, traceability log, one requirement → test case, build runs tests and log success or defects first.
- [x] Traceability log has entries for code changes with requirement ID, date, files changed, summary.
- [x] Each requirement file can reference its test case(s).
- [x] `npm run build` runs the test suite; defects (if any) are to be logged in `DEFECTS.md` before fixes.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-NF-001 | `tests/req-nf-001-process.test.ts` | `REQ-NF-001: Requirements folder and process artifacts exist` — Asserts presence of requirements folder, PROCESS.md, TRACEABILITY.md, DEFECTS.md, and that build script runs tests. |

## Change history

- 2026-03-12: Initial requirement logged.
