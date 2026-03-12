# REQ-NF-002: Two-phase deployment model (Azure + Vercel → Azure)

**ID:** REQ-NF-002  
**Type:** Non-functional (architecture / deployment)  
**Status:** Implemented

## Description

The design MUST support two deployment models:

- **Backend (server-side):** Always deployed to **Azure** (database and backend server/APIs).
- **Front-end:**
  - **Phase 1 (initial path):** Deployed to **Vercel**. The local sandbox must be deployable with backend on Azure and front-end on Vercel.
  - **Phase 2 (long run):** Front-end also deployed to **Azure** (backend and front-end both on Azure).

So: Phase 1 = Azure (DB + API) + Vercel (front-end); Phase 2 = Azure (DB + API + front-end).

## Acceptance criteria

1. Architecture and design docs describe both phases and instruct the LLM to keep the design compatible with Phase 1 (Azure backend, Vercel front-end) and Phase 2 (Azure for both).
2. No design or implementation choices tie the front-end exclusively to a single host; the front-end can be deployed to Vercel (Phase 1) or Azure (Phase 2) via configuration/build/deploy only.
3. Backend is always deployable to Azure (DB and APIs).
4. LLM instructions (in requirements/design or Cursor rules) state that new features and changes must preserve deployability for both phases.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-NF-002 | `tests/req-nf-002-deployment.test.ts` | Deployment design doc exists and describes Phase 1 (Vercel front-end) and Phase 2 (Azure front-end), and backend always on Azure. |

## Change history

- 2026-03-12: Initial requirement logged.
