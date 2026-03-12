# REQ-F-005: Full Nymbus Core contract parity with independent simulator backend

**ID:** REQ-F-005  
**Type:** Functional  
**Status:** Proposed

## Description

The backend must implement the full Nymbus Core API surface defined in the imported OpenAPI specifications and expose endpoint paths/methods equivalent to the Stoplight mock server, while running fully independent from Stoplight runtime services.

The simulator must be implemented with project-owned backend code and a project-owned database design/persistence layer as part of the Nymbus Core simulator.

Source API contracts for this requirement:

- `openapi/nymbus-baas-original.yml`
- `openapi/nymbus-baas-bundled.yml`

## Acceptance criteria

1. **Full endpoint coverage:** Every path + HTTP method defined in the active Nymbus Core OpenAPI contract is implemented and routable in the simulator backend.
2. **Contract-accurate models:** Request and response payloads conform to the OpenAPI schemas (field names, nesting, required fields, and value types), including error response shapes where defined.
3. **Mock-server-compatible surface:** Endpoint URLs and method signatures match the Stoplight mock API surface for integrator compatibility, but execution is served by local backend code.
4. **Stoplight runtime independence:** The simulator backend does not proxy to, depend on, or require Stoplight mock runtime availability for request handling.
5. **Owned database design:** The simulator includes an internal database schema and persistence implementation to store and retrieve core entities (e.g., customers, accounts, cards, transfers, transactions) rather than returning static hardcoded responses.
6. **Data lifecycle support:** The simulator DB supports create/read/update/delete and simulator lifecycle workflows required by prior requirements (tenant seeding, isolation, wipe/reset, reseed).
7. **Versioned API support:** Versioned paths present in the OpenAPI contract (e.g., `/v1.0`, `/v1.1`, etc.) are implemented with contract-compliant behavior.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-F-005-T1 | `tests/req-f-005-openapi-endpoint-coverage.test.ts` | Verifies all path/method pairs in active OpenAPI contract are implemented by the running backend. |
| REQ-F-005-T2 | `tests/req-f-005-contract-model-parity.test.ts` | Validates representative request/response payloads against OpenAPI schemas for success and error cases. |
| REQ-F-005-T3 | `tests/req-f-005-stoplight-independence.test.ts` | Proves backend continues to serve endpoints with Stoplight unavailable and uses local persistence. |

Success of these tests proves the requirement is implemented correctly.

## Notes

- For implementation, `openapi/nymbus-baas-bundled.yml` SHOULD be treated as the default executable contract baseline, with `openapi/nymbus-baas-original.yml` retained for source-reference parity and drift checks.

## Change history

- 2026-03-12: Initial requirement logged from user directive for full endpoint/model parity and independent DB-backed simulator backend.
