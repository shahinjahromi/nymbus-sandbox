# REQ-F-009: Sandbox credential lifecycle controls

**ID:** REQ-F-009  
**Type:** Functional  
**Status:** Proposed

## Description

The developer portal must provide tenant-scoped lifecycle management for sandbox API credentials used to call the Nymbus simulator APIs.

The lifecycle includes creation, controlled secret exposure, rotation, revocation, and expiration so developers can operate safely without sharing long-lived secrets.

## Acceptance criteria

1. A logged-in developer can create one or more sandbox API credentials for their own tenant, up to a configurable per-tenant limit.
2. Secret material is displayed only at creation/rotation time and is not retrievable in plaintext afterward.
3. The portal lists tenant-scoped credentials with metadata including label/name, created timestamp, status (active/revoked/expired), and last-used timestamp where available.
4. A developer can revoke a tenant-scoped credential, after which API calls using that credential are rejected.
5. A developer can rotate a tenant-scoped credential, producing new secret material and invalidating old secret material according to configured rotation behavior.
6. A developer can set or update credential expiration for their tenant-scoped credentials.
7. All credential lifecycle actions are enforced with tenant isolation and recorded in the audit trail.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-F-009-T1 | `tests/req-f-009-credential-create-list.test.ts` | Verifies tenant-scoped credential creation and metadata listing behavior. |
| REQ-F-009-T2 | `tests/req-f-009-credential-rotate-revoke.test.ts` | Verifies rotation/revocation lifecycle and resulting authentication behavior. |
| REQ-F-009-T3 | `tests/req-f-009-credential-secret-exposure.test.ts` | Verifies one-time secret visibility and non-retrievability after issuance. |

Success of these tests proves the requirement is implemented correctly.

## Change history

- 2026-03-12: Initial requirement logged.
