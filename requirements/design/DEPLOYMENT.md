# Deployment design: two-phase model (LLM instructions)

**Audience:** Implementers and LLM. Follow this so the design supports both deployment phases.

---

## Deployment model

| Component | Phase 1 (initial) | Phase 2 (long run) |
|-----------|--------------------|---------------------|
| **Database** | Azure | Azure |
| **Backend / APIs** | Azure | Azure |
| **Front-end** | **Vercel** | **Azure** |

- **Backend (server-side)** is always deployed to **Azure** (database and backend server/APIs).
- **Front-end** is deployed to **Vercel** in Phase 1, then to **Azure** in Phase 2. The same front-end codebase must support both without code rewrites.

---

## Instructions for the LLM

When adding or changing features, ensure:

1. **Backend and DB on Azure**
   - Assume backend (APIs, server) and database are always on Azure. Use environment variables or config for API base URL, DB connection, etc.; do not hardcode a single provider for backend.

2. **Front-end host-agnostic (Phase 1 and Phase 2)**
   - The front-end must work when served from **Vercel** (Phase 1) or **Azure** (Phase 2). Avoid:
     - Hardcoding backend URLs that only work with one host.
     - Build or runtime assumptions that tie the app to Vercel-only or Azure-only (e.g. Vercel-only serverless functions that cannot be moved to Azure).
   - Use **environment variables** (e.g. `NEXT_PUBLIC_API_URL`, `VITE_API_URL`) for API base URL and any environment-specific config so the same build can be deployed to Vercel or Azure by changing env only.

3. **Local sandbox**
   - Phase 1 local sandbox = backend runnable/deployable to Azure (or local), front-end runnable/deployable to Vercel (or local). Keep scripts and docs so that “server on Azure + front-end on Vercel” is a valid deployment.

4. **No Phase-only coupling**
   - Do not introduce dependencies or patterns that make it impossible to later move the front-end from Vercel to Azure (or vice versa for rollback). Prefer standard HTTP/HTTPS to backend APIs and config-driven base URLs.

5. **Documentation**
   - When adding deployment or env docs, mention both Phase 1 (Vercel front-end) and Phase 2 (Azure front-end) and that backend is always on Azure.

---

## Summary

- **Backend:** Always Azure (DB + APIs).
- **Phase 1:** Front-end on Vercel; local sandbox deployable as Azure backend + Vercel front-end.
- **Phase 2:** Front-end on Azure; same codebase, config-driven, no front-end lock-in to one host.

Reference: REQ-NF-002.
