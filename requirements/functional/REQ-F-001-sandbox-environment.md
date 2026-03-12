# REQ-F-001: Sandbox environment with OAuth and production-like APIs

**ID:** REQ-F-001  
**Type:** Functional  
**Status:** Implemented

## Description

Provide a sandbox environment for the Nymbus processor such that integrators can:

- Create developer accounts with OAuth credentials.
- Call all relevant APIs.
- Receive production-like responses to integrate and validate their integrations before pushing code to production against a live Nymbus core processor.

## Acceptance criteria

1. Integrators can obtain API access using OAuth (client_credentials) with a `client_id` and `client_secret`.
2. A token endpoint (`POST /oauth/token`) returns an `access_token` and `expires_in`.
3. Protected endpoints (accounts, transactions, customers, transfers) require `Authorization: Bearer <access_token>` and return production-like JSON shapes.
4. Sandbox exposes: list/get accounts, list/get transactions (by account), list/get customers, list/get/create transfers.
5. Responses use deterministic mock data (no real core); pagination and error shapes (e.g. 401, 404) match production-like behavior.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-F-001 | `tests/req-f-001-sandbox.test.ts` | `REQ-F-001: OAuth token and protected API return production-like responses` — Obtains token with client credentials, then calls health, accounts, and validates response shape. |

Success of this test proves the requirement is implemented correctly.

## Change history

- 2026-03-12: Initial requirement logged (post-implementation of initial sandbox).
