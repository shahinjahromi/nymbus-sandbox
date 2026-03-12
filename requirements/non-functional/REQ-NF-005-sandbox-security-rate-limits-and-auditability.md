# REQ-NF-005: Sandbox security guardrails, abuse controls, and auditability

**ID:** REQ-NF-005  
**Type:** Non-Functional  
**Status:** Proposed

## Description

The sandbox platform and developer portal must enforce security guardrails that reduce abuse risk and preserve traceability for sensitive operations.

Controls include credential and authentication protections, rate limiting/throttling policies, and immutable audit capture for security-relevant actions.

## Acceptance criteria

1. The backend enforces configurable rate limiting/throttling controls for authentication and API operations at least at credential and tenant scope.
2. Repeated failed authentication and OTP reset attempts are throttled/temporarily blocked according to configurable policy.
3. Security-sensitive actions are recorded in an append-only audit trail, including credential issuance/rotation/revocation, password reset events, and tenant data reset operations.
4. Audit records include actor identity, tenant context, action type, timestamp, outcome, and request identifier where available.
5. Sensitive values (e.g., secrets, OTP values, raw credentials) are never stored in plaintext in operational logs or audit records.
6. This requirement applies to sandbox platform controls only and does not impose production endpoint monitoring.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-NF-005-T1 | `tests/req-nf-005-rate-limit-controls.test.ts` | Verifies configurable throttle behavior for auth/API abuse scenarios. |
| REQ-NF-005-T2 | `tests/req-nf-005-audit-trail.test.ts` | Verifies append-only audit capture for security-sensitive actions. |
| REQ-NF-005-T3 | `tests/req-nf-005-sensitive-data-masking.test.ts` | Verifies secrets and OTP values are masked/not persisted in logs. |

Success of these tests proves the requirement is implemented correctly.

## Change history

- 2026-03-12: Initial requirement logged.
