# REQ-F-010: Sandbox API diagnostics and idempotency visibility

**ID:** REQ-F-010  
**Type:** Functional  
**Status:** Proposed

## Description

The developer portal must provide diagnostics for sandbox API usage and make idempotency behavior visible for Nymbus operations that support `x-idempotency-key`.

Diagnostics are scoped to each developer tenant and must support troubleshooting without exposing sensitive data.

## Acceptance criteria

1. A logged-in developer can view sandbox API activity for their tenant with filtering by method, endpoint/path, status, and time range.
2. Each log entry includes, at minimum, timestamp, method, endpoint/path, status/result, request identifier/correlation identifier (where available), and credential identifier.
3. Developers can open request details to view request/response metadata with sensitive fields masked/redacted.
4. For operations that support `x-idempotency-key` in the imported Nymbus contracts, logs capture the idempotency key and whether the request was treated as first-use or replayed.
5. Idempotency behavior in simulator and diagnostics follows contract-documented rules, including key-length constraints and key reuse window where specified.
6. The portal only displays simulator/sandbox request activity and does not include production endpoint monitoring.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-F-010-T1 | `tests/req-f-010-api-log-filtering.test.ts` | Verifies tenant-scoped API activity visibility and filtering behavior. |
| REQ-F-010-T2 | `tests/req-f-010-idempotency-visibility.test.ts` | Verifies logging and replay classification for idempotent operations. |
| REQ-F-010-T3 | `tests/req-f-010-log-redaction.test.ts` | Verifies sensitive data masking in API diagnostics views. |

Success of these tests proves the requirement is implemented correctly.

## Change history

- 2026-03-12: Initial requirement logged.
